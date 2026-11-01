import { manejadorCompletar } from '../../../lib/yonkeLigero/servicioCompletar';

// "Completar mi registro" del yonke ligero. Lógica en lib/yonkeLigero/completar.js.
export const maxDuration = 15;

export async function POST(request) {
  return manejadorCompletar()(request);
}
