import { manejadoresAvisos } from '../../lib/avisosAdmin/servicio';

// Aviso al admin de "nuevo yonke registrado". Lo llama el yonke recién registrado con su pase de
// sesión; el servidor lee su ficha y arma el mensaje con lo guardado (1 aviso por yonke).
// Lógica en lib/avisosAdmin/manejadores.js.
export async function POST(request) {
  return manejadoresAvisos().registroYonke(request);
}
