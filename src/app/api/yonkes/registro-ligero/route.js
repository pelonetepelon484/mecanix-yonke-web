import { manejadorRegistroLigero } from '../../../lib/yonkeLigero/servicio';

// Alta del yonke ligero desde una búsqueda activa (config/yonkesLigeros.habilitado).
// Lógica en lib/yonkeLigero/manejadores.js.
export const maxDuration = 15;

export async function POST(request) {
  return manejadorRegistroLigero()(request);
}
