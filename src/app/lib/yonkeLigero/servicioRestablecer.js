import { contar, obtenerDbServicio } from '../pedidosClientes/servicio';
import { borrarComoUsuario, leerComoUsuario, uidDeToken } from '../avisosAdmin/identidadUsuario';
import { notificarAdmin } from '../notificarAdmin';
import { claveLimite } from '../../../lib/pedidosClientesServidor';
import { borrarCuenta, cambiarPassword, generarContrasenaTemporal, leerCredencialesAuth } from './authAdmin';
import { crearManejadorLiberar } from './liberar';
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

let manejadorDeLiberar = null;
export function manejadorLiberar() {
  if (!manejadorDeLiberar) {
    manejadorDeLiberar = crearManejadorLiberar({
      uidDeToken, leerComoUsuario, borrarComoUsuario, credenciales: leerCredencialesAuth, borrarCuenta, claveLimite, notificar: notificarAdmin,
    });
  }
  return manejadorDeLiberar;
}
