import { doc, getDoc } from 'firebase/firestore';
import { contar, obtenerDbServicio } from '../pedidosClientes/servicio';
import { claveLimite } from '../../../lib/pedidosClientesServidor';
import { notificarAdmin } from '../notificarAdmin';
import { leerComoUsuario, uidDeToken } from './identidadUsuario';
import { crearManejadoresAvisos } from './manejadores';

// Solo servidor. Dependencias reales de los avisos al admin: el mismo usuario de servicio y los
// mismos contadores (pedidosClientesLimite) que las alertas de clientes.
async function leerYonke(db, id) {
  const snap = await getDoc(doc(db, 'yonkes', id));
  return snap.exists() ? snap.data() : null;
}

let manejadores = null;
export function manejadoresAvisos() {
  if (!manejadores) {
    manejadores = crearManejadoresAvisos({
      obtenerDb: obtenerDbServicio, contar, claveLimite, uidDeToken, leerComoUsuario, leerYonke,
      notificar: notificarAdmin, ahora: () => new Date(),
    });
  }
  return manejadores;
}
