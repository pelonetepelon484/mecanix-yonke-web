import { manejadoresAvisos } from '../../lib/avisosAdmin/servicio';

// El servicio de Entrega Inmediata lo opera David directamente (sin pasarela de pagos, el
// cobro lo coordina él por WhatsApp). El link de WhatsApp hacia David ya se abre del lado del
// cliente (HomeClient.js); esto es la segunda vía, el aviso por CallMeBot. Sin sesión (el
// cliente no tiene cuenta): límite por dirección de internet y tope total por hora, y solo para
// yonkes que existen y tienen entrega inmediata. Lógica en lib/avisosAdmin/manejadores.js.
export async function POST(request) {
  return manejadoresAvisos().entregaInmediata(request);
}
