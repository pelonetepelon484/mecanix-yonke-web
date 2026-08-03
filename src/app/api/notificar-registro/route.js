import { NextResponse } from 'next/server';
import { notificarAdmin } from '../../lib/notificarAdmin';

// Proxy server-side para el aviso de "nuevo yonke registrado" — antes registro/page.js llamaba
// a CallMeBot directo desde el navegador con la API key hardcodeada. Este endpoint recibe solo
// los datos a mostrar (nunca la API key) y arma/envía el mensaje del lado servidor.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const nombre = typeof body?.nombre === 'string' ? body.nombre.trim().slice(0, 200) : '';
  const ciudad = typeof body?.ciudad === 'string' ? body.ciudad.trim().slice(0, 100) : '';
  const telefono = typeof body?.telefono === 'string' ? body.telefono.trim().slice(0, 30) : '';
  const email = typeof body?.email === 'string' ? body.email.trim().slice(0, 200) : '';

  const mensaje = `🏪 Nuevo yonke registrado en Mecanix!\n\nNombre: ${nombre}\nCiudad: ${ciudad}\nTeléfono: ${telefono}\nCorreo: ${email}\n\nRevisa Firebase para activarlo.`;

  // notificarAdmin nunca lanza (traga y loguea sus propios errores) — awaited para que el
  // aviso salga antes de que la función serverless termine, pero nunca puede tumbar la respuesta.
  await notificarAdmin(mensaje);

  return NextResponse.json({ ok: true });
}
