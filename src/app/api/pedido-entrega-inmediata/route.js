import { NextResponse } from 'next/server';
import { notificarAdmin } from '../../lib/notificarAdmin';

// El servicio de Entrega Inmediata lo opera David directamente (sin pasarela de pagos, el
// cobro lo coordina él por WhatsApp) — este endpoint solo dispara el aviso server-side por
// CallMeBot cuando un taller pide que le lleve una pieza de un yonke marcado como
// entregaInmediata. El link de WhatsApp hacia David ya se abre del lado del cliente
// (page.js); esto es la segunda vía para que nunca se le pase un pedido por alto.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const pieza = typeof body?.pieza === 'string' ? body.pieza.trim().slice(0, 100) : '';
  const marca = typeof body?.marca === 'string' ? body.marca.trim().slice(0, 60) : '';
  const modelo = typeof body?.modelo === 'string' ? body.modelo.trim().slice(0, 60) : '';
  const anio = body?.anio != null ? String(body.anio).trim().slice(0, 4) : '';
  const yonkeNombre = typeof body?.yonkeNombre === 'string' ? body.yonkeNombre.trim().slice(0, 200) : '';

  const vehiculo = [marca, modelo, anio].filter(Boolean).join(' ');
  const mensaje = `⚡ PEDIDO ENTREGA INMEDIATA\nPieza: ${pieza || '(sin especificar)'}\nVehículo: ${vehiculo || '(sin especificar)'}\nYonke: ${yonkeNombre || '(sin especificar)'}`;

  await notificarAdmin(mensaje);

  return NextResponse.json({ ok: true });
}
