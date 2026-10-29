import { manejadorPremiumGratis } from '../../../lib/premiumGratis/servicio';

// Promoción "Premium gratis al registrarte" (config/talleres): la llama el registro de talleres.
// Lógica en lib/premiumGratis/manejadores.js. Nunca rompe el registro.
export const maxDuration = 15;

export async function POST(request) {
  return manejadorPremiumGratis()(request);
}
