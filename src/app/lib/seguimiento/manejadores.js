import { NextResponse } from 'next/server';
import { MENSAJES_SEGUIMIENTO, esTokenSeguimiento, seguimientoPublico } from '../../../lib/seguimiento';
import { crearLimiteEnMemoria } from '../pedidosClientes/manejadores';

// Lógica de GET /api/seguimiento/{token} (mismo patrón que /api/mi-pedido): todo lo que toca
// Firestore, el reloj y la sal llega en `deps` (las reales en servicio.js), así las pruebas corren
// sin Firestore. Falla cerrada: sin identidad de servicio, sin config/ordenes.seguimientoHabilitado
// == true o si la bandera no se puede leer, responde "no disponible".
// Cualquier falla de token (mal formado, no existe, vencido, documento raro) responde EXACTAMENTE
// igual ("no encontrado"), para no revelar nada. La respuesta sale de seguimientoPublico() (lista
// blanca): nunca folio, tallerId, datos del cliente, placas ni precios.

export const MAX_CONSULTAS_SEGUIMIENTO_MINUTO = 20;
const MINUTO = 60 * 1000;

function json(cuerpo, status = 200) {
  return NextResponse.json(cuerpo, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer' } });
}
const noDisponible = () => json({ ok: false, disponible: false, mensaje: MENSAJES_SEGUIMIENTO.noDisponible }, 503);
const noEncontrado = () => json({ ok: false, mensaje: MENSAJES_SEGUIMIENTO.noEncontrado }, 404);

function obtenerIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

export function crearManejadoresSeguimiento(deps) {
  // Límite en memoria por instancia (como /mi-pedido): protege la cuota sin gastar una escritura
  // por consulta. El token tiene 256 bits: adivinarlo no es viable aunque el límite no sea global.
  const limiteEnMemoria = deps.limiteEnMemoria ?? crearLimiteEnMemoria();

  async function prepararDb() {
    try {
      const db = await deps.obtenerDb();
      if (!db) return null;
      return (await deps.habilitado(db)) ? db : null;
    } catch (error) {
      console.error('[seguimiento] No se pudo preparar la conexión de servicio', { message: error?.message });
      return null;
    }
  }

  function consultaPermitida(request) {
    const ventana = Math.floor(deps.ahora().getTime() / MINUTO);
    return limiteEnMemoria(deps.claveLimite('seguimiento', obtenerIp(request), ventana), MAX_CONSULTAS_SEGUIMIENTO_MINUTO, ventana);
  }

  async function consultar(request, token) {
    const db = await prepararDb();
    if (!db) return noDisponible();
    if (!consultaPermitida(request)) return json({ ok: false, mensaje: MENSAJES_SEGUIMIENTO.limiteConsultas }, 429);
    if (!esTokenSeguimiento(token)) return noEncontrado();
    try {
      // El documento se busca DIRECTO por la huella SHA-256 del token (su ID). No hay un secreto
      // guardado contra el cual comparar (como codigoHash en /mi-pedido): quien no tiene el token no
      // puede calcular la huella, y la búsqueda por ID no depende del contenido del token.
      const datos = await deps.leerSeguimiento(db, deps.hashCodigo(token));
      const publico = datos ? seguimientoPublico(datos, deps.ahora()) : null;
      if (!publico) return noEncontrado();
      return json({ ok: true, seguimiento: publico });
    } catch (error) {
      console.error('[seguimiento] No se pudo leer el enlace', { code: error?.code, message: error?.message });
      return json({ ok: false, mensaje: MENSAJES_SEGUIMIENTO.noDisponible }, 500);
    }
  }

  return { consultar };
}
