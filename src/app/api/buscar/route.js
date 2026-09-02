import { NextResponse } from 'next/server';
import { addDoc, collection } from 'firebase/firestore';
import { dbServer } from '../../lib/firebase-server';
import { filtrarPrevio, MENSAJE_RECHAZO_CAPA0 } from '../../lib/busqueda/filtroPrevio';
import { extraerIntencion } from '../../lib/busqueda/extraerIntencion';
import { detectarFueraDeGiro } from '../../lib/busqueda/detectarFueraDeGiro';
import { registrarBusqueda } from '../../lib/busqueda/registrarBusqueda';
import { existeEnCatalogoVivo, consultarInventario, consultarInventarioVehiculo, consultarMotoresTransmisiones } from '../../lib/busqueda/consultarInventario';
import { permitirBusqueda, MENSAJE_RATE_LIMIT } from '../../lib/busqueda/rateLimit';
import { obtenerEstadosCombinado } from '../../lib/busqueda/estadosServer';
import { notificarAdmin } from '../../lib/notificarAdmin';

// Nota de nombres: en este archivo `estado` (minúscula, sin más calificación) siempre significa
// el ESTADO DE LA BÚSQUEDA ('ok', 'sin_inventario', 'fuera_de_catalogo', etc. — ver
// registrarBusqueda/persistirContactoSiExiste), un patrón ya establecido antes del sistema de
// estados geográficos. Para no confundir los dos conceptos, el filtro geográfico nuevo se llama
// `estadoFiltro` en todo este archivo (viaja como `estado` solo al cruzar a consultarInventario.js,
// donde ese nombre no tiene ninguna otra acepción).
async function mensajeSinYonkesEnEstado(estadoFiltro) {
  const estados = await obtenerEstadosCombinado();
  const nombre = estados.find((e) => e.id === estadoFiltro)?.nombre || estadoFiltro;
  return `Aún no tenemos yonkes registrados en ${nombre} — muy pronto estaremos ahí. Prueba buscando en "Todos los estados".`;
}

const MENSAJE_NO_CATALOGADO =
  'No identificamos ese modelo todavía — ¿nos confirmas la marca y el año? o cuéntanos qué modelo es y lo agregamos a la plataforma.';
const MENSAJE_SIN_INVENTARIO =
  'No tenemos esa pieza en inventario ahorita, pero te avisamos en cuanto algún yonke la registre.';
const MENSAJE_VEHICULO_SIN_INVENTARIO =
  'No tenemos ese vehículo en inventario ahorita, pero te avisamos en cuanto algún yonke lo registre.';
const MENSAJE_FUERA_DE_GIRO =
  'Este buscador es solo para encontrar autopartes usadas en yonkes — no identificamos una búsqueda de pieza o vehículo en tu mensaje.';
const MENSAJE_PARSEO_PARCIAL =
  'Detectamos qué pieza buscas, pero no la marca/modelo del vehículo — cuéntanos eso también. Ej: "defensa delantera para tsuru 2010"';

function obtenerIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

// Escrituras de analítica/seguimiento: nunca deben tumbar la respuesta al usuario.
// Si Firestore las rechaza (ej. faltan reglas de seguridad para la colección), se
// registra el error pero el usuario igual recibe el mensaje correcto.
async function guardarSinBloquear(coleccion, datos) {
  try {
    await addDoc(collection(dbServer, coleccion), datos);
  } catch (error) {
    console.error(`[buscar] No se pudo guardar en "${coleccion}" (revisar reglas de Firestore)`, {
      code: error?.code,
      message: error?.message,
    });
  }
}

// Aviso al WhatsApp del admin cuando un cliente deja su contacto en una búsqueda que no dio
// nada útil — cierra el ciclo de busquedas_pendientes (antes solo se guardaba, nadie se
// enteraba). Solo se llama cuando contacto existe; notificarAdmin ya traga sus propios errores.
// Cae de vuelta al texto original si no se extrajo nada estructurado (ej. no_interpretada
// puro), para que el admin nunca reciba un aviso vacío sin poder saber qué buscaba el cliente.
async function avisarContactoPendiente({ texto, pieza, marca, modelo, anio, estado, contacto }) {
  const vehiculo = [marca, modelo, anio].filter(Boolean).join(' ');
  const detalle = [pieza, vehiculo].filter(Boolean).join(' ') || texto || '(sin detalle)';
  const mensaje = `🔔 Búsqueda pendiente en Mecanix\n\nBuscaban: ${detalle}\nEstado: ${estado}\nContacto del cliente: ${contacto}\n\nRevisa el panel para dar seguimiento.`;
  await notificarAdmin(mensaje);
}

// Único punto de escritura a busquedas_pendientes + aviso al admin. Se llama en TODO camino
// de retorno "sin resultado útil" que tenga contacto (sin_inventario, fuera_de_catalogo,
// no_interpretada, parseo_parcial, fuera_de_giro) — antes esta lógica estaba duplicada en dos
// ramas (sin_inventario en resolverBusqueda/resolverBusquedaVehiculo) y el resto de las ramas
// simplemente no guardaba el número, aunque tieneContacto quedara en true. Al centralizarlo
// acá, una rama nueva que olvide llamarlo no puede volver a perder un contacto en silencio.
// No hace nada si no hay contacto (nunca escribe un doc vacío ni dispara un aviso de más).
async function persistirContactoSiExiste(contacto, { texto, pieza = null, marca = null, modelo = null, anio = null, estado }) {
  if (!contacto) return;
  await guardarSinBloquear('busquedas_pendientes', {
    pieza, marca, modelo, anio,
    textoOriginal: texto,
    estado,
    fecha: new Date(),
    contacto,
    atendido: false,
  });
  await avisarContactoPendiente({ texto, pieza, marca, modelo, anio, estado, contacto });
}

// Paso 3 en adelante (búsqueda CON pieza): ya con {pieza, marca, modelo, anio} resueltos
// (extracción exacta o confirmación de sugerencia difusa), valida contra el catálogo vivo
// y consulta inventario filtrado por esa pieza.
async function resolverBusqueda({ pieza, marca, modelo, anio }, texto, contacto, origen, estadoFiltro) {
  const tieneContacto = Boolean(contacto);

  if (!modelo) {
    await persistirContactoSiExiste(contacto, { texto, pieza, marca, modelo: null, anio, estado: 'fuera_de_catalogo' });
    await registrarBusqueda({ texto, estado: 'fuera_de_catalogo', pieza, marca, modelo: null, anio, origen, tieneContacto });
    return NextResponse.json({ estado: 'no_catalogado', mensaje: MENSAJE_NO_CATALOGADO });
  }

  // El catálogo vivo (config/catalogoVehiculos) se nutre principalmente de vehículos — un
  // motor/transmisión suelto puede existir sin que su marca/modelo esté ahí (registros viejos,
  // o "Actualizar catálogo" en admin que hoy solo escanea vehiculos). Por eso el check de
  // catálogo y la búsqueda de motores corren en PARALELO: solo se declara "no_catalogado" si
  // NINGUNO de los dos encuentra nada — un motor real no debe quedar invisible por esto.
  const [enCatalogo, resultadoMotores] = await Promise.all([
    existeEnCatalogoVivo(marca, modelo),
    consultarMotoresTransmisiones({ marca, modelo, anio, estado: estadoFiltro }),
  ]);

  // El estado elegido no tiene NINGÚN yonke (distinto de "tiene yonkes pero nada coincide") —
  // se resuelve antes que "no_catalogado" para no decirle a un cliente que el modelo no existe
  // cuando en realidad es que su estado todavía no tiene yonkes registrados.
  if (resultadoMotores.sinYonkesEnEstado) {
    return NextResponse.json({ estado: 'sin_yonkes_estado', mensaje: await mensajeSinYonkesEnEstado(estadoFiltro) });
  }

  const { motores, transmisiones, motoresCercanos, transmisionesCercanos } = resultadoMotores;
  const totalMotoresTransmisiones = motores.length + transmisiones.length + motoresCercanos.length + transmisionesCercanos.length;

  if (!enCatalogo && totalMotoresTransmisiones === 0) {
    await persistirContactoSiExiste(contacto, { texto, pieza, marca, modelo, anio, estado: 'fuera_de_catalogo' });
    await registrarBusqueda({ texto, estado: 'fuera_de_catalogo', pieza, marca, modelo, anio, origen, tieneContacto });
    return NextResponse.json({ estado: 'no_catalogado', mensaje: MENSAJE_NO_CATALOGADO });
  }

  const { resultados, resultadosCercanos, tipoResultado, piezaNoEncontrada } = enCatalogo
    ? await consultarInventario({ marca, modelo, anio, pieza, estado: estadoFiltro })
    : { resultados: [], resultadosCercanos: [], tipoResultado: 'cualquierAno', piezaNoEncontrada: false };

  // "Sin inventario" solo cuando NADA se encontró (ni exacto, ni cercano, ni motores/
  // transmisiones) — un motor/transmisión o un año cercano hallado cuenta como resultado
  // real (estado 'ok'), igual que una pieza, para no mentir en las métricas de demanda
  // insatisfecha.
  if (resultados.length === 0 && resultadosCercanos.length === 0 && totalMotoresTransmisiones === 0) {
    await persistirContactoSiExiste(contacto, { texto, pieza, marca, modelo, anio, estado: 'sin_inventario' });
    await registrarBusqueda({
      texto, estado: 'sin_inventario', pieza, marca, modelo, anio,
      tipoResultado, totalResultados: 0, origen, tieneContacto,
    });
    return NextResponse.json({ estado: 'sin_inventario', mensaje: MENSAJE_SIN_INVENTARIO });
  }

  await registrarBusqueda({
    texto, estado: 'ok', pieza, marca, modelo, anio,
    tipoResultado, totalResultados: resultados.length + resultadosCercanos.length + totalMotoresTransmisiones, piezaNoEncontrada, origen, tieneContacto,
  });

  return NextResponse.json({
    estado: 'resultados', resultados, resultadosCercanos, tipoResultado, piezaNoEncontrada,
    resultadosMotores: motores, resultadosMotoresCercanos: motoresCercanos,
    resultadosTransmisiones: transmisiones, resultadosTransmisionesCercanos: transmisionesCercanos,
    marca, modelo, anio, pieza,
  });
}

// Búsqueda de solo vehículo (sin pieza): el usuario probablemente quiere explorar todo
// el inventario disponible de ese vehículo, no un error. Mismo catálogo vivo, pero
// consultarInventarioVehiculo no filtra/separa por pieza.
async function resolverBusquedaVehiculo({ marca, modelo, anio }, texto, contacto, origen, estadoFiltro) {
  const tieneContacto = Boolean(contacto);

  // Ver nota equivalente en resolverBusqueda(): catálogo vivo y motores en paralelo, para que
  // un motor/transmisión real no quede invisible solo porque su marca/modelo no está en el
  // catálogo (que hoy se nutre principalmente de vehículos).
  const [enCatalogo, resultadoMotores] = await Promise.all([
    existeEnCatalogoVivo(marca, modelo),
    consultarMotoresTransmisiones({ marca, modelo, anio, estado: estadoFiltro }),
  ]);

  if (resultadoMotores.sinYonkesEnEstado) {
    return NextResponse.json({ estado: 'sin_yonkes_estado', mensaje: await mensajeSinYonkesEnEstado(estadoFiltro) });
  }

  const { motores, transmisiones, motoresCercanos, transmisionesCercanos } = resultadoMotores;
  const totalMotoresTransmisiones = motores.length + transmisiones.length + motoresCercanos.length + transmisionesCercanos.length;

  if (!enCatalogo && totalMotoresTransmisiones === 0) {
    await persistirContactoSiExiste(contacto, { texto, pieza: null, marca, modelo, anio, estado: 'fuera_de_catalogo' });
    await registrarBusqueda({ texto, estado: 'fuera_de_catalogo', pieza: null, marca, modelo, anio, origen, tieneContacto });
    return NextResponse.json({ estado: 'no_catalogado', mensaje: MENSAJE_NO_CATALOGADO });
  }

  const { resultados, resultadosCercanos, tipoResultado } = enCatalogo
    ? await consultarInventarioVehiculo({ marca, modelo, anio, estado: estadoFiltro })
    : { resultados: [], resultadosCercanos: [], tipoResultado: 'cualquierAno' };

  if (resultados.length === 0 && resultadosCercanos.length === 0 && totalMotoresTransmisiones === 0) {
    await persistirContactoSiExiste(contacto, { texto, pieza: null, marca, modelo, anio, estado: 'sin_inventario' });
    await registrarBusqueda({
      texto, estado: 'sin_inventario', pieza: null, marca, modelo, anio,
      tipoResultado, totalResultados: 0, origen, tieneContacto,
    });
    return NextResponse.json({ estado: 'sin_inventario', mensaje: MENSAJE_VEHICULO_SIN_INVENTARIO });
  }

  await registrarBusqueda({
    texto, estado: 'ok', pieza: null, marca, modelo, anio,
    tipoResultado, totalResultados: resultados.length + resultadosCercanos.length + totalMotoresTransmisiones, piezaNoEncontrada: false, origen, tieneContacto,
  });

  const partesEncabezado = [marca, modelo, anio].filter(Boolean);
  return NextResponse.json({
    estado: 'resultados', resultados, resultadosCercanos, tipoResultado,
    piezaNoEncontrada: false,
    resultadosMotores: motores, resultadosMotoresCercanos: motoresCercanos,
    resultadosTransmisiones: transmisiones, resultadosTransmisionesCercanos: transmisionesCercanos,
    marca, modelo, anio, pieza: null,
    encabezadoVehiculo: resultados.length > 0
      ? `Esto es lo que tenemos disponible para ${partesEncabezado.join(' ')}:`
      : null,
  });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ estado: 'error', mensaje: 'Solicitud inválida' }, { status: 400 });
  }

  const texto = typeof body?.texto === 'string' ? body.texto : '';
  const contacto = typeof body?.contacto === 'string' ? body.contacto.trim() : '';
  const confirmado = body?.confirmado;
  // 'whatsapp' queda reservado para cuando exista el webhook correspondiente; hoy siempre 'web'.
  const origen = body?.origen === 'whatsapp' ? 'whatsapp' : 'web';
  // Filtro geográfico opcional del buscador (Fase 3 del sistema de estados). Default 'todos'
  // para que un cliente que nunca toca el selector obtenga EXACTAMENTE el comportamiento de
  // hoy — cero filtro geográfico, igual que antes de que este parámetro existiera.
  const estadoFiltro = typeof body?.estado === 'string' && body.estado ? body.estado : 'todos';

  // Rate limit: se aplica siempre (flujo normal o confirmación), antes de tocar Firestore
  // para la búsqueda en sí. Si el propio chequeo falla (ej. reglas de Firestore aún no
  // configuradas para busqueda_rate_limit), se deja pasar en vez de romper el feature
  // completo — se pierde temporalmente la protección, no la funcionalidad.
  const ip = obtenerIp(request);
  let permitidoPorRate = true;
  try {
    permitidoPorRate = await permitirBusqueda(ip);
  } catch (error) {
    console.error('[buscar] No se pudo verificar rate limit (revisar reglas de Firestore para busqueda_rate_limit)', {
      code: error?.code,
      message: error?.message,
    });
  }
  if (!permitidoPorRate) {
    return NextResponse.json({ estado: 'rate_limited', mensaje: MENSAJE_RATE_LIMIT });
  }

  // Modo confirmación: el usuario ya aceptó una sugerencia difusa ("¿Quisiste decir...?").
  // Se salta Capa 0/Capa 1 por completo y se va directo al catálogo/inventario.
  if (confirmado && (typeof confirmado.marca === 'string' || typeof confirmado.modelo === 'string')) {
    const datos = {
      pieza: typeof confirmado.pieza === 'string' ? confirmado.pieza : null,
      marca: confirmado.marca || null,
      modelo: confirmado.modelo || null,
      anio: typeof confirmado.anio === 'number' ? confirmado.anio : null,
    };
    return datos.pieza
      ? resolverBusqueda(datos, texto, contacto, origen, estadoFiltro)
      : resolverBusquedaVehiculo(datos, texto, contacto, origen, estadoFiltro);
  }

  const tieneContacto = Boolean(contacto);

  // Capa 0: filtro barato, sin Firestore.
  const { permitido } = filtrarPrevio(texto);
  if (!permitido) {
    await persistirContactoSiExiste(contacto, { texto, estado: 'no_interpretada' });
    await registrarBusqueda({ texto, estado: 'no_interpretada', origen, tieneContacto });
    return NextResponse.json({ estado: 'rechazado', mensaje: MENSAJE_RECHAZO_CAPA0 });
  }

  // Capa 1: extracción de intención (reglas + catálogo combinado estático+vivo, con fuzzy
  // matching). Async porque el catálogo vivo se lee de Firestore (con caché de 10 min —
  // ver catalogoCombinado.js), no bloquea el resto del flujo más de lo que ya hacía.
  const intencion = await extraerIntencion(texto);

  // Fuera de giro: texto pasó Capa 0 pero no es una búsqueda real de autopartes (otro
  // oficio/servicio, solo saludo, o venta de vehículo completo). Se evalúa antes que
  // cualquier otra rama porque debe poder ganarle tanto a "confirmar" como a "reconocido".
  const { esFueraDeGiro, categoria } = await detectarFueraDeGiro(texto, intencion);
  if (esFueraDeGiro) {
    await persistirContactoSiExiste(contacto, {
      texto, pieza: intencion.pieza, marca: intencion.marca, modelo: intencion.modelo, anio: intencion.anio,
      estado: 'fuera_de_giro',
    });
    await registrarBusqueda({
      texto, estado: 'fuera_de_giro', subtipo: categoria,
      pieza: intencion.pieza, marca: intencion.marca, modelo: intencion.modelo, anio: intencion.anio,
      origen, tieneContacto,
    });
    return NextResponse.json({ estado: 'fuera_de_giro', mensaje: MENSAJE_FUERA_DE_GIRO });
  }

  if (!intencion.reconocido && !intencion.vehiculoReconocido) {
    // Se extrajo una pieza pero ningún dato de vehículo: parseo parcial, distinto de un
    // texto donde Capa 1 no encontró absolutamente nada (no_interpretada).
    const estadoLog = intencion.pieza ? 'parseo_parcial' : 'no_interpretada';
    await persistirContactoSiExiste(contacto, {
      texto, pieza: intencion.pieza, marca: intencion.marca, modelo: intencion.modelo, anio: intencion.anio,
      estado: estadoLog,
    });
    await registrarBusqueda({ texto, estado: estadoLog, pieza: intencion.pieza, anio: intencion.anio, origen, tieneContacto });
    return NextResponse.json({
      estado: estadoLog,
      mensaje: estadoLog === 'parseo_parcial' ? MENSAJE_PARSEO_PARCIAL : MENSAJE_RECHAZO_CAPA0,
    });
  }

  // Marca/modelo resuelto por coincidencia difusa (typo): pedir confirmación antes de
  // consultar Firestore, en vez de corregir en silencio. Aplica igual con o sin pieza.
  if (intencion.requiereConfirmacion) {
    const partes = [intencion.marca, intencion.modelo, intencion.anio].filter(Boolean);
    return NextResponse.json({
      estado: 'confirmar',
      mensaje: `¿Quisiste decir ${partes.join(' ')}?`,
      sugerencia: {
        pieza: intencion.pieza, marca: intencion.marca, modelo: intencion.modelo, anio: intencion.anio,
      },
    });
  }

  if (intencion.reconocido) {
    return resolverBusqueda(intencion, texto, contacto, origen, estadoFiltro);
  }

  // Marca reconocida pero el "modelo" mencionado no coincide con ninguno conocido (ej.
  // "volkswagen atlas 2020" — Atlas no existe en el catálogo): NUNCA hacer fallback
  // silencioso a buscar toda la marca, mostraría vehículos de un modelo distinto al pedido.
  if (intencion.modeloDesconocido) {
    await persistirContactoSiExiste(contacto, {
      texto, pieza: null, marca: intencion.marca, modelo: null, anio: intencion.anio,
      estado: 'fuera_de_catalogo',
    });
    await registrarBusqueda({
      texto, estado: 'fuera_de_catalogo', pieza: null, marca: intencion.marca, modelo: null,
      anio: intencion.anio, origen, tieneContacto,
    });
    return NextResponse.json({ estado: 'no_catalogado', mensaje: MENSAJE_NO_CATALOGADO });
  }

  // Vehículo reconocido pero sin pieza (y sin ningún modelo mencionado): explorar todo
  // el inventario disponible de la marca.
  return resolverBusquedaVehiculo(intencion, texto, contacto, origen, estadoFiltro);
}
