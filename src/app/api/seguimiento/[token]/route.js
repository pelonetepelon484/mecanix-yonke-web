import { manejadoresSeguimiento } from '../../../lib/seguimiento/servicio';

// Seguimiento público de una orden: solo los datos de la lista blanca (seguimientoPublico).
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { token } = await params;
  return manejadoresSeguimiento().consultar(request, token);
}
