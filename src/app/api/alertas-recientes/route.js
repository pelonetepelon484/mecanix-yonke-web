import { manejadoresReales } from '../../lib/pedidosClientes/servicio';

// Alertas de búsqueda recientes del estado del visitante, para la ventana de la portada: solo
// pieza, vehículo, estado y fecha (del resumen publico/alertasRecientes). Con la bandera
// config/pedidosClientes.alertasPortada apagada responde "no disponible".
export const dynamic = 'force-dynamic';

export async function GET(request) {
  return manejadoresReales().alertasRecientes(request);
}
