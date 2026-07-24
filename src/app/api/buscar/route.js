import { NextResponse } from 'next/server';
import { addDoc, collection } from 'firebase/firestore';
import { dbServer } from '../../lib/firebase-server';
import { filtrarPrevio, MENSAJE_RECHAZO_CAPA0 } from '../../lib/busqueda/filtroPrevio';
import { extraerIntencion } from '../../lib/busqueda/extraerIntencion';
import { detectarFueraDeGiro } from '../../lib/busqueda/detectarFueraDeGiro';
import { registrarBusqueda } from '../../lib/busqueda/registrarBusqueda';
import { existeEnCatalogoVivo, consultarInventario, consultarInventarioVehiculo } from '../../lib/busqueda/consultarInventario';
import { permitirBusqueda, MENSAJE_RATE_LIMIT } from '../../lib/busqueda/rateLimit';

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

// Paso 3 en adelante (búsqueda CON pieza): ya con {pieza, marca, modelo, anio} resueltos
// (extracción exacta o confirmación de sugerencia difusa), valida contra el catálogo vivo
// y consulta inventario filtrado por esa pieza.
async function resolverBusqueda({ pieza, marca, modelo, anio }, texto, contacto, origen) {
  const tieneContacto = Boolean(contacto);

  if (!modelo) {
    await registrarBusqueda({ texto, estado: 'fuera_de_catalogo', pieza, marca, modelo: null, anio, origen, tieneContacto });
    return NextResponse.json({ estado: 'no_catalogado', mensaje: MENSAJE_NO_CATALOGADO });
  }

  const enCatalogo = await existeEnCatalogoVivo(marca, modelo);
  if (!enCatalogo) {
    await registrarBusqueda({ texto, estado: 'fuera_de_catalogo', pieza, marca, modelo, anio, origen, tieneContacto });
    return NextResponse.json({ estado: 'no_catalogado', mensaje: MENSAJE_NO_CATALOGADO });
  }

  const { resultados, tipoResultado, piezaNoEncontrada } = await consultarInventario({ marca, modelo, anio, pieza });

  if (resultados.length === 0) {
    await guardarSinBloquear('busquedas_pendientes', {
      pieza, marca, modelo, anio,
      textoOriginal: texto,
      fecha: new Date(),
      ...(contacto ? { contacto } : {}),
    });
    await registrarBusqueda({
      texto, estado: 'sin_inventario', pieza, marca, modelo, anio,
      tipoResultado, totalResultados: 0, origen, tieneContacto,
    });
    return NextResponse.json({ estado: 'sin_inventario', mensaje: MENSAJE_SIN_INVENTARIO });
  }

  await registrarBusqueda({
    texto, estado: 'ok', pieza, marca, modelo, anio,
    tipoResultado, totalResultados: resultados.length, piezaNoEncontrada, origen, tieneContacto,
  });

  return NextResponse.json({
    estado: 'resultados', resultados, tipoResultado, piezaNoEncontrada,
    marca, modelo, anio, pieza,
  });
}

// Búsqueda de solo vehículo (sin pieza): el usuario probablemente quiere explorar todo
// el inventario disponible de ese vehículo, no un error. Mismo catálogo vivo, pero
// consultarInventarioVehiculo no filtra/separa por pieza.
async function resolverBusquedaVehiculo({ marca, modelo, anio }, texto, contacto, origen) {
  const tieneContacto = Boolean(contacto);

  const enCatalogo = await existeEnCatalogoVivo(marca, modelo);
  if (!enCatalogo) {
    await registrarBusqueda({ texto, estado: 'fuera_de_catalogo', pieza: null, marca, modelo, anio, origen, tieneContacto });
    return NextResponse.json({ estado: 'no_catalogado', mensaje: MENSAJE_NO_CATALOGADO });
  }

  const { resultados, tipoResultado } = await consultarInventarioVehiculo({ marca, modelo, anio });

  if (resultados.length === 0) {
    await guardarSinBloquear('busquedas_pendientes', {
      pieza: null, marca, modelo, anio,
      textoOriginal: texto,
      fecha: new Date(),
    });
    await registrarBusqueda({
      texto, estado: 'sin_inventario', pieza: null, marca, modelo, anio,
      tipoResultado, totalResultados: 0, origen, tieneContacto,
    });
    return NextResponse.json({ estado: 'sin_inventario', mensaje: MENSAJE_VEHICULO_SIN_INVENTARIO });
  }

  await registrarBusqueda({
    texto, estado: 'ok', pieza: null, marca, modelo, anio,
    tipoResultado, totalResultados: resultados.length, piezaNoEncontrada: false, origen, tieneContacto,
  });

  const partesEncabezado = [marca, modelo, anio].filter(Boolean);
  return NextResponse.json({
    estado: 'resultados', resultados, tipoResultado,
    piezaNoEncontrada: false,
    marca, modelo, anio, pieza: null,
    encabezadoVehiculo: `Esto es lo que tenemos disponible para ${partesEncabezado.join(' ')}:`,
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
      ? resolverBusqueda(datos, texto, contacto, origen)
      : resolverBusquedaVehiculo(datos, texto, contacto, origen);
  }

  const tieneContacto = Boolean(contacto);

  // Capa 0: filtro barato, sin Firestore.
  const { permitido } = filtrarPrevio(texto);
  if (!permitido) {
    await registrarBusqueda({ texto, estado: 'no_interpretada', origen, tieneContacto });
    return NextResponse.json({ estado: 'rechazado', mensaje: MENSAJE_RECHAZO_CAPA0 });
  }

  // Capa 1: extracción de intención (reglas + catálogo de 38 marcas, con fuzzy matching).
  const intencion = extraerIntencion(texto);

  // Fuera de giro: texto pasó Capa 0 pero no es una búsqueda real de autopartes (otro
  // oficio/servicio, solo saludo, o venta de vehículo completo). Se evalúa antes que
  // cualquier otra rama porque debe poder ganarle tanto a "confirmar" como a "reconocido".
  const { esFueraDeGiro, categoria } = await detectarFueraDeGiro(texto, intencion);
  if (esFueraDeGiro) {
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
    return resolverBusqueda(intencion, texto, contacto, origen);
  }

  // Vehículo reconocido pero sin pieza: explorar todo el inventario disponible.
  return resolverBusquedaVehiculo(intencion, texto, contacto, origen);
}
