import { manejadoresReales } from '../../../lib/pedidosClientes/servicio';

// Pedido del cliente con sus respuestas, solo con el código correcto (?c=...).
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { id } = await params;
  return manejadoresReales().miPedido(request, id);
}
