import { manejadorLiberar } from '../../../lib/yonkeLigero/servicioRestablecer';

// Al borrar un yonke que entra con WhatsApp, deja ese número libre. Lógica en lib/yonkeLigero/liberar.js.
export const maxDuration = 20;

export async function POST(request) {
  return manejadorLiberar()(request);
}
