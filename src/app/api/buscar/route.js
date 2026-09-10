import { NextResponse } from 'next/server';
import { addDoc, collection } from 'firebase/firestore';
import { dbServer } from '../../lib/firebase-server';
import { filtrarPrevio, MENSAJE_RECHAZO_CAPA0 } from '../../lib/busqueda/filtroPrevio';
import { extraerIntencion } from '../../lib/busqueda/extraerIntencion';
import { detectarFueraDeGiro } from '../../lib/busqueda/detectarFueraDeGiro';
import { registrarBusqueda } from '../../lib/busqueda/registrarBusqueda';
import { resolverGeoIp } from '../../lib/busqueda/geolocalizarIp';
import { existeEnCatalogoVivo, consultarInventario, consultarInventarioVehiculo, consultarMotoresTransmisiones } from '../../lib/busqueda/consultarInventario';
import { permitirBusqueda, MENSAJE_RATE_LIMIT } from '../../lib/busqueda/rateLimit';
import { MENSAJE_NUMERO_DE_PARTE } from '../../lib/busqueda/numeroDeParte';
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

// Modelo de ejemplo por marca para el mensaje de "búsqueda muy general" (ver
// mensajeMarcaMuyGeneral) — solo para armar un ejemplo más cercano a lo que buscó el cliente;
// si la marca no está aquí, se usa un ejemplo genérico (Chevrolet Aveo). No afecta el matching
// del buscador en absoluto, es puro texto de ayuda.
const MODELO_EJEMPLO_POR_MARCA = {
  Chevrolet: 'Cruze', Nissan: 'Sentra', Toyota: 'Corolla', Ford: 'Fiesta', Honda: 'Civic',
  Volkswagen: 'Jetta', Hyundai: 'Accent', Mazda: '3', Dodge: 'Journey', Jeep: 'Patriot',
  Chrysler: '200', RAM: '1500', Kia: 'Rio', Mitsubishi: 'Lancer', GMC: 'Sierra',
};

function mensajeMarcaMuyGeneral(marca) {
  const modelo = MODELO_EJEMPLO_POR_MARCA[marca] || 'Aveo';
  return `Tu búsqueda es muy general. Escribe también qué pieza y de qué modelo buscas. Por ejemplo: "alternador ${marca} ${modelo} 2015" o "defensa ${marca} ${modelo}".`;
}

function obtenerIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

// yonkeIds para el "Mapa de búsquedas" (spec sección 1): qué yonkes sí tenían la pieza/vehículo
// buscado. Cada resultado (pieza, motor/transmisión, exacto o cercano) trae su propio yonkeId
// — ver toResultado/toResultadoMotor en consultarInventario.js.
function recolectarYonkeIds(...listas) {
  const ids = new Set();
  for (const lista of listas) {
    for (const item of lista) {
      if (item?.yonkeId) ids.add(item.yonkeId);
    }
  }
  return [...ids];
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
async function resolverBusqueda({ pieza, marca, modelo, anio, cilindrada = null, numeroDeParteExplicito = false, numeroDeParteSospechoso = false }, texto, contacto, origen, estadoFiltro, geo) {
  const tieneContacto = Boolean(contacto);
  const datosGeo = { estadoGeografico: geo.estado, ciudad: geo.ciudad };
  // Señal explícita de SKU/número de parte ("sku 609", "código 609"): 100% segura, así que
  // sustituye el mensaje de "no encontrado" en CUALQUIER punto de esta función donde de otro
  // modo se respondería con no_catalogado/sin_inventario — nunca antes de intentar la búsqueda
  // normal (todos los usos de esto están DESPUÉS del intento real de búsqueda/query).
  // La señal por descarte (numeroDeParteSospechoso) solo se suma cuando `modelo` YA está
  // resuelto (incluirSospechoso=true) — si no hay modelo, el número sospechoso podría ser en
  // realidad un modelo real sin catalogar todavía (ej. "720"), y ahí es más seguro el mensaje
  // normal de "no identificamos el modelo" que asumir un SKU.
  const estadoYMensajeNoEncontrado = (estadoNormal, mensajeNormal, incluirSospechoso = false) =>
    (numeroDeParteExplicito || (incluirSospechoso && numeroDeParteSospechoso))
      ? { estado: 'numero_de_parte', mensaje: MENSAJE_NUMERO_DE_PARTE }
      : { estado: estadoNormal, mensaje: mensajeNormal };

  // Un motor/transmisión buscado por cilindrada ("motor chevrolet 3.6", o "motor 3.6" sin
  // marca) no necesita modelo de vehículo — se identifica por su propio tamaño. Para el resto
  // de las piezas (necesitan saber a qué modelo de auto pertenecen) el gate de siempre aplica.
  const esBusquedaMotorPorCilindrada = cilindrada != null && (pieza === 'Motor' || pieza === 'Transmisión');
  if (!modelo && !esBusquedaMotorPorCilindrada) {
    await persistirContactoSiExiste(contacto, { texto, pieza, marca, modelo: null, anio, estado: 'fuera_de_catalogo' });
    await registrarBusqueda({ texto, estado: 'fuera_de_catalogo', pieza, marca, modelo: null, anio, origen, tieneContacto, ...datosGeo });
    return NextResponse.json(estadoYMensajeNoEncontrado('no_catalogado', MENSAJE_NO_CATALOGADO));
  }

  // El catálogo vivo (config/catalogoVehiculos) se nutre principalmente de vehículos — un
  // motor/transmisión suelto, o una PIEZA suelta, puede existir sin que su marca/modelo esté
  // ahí (registros viejos, o marca/modelo que nunca se registró como vehículo completo). Por
  // eso el check de catálogo, motores y consultarInventario() (que ahora también busca piezas
  // sueltas, ver ese archivo) corren SIEMPRE en PARALELO: solo se declara "no_catalogado" si
  // NINGUNO de los tres encuentra nada — ni un motor ni una pieza suelta reales deben quedar
  // invisibles por esto.
  //
  // Búsqueda por cilindrada: se fuerza enCatalogo=false Y se salta consultarInventario() por
  // completo — esa colección no tiene cilindrada y mezclaría motores de cualquier tamaño en
  // los resultados. El único inventario que sí filtra por cilindrada es el de
  // motores/transmisiones sueltos (consultarMotoresTransmisiones, abajo).
  const [enCatalogo, resultadoMotores, resultadoInventario] = await Promise.all([
    esBusquedaMotorPorCilindrada ? Promise.resolve(false) : existeEnCatalogoVivo(marca, modelo),
    consultarMotoresTransmisiones({ marca, modelo, anio, cilindrada, estado: estadoFiltro }),
    esBusquedaMotorPorCilindrada
      ? Promise.resolve({ resultados: [], resultadosCercanos: [], tipoResultado: 'cualquierAno', piezaNoEncontrada: false })
      : consultarInventario({ marca, modelo, anio, pieza, estado: estadoFiltro }),
  ]);

  // El estado elegido no tiene NINGÚN yonke (distinto de "tiene yonkes pero nada coincide") —
  // se resuelve antes que "no_catalogado" para no decirle a un cliente que el modelo no existe
  // cuando en realidad es que su estado todavía no tiene yonkes registrados.
  if (resultadoMotores.sinYonkesEnEstado) {
    return NextResponse.json({ estado: 'sin_yonkes_estado', mensaje: await mensajeSinYonkesEnEstado(estadoFiltro) });
  }

  const { motores, transmisiones, motoresCercanos, transmisionesCercanos } = resultadoMotores;
  const totalMotoresTransmisiones = motores.length + transmisiones.length + motoresCercanos.length + transmisionesCercanos.length;
  const { resultados, resultadosCercanos, tipoResultado, piezaNoEncontrada } = resultadoInventario;

  if (!enCatalogo && totalMotoresTransmisiones === 0 && resultados.length === 0 && resultadosCercanos.length === 0) {
    await persistirContactoSiExiste(contacto, { texto, pieza, marca, modelo, anio, estado: 'fuera_de_catalogo' });
    await registrarBusqueda({ texto, estado: 'fuera_de_catalogo', pieza, marca, modelo, anio, origen, tieneContacto, ...datosGeo });
    // incluirSospechoso=true: para llegar aquí `modelo` ya está resuelto o la búsqueda es por
    // cilindrada (no necesita modelo) — en ningún caso el número sospechoso puede ser en
    // realidad el modelo, a diferencia del gate de arriba.
    return NextResponse.json(estadoYMensajeNoEncontrado('no_catalogado', MENSAJE_NO_CATALOGADO, true));
  }

  // "Sin inventario" solo cuando NADA se encontró (ni exacto, ni cercano, ni motores/
  // transmisiones) — un motor/transmisión o un año cercano hallado cuenta como resultado
  // real (estado 'ok'), igual que una pieza, para no mentir en las métricas de demanda
  // insatisfecha.
  if (resultados.length === 0 && resultadosCercanos.length === 0 && totalMotoresTransmisiones === 0) {
    // Aquí SÍ se acepta también la señal por descarte (numeroDeParteSospechoso, ej. "pistón
    // jetta 2015 609"): la búsqueda normal ya corrió completa (marca+modelo+año) y no encontró
    // nada, así que un número suelto que sobra ya no puede ser un modelo real sin catalogar —
    // eso se habría resuelto arriba. Es justo el "último recurso" que pide la tarea.
    const esNumeroDeParte = numeroDeParteExplicito || numeroDeParteSospechoso;
    await persistirContactoSiExiste(contacto, { texto, pieza, marca, modelo, anio, estado: esNumeroDeParte ? 'numero_de_parte' : 'sin_inventario' });
    await registrarBusqueda({
      texto, estado: esNumeroDeParte ? 'numero_de_parte' : 'sin_inventario', pieza, marca, modelo, anio,
      tipoResultado, totalResultados: 0, origen, tieneContacto, ...datosGeo,
    });
    return NextResponse.json(esNumeroDeParte
      ? { estado: 'numero_de_parte', mensaje: MENSAJE_NUMERO_DE_PARTE }
      : { estado: 'sin_inventario', mensaje: MENSAJE_SIN_INVENTARIO });
  }

  const yonkeIds = recolectarYonkeIds(resultados, resultadosCercanos, motores, motoresCercanos, transmisiones, transmisionesCercanos);
  await registrarBusqueda({
    texto, estado: 'ok', pieza, marca, modelo, anio,
    tipoResultado, totalResultados: resultados.length + resultadosCercanos.length + totalMotoresTransmisiones, piezaNoEncontrada, origen, tieneContacto,
    ...datosGeo, yonkeIds,
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
async function resolverBusquedaVehiculo({ marca, modelo, anio, numeroDeParteExplicito = false }, texto, contacto, origen, estadoFiltro, geo) {
  const tieneContacto = Boolean(contacto);
  const datosGeo = { estadoGeografico: geo.estado, ciudad: geo.ciudad };
  // Marca sola, sin modelo NI año (ej. "chevrolet" a secas): no hay nada más con qué acotar la
  // búsqueda. Solo se OFRECE la ayuda si de verdad no hay ningún resultado que mostrar (ver los
  // dos usos de estadoYMensajeNoEncontrado abajo) — si la marca sí tiene inventario disponible,
  // la navegación por marca sigue funcionando exactamente igual que hoy (ver el return final).
  // pieza siempre es null aquí (contrato de esta función) y cilindrada nunca llega a esta rama
  // (intencion.sugerenciaCilindrada la intercepta antes en route.js), así que marca+modelo+año
  // son las únicas señales relevantes que hay que revisar.
  const esMarcaMuyGeneral = !modelo && anio == null;
  // Sin pieza (contrato de esta función), la señal por descarte nunca aplica aquí — solo la
  // explícita ("sku 609 nissan"), que es igual de confiable con o sin pieza mencionada. La señal
  // explícita de número de parte siempre gana sobre "marca muy general" — es más específica.
  const estadoYMensajeNoEncontrado = (estadoNormal, mensajeNormal) => {
    if (numeroDeParteExplicito) return { estado: 'numero_de_parte', mensaje: MENSAJE_NUMERO_DE_PARTE };
    if (esMarcaMuyGeneral) return { estado: 'marca_muy_general', mensaje: mensajeMarcaMuyGeneral(marca) };
    return { estado: estadoNormal, mensaje: mensajeNormal };
  };
  // Mismas prioridades que arriba, pero para el `estado` que se GUARDA en analítica (distinto
  // del que ve el cliente en algunos casos — ej. el cliente ve "no_catalogado" pero se guarda
  // "fuera_de_catalogo", distinción que ya existía antes de este cambio). Antes, el primer gate
  // de abajo ni siquiera aplicaba la anulación de número de parte al guardar (quedaba registrado
  // como "fuera_de_catalogo" aunque el cliente viera el mensaje de número de parte) — se
  // corrige de paso, ya que se toca esta misma función.
  const estadoParaAnalitica = (estadoNormalAnalitica) => {
    if (numeroDeParteExplicito) return 'numero_de_parte';
    if (esMarcaMuyGeneral) return 'marca_muy_general';
    return estadoNormalAnalitica;
  };

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
    const estadoLog = estadoParaAnalitica('fuera_de_catalogo');
    await persistirContactoSiExiste(contacto, { texto, pieza: null, marca, modelo, anio, estado: estadoLog });
    await registrarBusqueda({ texto, estado: estadoLog, pieza: null, marca, modelo, anio, origen, tieneContacto, ...datosGeo });
    return NextResponse.json(estadoYMensajeNoEncontrado('no_catalogado', MENSAJE_NO_CATALOGADO));
  }

  const { resultados, resultadosCercanos, tipoResultado } = enCatalogo
    ? await consultarInventarioVehiculo({ marca, modelo, anio, estado: estadoFiltro })
    : { resultados: [], resultadosCercanos: [], tipoResultado: 'cualquierAno' };

  if (resultados.length === 0 && resultadosCercanos.length === 0 && totalMotoresTransmisiones === 0) {
    const estadoLog = estadoParaAnalitica('sin_inventario');
    await persistirContactoSiExiste(contacto, { texto, pieza: null, marca, modelo, anio, estado: estadoLog });
    await registrarBusqueda({
      texto, estado: estadoLog, pieza: null, marca, modelo, anio,
      tipoResultado, totalResultados: 0, origen, tieneContacto, ...datosGeo,
    });
    return NextResponse.json(estadoYMensajeNoEncontrado('sin_inventario', MENSAJE_VEHICULO_SIN_INVENTARIO));
  }

  const yonkeIds = recolectarYonkeIds(resultados, resultadosCercanos, motores, motoresCercanos, transmisiones, transmisionesCercanos);
  await registrarBusqueda({
    texto, estado: 'ok', pieza: null, marca, modelo, anio,
    tipoResultado, totalResultados: resultados.length + resultadosCercanos.length + totalMotoresTransmisiones, piezaNoEncontrada: false, origen, tieneContacto,
    ...datosGeo, yonkeIds,
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

  // Geolocalización por IP para el "Mapa de búsquedas" (spec sección 1-2) — nunca lanza, cae a
  // {estado: 'desconocido', ciudad: null} si falla o no resuelve. Se calcula una sola vez por
  // request y se pasa a resolverBusqueda/resolverBusquedaVehiculo, igual que estadoFiltro.
  const geo = await resolverGeoIp(ip);

  // Modo confirmación: el usuario ya aceptó una sugerencia difusa ("¿Quisiste decir...?") o una
  // aclaración de cilindrada ("¿Buscas el motor 3.6 de Chevrolet?"). Se salta Capa 0/Capa 1 por
  // completo y se va directo al catálogo/inventario. La aclaración de cilindrada sin marca
  // ("3.6" solo) no trae marca ni modelo como string (ambos null), por eso también cuenta como
  // confirmación cuando cilindrada es un número — si no, este `if` no dispararía y el texto
  // original ("3.6") se volvería a parsear desde cero, repitiendo la misma pregunta sin fin.
  if (confirmado && (typeof confirmado.marca === 'string' || typeof confirmado.modelo === 'string' || typeof confirmado.cilindrada === 'number')) {
    const datos = {
      pieza: typeof confirmado.pieza === 'string' ? confirmado.pieza : null,
      marca: confirmado.marca || null,
      modelo: confirmado.modelo || null,
      anio: typeof confirmado.anio === 'number' ? confirmado.anio : null,
      cilindrada: typeof confirmado.cilindrada === 'number' ? confirmado.cilindrada : null,
    };
    return datos.pieza
      ? resolverBusqueda(datos, texto, contacto, origen, estadoFiltro, geo)
      : resolverBusquedaVehiculo(datos, texto, contacto, origen, estadoFiltro, geo);
  }

  const tieneContacto = Boolean(contacto);

  // Capa 0: filtro barato, sin Firestore.
  const { permitido } = filtrarPrevio(texto);
  if (!permitido) {
    await persistirContactoSiExiste(contacto, { texto, estado: 'no_interpretada' });
    await registrarBusqueda({ texto, estado: 'no_interpretada', origen, tieneContacto, estadoGeografico: geo.estado, ciudad: geo.ciudad });
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
      origen, tieneContacto, estadoGeografico: geo.estado, ciudad: geo.ciudad,
    });
    return NextResponse.json({ estado: 'fuera_de_giro', mensaje: MENSAJE_FUERA_DE_GIRO });
  }

  // Cilindrada ambigua ("chevrolet 3.6", o "3.6" solo): nunca dijo "motor"/"transmisión" ni
  // resolvió un modelo real de vehículo, así que en vez de "no encontrado" se OFRECE la
  // aclaración — un decimal así casi siempre es cilindrada, pero no se asume, se pregunta.
  // Va ANTES que "reconocido/vehiculoReconocido", "requiereConfirmacion" y "modeloDesconocido"
  // porque intencion.sugerenciaCilindrada solo existe cuando pieza es null (ver
  // extraerIntencion.js), así que nunca le quita una búsqueda ya resuelta a esas ramas — pero
  // sí les gana el turno a un typo de marca ("chevrolt 3.6") o a un "modelo desconocido"
  // ("chevrolet 3.6" sin más) que de otro modo tratarían la cilindrada como palabra sin
  // explicar y responderían con el mensaje genérico de "no identificamos el modelo".
  if (intencion.sugerenciaCilindrada) {
    const { marca: marcaSug, anio: anioSug, cilindrada: cilindradaSug } = intencion.sugerenciaCilindrada;
    const mensaje = marcaSug
      ? `¿Buscas el motor ${cilindradaSug} de ${marcaSug}${anioSug ? ` ${anioSug}` : ''}?`
      : `¿Buscas un motor o transmisión de ${cilindradaSug} litros?`;
    return NextResponse.json({ estado: 'confirmar', mensaje, sugerencia: intencion.sugerenciaCilindrada });
  }

  if (!intencion.reconocido && !intencion.vehiculoReconocido) {
    // Número de parte / SKU sin ninguna marca/modelo mencionado (ej. "pistón 609 std", "sku
    // 609"): sin esto caería en "parseo_parcial" genérico. Ni marca ni modelo están presentes
    // (vehiculoReconocido es false), así que no hay ninguna búsqueda real que este mensaje le
    // esté quitando el turno — nunca hubo a dónde ir sin esa información.
    const esNumeroDeParte = intencion.numeroDeParteExplicito || intencion.numeroDeParteSospechoso;
    if (esNumeroDeParte) {
      await persistirContactoSiExiste(contacto, {
        texto, pieza: intencion.pieza, marca: intencion.marca, modelo: intencion.modelo, anio: intencion.anio,
        estado: 'numero_de_parte',
      });
      await registrarBusqueda({
        texto, estado: 'numero_de_parte', pieza: intencion.pieza, anio: intencion.anio, origen, tieneContacto,
        estadoGeografico: geo.estado, ciudad: geo.ciudad,
      });
      return NextResponse.json({ estado: 'numero_de_parte', mensaje: MENSAJE_NUMERO_DE_PARTE });
    }

    // Se extrajo una pieza pero ningún dato de vehículo: parseo parcial, distinto de un
    // texto donde Capa 1 no encontró absolutamente nada (no_interpretada).
    const estadoLog = intencion.pieza ? 'parseo_parcial' : 'no_interpretada';
    await persistirContactoSiExiste(contacto, {
      texto, pieza: intencion.pieza, marca: intencion.marca, modelo: intencion.modelo, anio: intencion.anio,
      estado: estadoLog,
    });
    await registrarBusqueda({
      texto, estado: estadoLog, pieza: intencion.pieza, anio: intencion.anio, origen, tieneContacto,
      estadoGeografico: geo.estado, ciudad: geo.ciudad,
    });
    return NextResponse.json({
      estado: estadoLog,
      mensaje: estadoLog === 'parseo_parcial' ? MENSAJE_PARSEO_PARCIAL : MENSAJE_RECHAZO_CAPA0,
    });
  }

  // Marca/modelo resuelto por coincidencia difusa (typo): pedir confirmación antes de
  // consultar Firestore, en vez de corregir en silencio. Aplica igual con o sin pieza.
  if (intencion.requiereConfirmacion) {
    const partes = [intencion.marca, intencion.modelo, intencion.anio, intencion.cilindrada].filter(Boolean);
    return NextResponse.json({
      estado: 'confirmar',
      mensaje: `¿Quisiste decir ${partes.join(' ')}?`,
      sugerencia: {
        pieza: intencion.pieza, marca: intencion.marca, modelo: intencion.modelo, anio: intencion.anio,
        cilindrada: intencion.cilindrada,
      },
    });
  }

  if (intencion.reconocido) {
    return resolverBusqueda(intencion, texto, contacto, origen, estadoFiltro, geo);
  }

  // Marca reconocida pero el "modelo" mencionado no coincide con ninguno conocido (ej.
  // "volkswagen atlas 2020" — Atlas no existe en el catálogo): NUNCA hacer fallback
  // silencioso a buscar toda la marca, mostraría vehículos de un modelo distinto al pedido.
  if (intencion.modeloDesconocido) {
    // Solo la señal EXPLÍCITA gana aquí ("chevrolet sku 609") — la señal por descarte no
    // aplica en esta rama a propósito: la palabra sin explicar bien podría ser un modelo real
    // que simplemente no está catalogado todavía (ej. "720"), y el mensaje de "no
    // identificamos el modelo" ya invita a aclararlo, que es más seguro que asumir un SKU.
    const esNumeroDeParte = intencion.numeroDeParteExplicito;
    await persistirContactoSiExiste(contacto, {
      texto, pieza: null, marca: intencion.marca, modelo: null, anio: intencion.anio,
      estado: esNumeroDeParte ? 'numero_de_parte' : 'fuera_de_catalogo',
    });
    await registrarBusqueda({
      texto, estado: esNumeroDeParte ? 'numero_de_parte' : 'fuera_de_catalogo', pieza: null, marca: intencion.marca, modelo: null,
      anio: intencion.anio, origen, tieneContacto, estadoGeografico: geo.estado, ciudad: geo.ciudad,
    });
    return NextResponse.json(esNumeroDeParte
      ? { estado: 'numero_de_parte', mensaje: MENSAJE_NUMERO_DE_PARTE }
      : { estado: 'no_catalogado', mensaje: MENSAJE_NO_CATALOGADO });
  }

  // Vehículo reconocido pero sin pieza (y sin ningún modelo mencionado): explorar todo
  // el inventario disponible de la marca.
  return resolverBusquedaVehiculo(intencion, texto, contacto, origen, estadoFiltro, geo);
}
