import { doc, writeBatch } from 'firebase/firestore';
import { obtenerDbServicio } from '../pedidosClientes/servicio';
import { leerComoUsuario, uidDeToken } from '../avisosAdmin/identidadUsuario';
import { notificarAdmin } from '../notificarAdmin';
import { crearManejadorCompletar } from './completar';

// Solo servidor. Ficha, rol y correo en un solo guardado: o todo o nada. El correo es de contacto
// (privado/contacto); la cuenta sigue entrando con su WhatsApp.
async function guardar(db, { uid, yonkeId, ciudad, direccion, telefono, correo }) {
  const lote = writeBatch(db);
  lote.update(doc(db, 'yonkes', yonkeId), { tipoRegistro: 'completo', ciudad, direccion, telefono, metodosPago: [] });
  lote.update(doc(db, 'usuarios', uid), { rol: 'yonke' });
  if (correo) lote.set(doc(db, 'yonkes', yonkeId, 'privado', 'contacto'), { email: correo });
  await lote.commit();
}

let manejador = null;
export function manejadorCompletar() {
  if (!manejador) {
    manejador = crearManejadorCompletar({ uidDeToken, leerComoUsuario, obtenerDb: obtenerDbServicio, guardar, notificar: notificarAdmin });
  }
  return manejador;
}
