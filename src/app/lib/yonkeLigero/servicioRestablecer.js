import { contar, obtenerDbServicio } from '../pedidosClientes/servicio';
import { leerComoUsuario, uidDeToken } from '../avisosAdmin/identidadUsuario';
import { notificarAdmin } from '../notificarAdmin';
import { claveLimite } from '../../../lib/pedidosClientesServidor';
import { cambiarPassword, generarContrasenaTemporal, leerCredencialesAuth } from './authAdmin';
import { crearManejadorRestablecer } from './restablecer';

// Solo servidor. Dependencias reales de "Restablecer contraseña" del admin.
let manejador = null;
export function manejadorRestablecer() {
  if (!manejador) {
    manejador = crearManejadorRestablecer({
      uidDeToken, leerComoUsuario, credenciales: leerCredencialesAuth, obtenerDb: obtenerDbServicio, contar, claveLimite,
      generarTemporal: generarContrasenaTemporal, cambiarPassword, notificar: notificarAdmin, ahora: () => new Date(),
    });
  }
  return manejador;
}
