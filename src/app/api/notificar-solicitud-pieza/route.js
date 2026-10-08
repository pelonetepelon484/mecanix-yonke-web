import { NextResponse } from 'next/server';
import { notificarAdmin } from '../../lib/notificarAdmin';

// Proxy server-side para el aviso de "nuevo pedido de pieza" (mismo patrón que
// notificar-registro): el navegador nunca ve la API key de CallMeBot. Si el aviso falla,
// la solicitud ya se creó igual en Firestore -- este endpoint no bloquea ni revierte nada.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const tallerNombre = typeof body?.tallerNombre === 'string' ? body.tallerNombre.trim().slice(0, 200) : '';
  const pieza = typeof body?.pieza === 'string' ? body.pieza.trim().slice(0, 200) : '';
  const marca = typeof body?.vehiculo?.marca === 'string' ? body.vehiculo.marca.trim().slice(0, 100) : '';
  const modelo = typeof body?.vehiculo?.modelo === 'string' ? body.vehiculo.modelo.trim().slice(0, 100) : '';
  const anio = Number.isInteger(body?.vehiculo?.anio) ? body.vehiculo.anio : '';
  const estado = typeof body?.estado === 'string' ? body.estado.trim().slice(0, 100) : '';

  const mensaje = `🔧 Nuevo pedido de pieza en Mecanix!\n\nTaller: ${tallerNombre}\nPieza: ${pieza}\nVehículo: ${marca} ${modelo} ${anio}\nEstado: ${estado}\n\nRevisa Firebase si necesitas avisar a los yonkes.`;

  await notificarAdmin(mensaje);

  return NextResponse.json({ ok: true });
}
