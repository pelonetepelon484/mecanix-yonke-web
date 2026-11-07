import { NextResponse } from 'next/server';
import { manejadorAqui } from '../../../lib/asistenciaVial/servicio';

// "Estoy aquí" de los proveedores de asistencia vial (ver lib/asistenciaVial/aqui.js). El secreto
// del enlace llega en el cuerpo (POST), nunca en la dirección: así no queda en registros.
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
  const { status, json } = await manejadorAqui()(body);
  return NextResponse.json(json, { status, headers: { 'Cache-Control': 'no-store' } });
}
