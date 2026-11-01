import { manejadorRestablecer } from '../../../lib/yonkeLigero/servicioRestablecer';

// El admin restablece la contraseña de una cuenta que entra con WhatsApp.
// Lógica en lib/yonkeLigero/restablecer.js.
export const maxDuration = 20;

export async function POST(request) {
  return manejadorRestablecer()(request);
}
