import { randomUUID } from 'node:crypto';
import { deleteApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { Timestamp, collection, doc, getDoc, getDocs, runTransaction, serverTimestamp } from 'firebase/firestore';
import { dbServer } from '../firebase-server';
import { firebaseConfig } from '../firebaseConfig';
import { obtenerEstadosCombinado } from '../busqueda/estadosServer';
import { notificarAdmin } from '../notificarAdmin';
import { contar, leerPedido, obtenerDbServicio } from '../pedidosClientes/servicio';
import { claveLimite } from '../../../lib/pedidosClientesServidor';
import { CONSTANCIA_AUTORIZACION, CONSTANCIA_PRIVACIDAD, DECLARACION_LIGERO, idConstancia } from '../../../lib/constanciasLegales';
import { VERSION_LEGAL } from '../../../lib/versionesLegales';
import { crearManejadorRegistroLigero } from './manejadores';

// Solo servidor. Dependencias reales del alta del yonke ligero.

// config/yonkesLigeros se cachea 1 minuto por instancia (igual que config/pedidosClientes).
let cacheConfig = { valor: null, en: 0 };
async function leerConfig() {
  if (Date.now() - cacheConfig.en < 60 * 1000) return cacheConfig.valor;
  const snap = await getDoc(doc(dbServer, 'config', 'yonkesLigeros'));
  const valor = snap.exists() ? snap.data() : null;
  cacheConfig = { valor, en: Date.now() };
  return valor;
}

async function versionTerminos() {
  const snap = await getDoc(doc(dbServer, 'config', 'terminosYonkes'));
  return snap.exists() && typeof snap.data().version === 'string' ? snap.data().version : VERSION_LEGAL;
}

async function huellaExiste(db, clave) {
  return (await getDoc(doc(db, 'pedidosClientesLimite', clave))).exists();
}

async function leerYonkes(db) {
  return (await getDocs(collection(db, 'yonkes'))).docs.map((d) => ({ whatsapp: d.data().whatsapp, telefono: d.data().telefono }));
}

// La cuenta se crea en una app de Firebase aparte, una por registro: nunca toca la sesión del
// usuario de servicio. borrar() deshace la cuenta si no se pudo guardar el yonke.
async function crearCuenta(correo, password) {
  const app = initializeApp(firebaseConfig, `registro-ligero-${randomUUID()}`);
  const auth = getAuth(app);
  try {
    const credencial = await createUserWithEmailAndPassword(auth, correo, password);
    return {
      uid: credencial.user.uid,
      borrar: () => credencial.user.delete().catch((error) => {
        console.error('[yonkeLigero] Quedó una cuenta sin yonke', { uid: credencial.user.uid, code: error?.code });
      }),
      cerrar: async () => { await signOut(auth).catch(() => {}); await deleteApp(app); },
    };
  } catch (error) {
    await deleteApp(app).catch(() => {});
    throw error;
  }
}

// Una sola transacción: si la huella ya existe -> 'yaUsada' (no se escribe nada); si no, ficha,
// historial, constancias, usuario y huella. La huella usa el formato de los contadores de pedidosClientesLimite.
async function guardar(db, { uid, nombre, whatsapp, estado, correo, version, huella, vidaHuellaMs }) {
  const refHuella = doc(db, 'pedidosClientesLimite', huella);
  const refYonke = doc(collection(db, 'yonkes'));
  return runTransaction(db, async (t) => {
    if ((await t.get(refHuella)).exists()) return 'yaUsada';
    t.set(refYonke, {
      nombre, whatsapp, estado, tipoRegistro: 'ligero', plan: 'freemium', activo: true, fechaRegistro: serverTimestamp(), ownerUid: uid,
      aceptacionLegal: { version, fecha: serverTimestamp() },
    });
    t.set(doc(db, 'yonkes', refYonke.id, 'aceptaciones', version), { version, fecha: serverTimestamp() });
    t.set(doc(db, 'yonkes', refYonke.id, 'constancias', idConstancia(CONSTANCIA_PRIVACIDAD, version)), {
      tipo: CONSTANCIA_PRIVACIDAD, version, fecha: serverTimestamp(),
    });
    t.set(doc(db, 'yonkes', refYonke.id, 'constancias', idConstancia(CONSTANCIA_AUTORIZACION, version)), {
      tipo: CONSTANCIA_AUTORIZACION, version, fecha: serverTimestamp(), texto: DECLARACION_LIGERO,
    });
    t.set(doc(db, 'usuarios', uid), { rol: 'yonkeLigero', yonkeId: refYonke.id, email: correo, fechaRegistro: serverTimestamp() });
    const ahora = new Date();
    t.set(refHuella, { count: 1, actualizado: ahora, expiraEn: Timestamp.fromMillis(ahora.getTime() + vidaHuellaMs) });
    return 'ok';
  });
}

async function nombreEstado(id) {
  return (await obtenerEstadosCombinado()).find((e) => e.id === id)?.nombre || id;
}

let manejador = null;
export function manejadorRegistroLigero() {
  if (!manejador) {
    manejador = crearManejadorRegistroLigero({
      leerConfig, obtenerDb: obtenerDbServicio, contar, claveLimite, leerPedido, huellaExiste, leerYonkes, versionTerminos,
      crearCuenta, guardar, notificar: notificarAdmin, nombreEstado, ahora: () => new Date(),
    });
  }
  return manejador;
}
