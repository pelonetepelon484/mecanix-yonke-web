import { manejadoresReales } from '../../lib/pedidosClientes/servicio';

// Pedidos abiertos de clientes para yonkes sin cuenta: solo vehículo, pieza, estado y fecha.
export const dynamic = 'force-dynamic';

export async function GET(request) {
  return manejadoresReales().pedidosAbiertos(request);
}
