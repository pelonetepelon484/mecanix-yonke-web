import { NextResponse } from 'next/server';
import { addDoc, collection } from 'firebase/firestore';
import { dbServer } from '../../lib/firebase-server';
import { filtrarPrevio, MENSAJE_RECHAZO_CAPA0 } from '../../lib/busqueda/filtroPrevio';
import { extraerIntencion } from '../../lib/busqueda/extraerIntencion';
import { existeEnCatalogoVivo, consultarInventario } from '../../lib/busqueda/consultarInventario';
import { permitirBusqueda, MENSAJE_RATE_LIMIT } from '../../lib/busqueda/rateLimit';

const MENSAJE_NO_CATALOGADO =
  'No identificamos ese modelo todavía — ¿nos confirmas la marca y el año? o cuéntanos qué modelo es y lo agregamos a la plataforma.';
const MENSAJE_SIN_INVENTARIO =
  'No tenemos esa pieza en inventario ahorita, pero te avisamos en cuanto algún yonke la registre.';

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

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ estado: 'error', mensaje: 'Solicitud inválida' }, { status: 400 });
  }

  const texto = typeof body?.texto === 'string' ? body.texto : '';
  const contacto = typeof body?.contacto === 'string' ? body.contacto.trim() : '';

  // Capa 0: filtro barato, sin Firestore, sin gastar rate limit.
  const { permitido } = filtrarPrevio(texto);
  if (!permitido) {
    return NextResponse.json({ estado: 'rechazado', mensaje: MENSAJE_RECHAZO_CAPA0 });
  }

  // Rate limit: después de Capa 0, antes de cualquier otro trabajo.
  // Si el propio chequeo falla (ej. reglas de Firestore aún no configuradas para
  // busqueda_rate_limit), se deja pasar la búsqueda en vez de romper el feature completo —
  // se pierde temporalmente la protección de rate limit, pero no la funcionalidad.
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

  // Capa 1: extracción de intención (reglas + catálogo de 38 marcas).
  const intencion = extraerIntencion(texto);

  if (!intencion.reconocido) {
    await guardarSinBloquear('busquedas_no_interpretadas', {
      textoOriginal: texto,
      fecha: new Date(),
    });
    return NextResponse.json({ estado: 'no_interpretado', mensaje: MENSAJE_RECHAZO_CAPA0 });
  }

  // Reconocido pero sin modelo específico: no alcanza para consultar inventario.
  if (!intencion.modelo) {
    await guardarSinBloquear('modelos_no_reconocidos', {
      textoOriginal: texto,
      piezaExtraida: intencion.pieza,
      marcaExtraida: intencion.marca,
      modeloExtraido: intencion.modelo,
      anioExtraido: intencion.anio,
      fecha: new Date(),
    });
    return NextResponse.json({ estado: 'no_catalogado', mensaje: MENSAJE_NO_CATALOGADO });
  }

  // Paso 3.1-3.2: validar contra el catálogo VIVO (config/catalogoVehiculos).
  const enCatalogo = await existeEnCatalogoVivo(intencion.marca, intencion.modelo);
  if (!enCatalogo) {
    await guardarSinBloquear('modelos_no_reconocidos', {
      textoOriginal: texto,
      piezaExtraida: intencion.pieza,
      marcaExtraida: intencion.marca,
      modeloExtraido: intencion.modelo,
      anioExtraido: intencion.anio,
      fecha: new Date(),
    });
    return NextResponse.json({ estado: 'no_catalogado', mensaje: MENSAJE_NO_CATALOGADO });
  }

  // Paso 3.3-3.5: consultar inventario real.
  const { resultados, tipoResultado, piezaNoEncontrada } = await consultarInventario({
    marca: intencion.marca,
    modelo: intencion.modelo,
    anio: intencion.anio,
    pieza: intencion.pieza,
  });

  if (resultados.length === 0) {
    await guardarSinBloquear('busquedas_pendientes', {
      pieza: intencion.pieza,
      marca: intencion.marca,
      modelo: intencion.modelo,
      anio: intencion.anio,
      textoOriginal: texto,
      fecha: new Date(),
      ...(contacto ? { contacto } : {}),
    });
    return NextResponse.json({ estado: 'sin_inventario', mensaje: MENSAJE_SIN_INVENTARIO });
  }

  return NextResponse.json({
    estado: 'resultados',
    resultados,
    tipoResultado,
    piezaNoEncontrada,
    marca: intencion.marca,
    modelo: intencion.modelo,
    anio: intencion.anio,
    pieza: intencion.pieza,
  });
}
