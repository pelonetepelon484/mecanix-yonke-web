import { contar, obtenerDbServicio } from '../pedidosClientes/servicio';
import { borrarComoUsuario, leerComoUsuario, uidDeToken } from '../avisosAdmin/identidadUsuario';
import { notificarAdmin } from '../notificarAdmin';
import { Timestamp, collection, deleteDoc, doc, runTransaction, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { claveLimite, codigoCoincide, hashCodigo } from '../../../lib/pedidosClientesServidor';
import { borrarCuenta, cambiarPassword, generarBloqueo, generarCodigoTemporal, leerCredencialesAuth } from './authAdmin';
import { crearManejadorLiberar } from './liberar';
import { crearManejadorRestablecer } from './restablecer';
import { crearManejadorUsarCodigo } from './usarCodigo';

// Solo servidor. Dependencias reales de "Restablecer contraseña" del admin y del código temporal.

// Código (un documento por WhatsApp: uno nuevo reemplaza al anterior) y registro de quién lo generó,
// en un solo lote. Devuelve cómo deshacerlo si Google no confirma el cambio.
async function guardarCodigo(db, { clave, uid, yonkeId, adminUid, codigoHash, expiraAt }) {
  const refCodigo = doc(db, 'codigosTemporales', clave);
  const refRegistro = doc(collection(db, 'yonkes', yonkeId, 'restablecimientos'));
  const lote = writeBatch(db);
  lote.set(refCodigo, { uid, codigoHash, expiraAt: Timestamp.fromDate(expiraAt), creadoAt: serverTimestamp() });
  lote.set(refRegistro, { adminUid, fecha: serverTimestamp() });
  await lote.commit();
  return () => Promise.all([deleteDoc(refCodigo), deleteDoc(refRegistro)]);
}

// Un solo uso: lo comprueba y lo borra en la misma transacción. null si no sirve (y si venció, lo borra).
function reclamarCodigo(db, clave, codigo, ahora) {
  const ref = doc(db, 'codigosTemporales', clave);
  return runTransaction(db, async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists()) return null;
    const datos = snap.data();
    if (datos.expiraAt.toDate() <= ahora) {
      t.delete(ref);
      return null;
    }
    if (!codigoCoincide(codigo, datos.codigoHash)) return null;
    t.delete(ref);
    return datos;
  });
}

function restaurarCodigo(db, clave, { uid, codigoHash, expiraAt }) {
  return setDoc(doc(db, 'codigosTemporales', clave), { uid, codigoHash, expiraAt, creadoAt: serverTimestamp() });
}

let manejador = null;
export function manejadorRestablecer() {
  if (!manejador) {
    manejador = crearManejadorRestablecer({
      uidDeToken, leerComoUsuario, credenciales: leerCredencialesAuth, obtenerDb: obtenerDbServicio, contar, claveLimite,
      generarTemporal: generarCodigoTemporal, generarBloqueo, hashCodigo, guardarCodigo, cambiarPassword, notificar: notificarAdmin, ahora: () => new Date(),
    });
  }
  return manejador;
}

let manejadorDeCodigo = null;
export function manejadorUsarCodigo() {
  if (!manejadorDeCodigo) {
    manejadorDeCodigo = crearManejadorUsarCodigo({
      credenciales: leerCredencialesAuth, obtenerDb: obtenerDbServicio, contar, claveLimite, reclamarCodigo, restaurarCodigo, cambiarPassword, ahora: () => new Date(),
    });
  }
  return manejadorDeCodigo;
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
