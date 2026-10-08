import { manejadoresReales } from '../../lib/pedidosClientes/servicio';

// Pedido de pieza de un cliente sin cuenta. Toda la lógica vive en lib/pedidosClientes/manejadores.js.
export async function POST(request) {
  return manejadoresReales().pedirPieza(request);
}
