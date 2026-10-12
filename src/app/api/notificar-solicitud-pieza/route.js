import { manejadoresAvisos } from '../../lib/avisosAdmin/servicio';

// Aviso al admin de "nuevo pedido de pieza" de un taller. El navegador manda solo el número del
// pedido y su pase de sesión; el servidor comprueba que el pedido sea de ese taller y arma el
// mensaje con lo guardado. Lógica en lib/avisosAdmin/manejadores.js.
export async function POST(request) {
  return manejadoresAvisos().solicitudPieza(request);
}
