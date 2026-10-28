import { NextResponse } from 'next/server';
import {
  bloqueDeInventario, buscadorRefaccionesEncendido, indiceDeBusqueda, refaccionariasActivas, visibleAhora,
} from '../../../lib/refaccionariaPublica';
import { buscarPiezasNuevas } from '../../../lib/buscarPiezasNuevas';
import { permitirBusqueda, MENSAJE_RATE_LIMIT } from '../../../lib/busqueda/rateLimit';
import { paginaResultados } from '../../../../lib/buscadorRefacciones';

// Buscador "Piezas nuevas" (etapa 4), aparte de /api/buscar (yonkes). Detrás de
// config/refaccionarias.buscador: apagada responde 404 sin leer nada más. Usa el mismo límite por
// IP que el buscador de yonkes (busqueda_rate_limit, compartido): 1 lectura y 1 escritura.
// Lecturas de inventario: casi ninguna con la caché caliente (ver refaccionariaPublica.js).
export const MENSAJE_TEXTO_PIEZAS_NUEVAS = 'Escribe un número de parte o una descripción (de 2 a 100 caracteres).';

// Mismo criterio que /api/buscar.
function obtenerIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

const lecturas = { activas: () => refaccionariasActivas('activas'), indice: indiceDeBusqueda, bloque: bloqueDeInventario, visible: visibleAhora };

export async function POST(request) {
  if (!(await buscadorRefaccionesEncendido())) return NextResponse.json({ estado: 'apagado' }, { status: 404 });

  let cuerpo = null;
  try { cuerpo = await request.json(); } catch { /* cuerpo inválido: se responde abajo */ }
  const texto = typeof cuerpo?.texto === 'string' ? cuerpo.texto.trim() : '';
  if (texto.length < 2 || texto.length > 100) {
    return NextResponse.json({ estado: 'texto_invalido', mensaje: MENSAJE_TEXTO_PIEZAS_NUEVAS }, { status: 400 });
  }
  const estado = typeof cuerpo?.estado === 'string' && /^[a-z0-9-]{1,40}$/.test(cuerpo.estado) ? cuerpo.estado : 'todos';

  // Si el propio chequeo falla, se deja pasar (igual que /api/buscar).
  let permitido = true;
  try {
    permitido = await permitirBusqueda(obtenerIp(request));
  } catch (error) {
    console.error('[refacciones/buscar] No se pudo verificar rate limit', { code: error?.code, message: error?.message });
  }
  if (!permitido) return NextResponse.json({ estado: 'rate_limited', mensaje: MENSAJE_RATE_LIMIT }, { status: 429 });

  try {
    const r = await buscarPiezasNuevas({ texto, estado, pagina: paginaResultados(cuerpo?.pagina) }, lecturas);
    return NextResponse.json({ estado: 'ok', ...r });
  } catch (error) {
    console.error('[refacciones/buscar] Falló la búsqueda', { code: error?.code, message: error?.message });
    return NextResponse.json({ estado: 'error', mensaje: 'No pudimos buscar en este momento. Intenta de nuevo.' }, { status: 500 });
  }
}
