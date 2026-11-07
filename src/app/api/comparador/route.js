import { NextResponse } from 'next/server';
import { manejadorComparador } from '../../lib/comparador/servicio';

// Comparador de compatibilidad de piezas (ver lib/comparador/manejador.js). Los VIN viajan en el
// cuerpo (POST), nunca en la dirección: así no quedan en registros ni en el historial.
export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body = null;
  try {
    const texto = await request.text();
    if (texto.length > 2000) return NextResponse.json({ error: 'Solicitud no válida.' }, { status: 400 });
    body = JSON.parse(texto);
  } catch {
    return NextResponse.json({ error: 'Solicitud no válida.' }, { status: 400 });
  }
  const { status, json } = await manejadorComparador()(request, body);
  return NextResponse.json(json, { status, headers: { 'Cache-Control': 'no-store' } });
}
