import { manejadorUsarCodigo } from '../../../lib/yonkeLigero/servicioRestablecer';

// El yonke cambia su código temporal por una contraseña nueva.
// Lógica en lib/yonkeLigero/usarCodigo.js.
export const maxDuration = 20;

export async function POST(request) {
  return manejadorUsarCodigo()(request);
}
