import { getApps, initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  Timestamp, collection, doc, getDoc, getDocs, initializeFirestore, limit, orderBy, query, runTransaction, serverTimestamp, where, writeBatch,
} from 'firebase/firestore';
import { firebaseConfig } from '../firebaseConfig';
import { obtenerEstadosCombinado } from '../busqueda/estadosServer';
import { notificarAdmin } from '../notificarAdmin';
import { claveLimite, codigoCoincide, generarCodigo, hashCodigo } from '../../../lib/pedidosClientesServidor';
import { crearManejadores } from './manejadores';

// Solo servidor. Identidad de servicio para el pedido de clientes: una app de Firebase APARTE
// (no la de dbServer que usa el buscador, que sigue sin sesión exactamente igual que antes) que
// inicia sesión con un usuario de servicio de Firebase Auth. Las reglas solo dejan a ese usuario
// (usuarios/{uid}.rol == 'servicio') crear pedidosClientes, leer privado/contacto y escribir los
// contadores. Credenciales en Vercel: MECANIX_SERVICIO_EMAIL y MECANIX_SERVICIO_PASSWORD.
// Sin ellas, todo queda apagado (las rutas responden "no disponible").

const NOMBRE_APP = 'servicio-pedidos-clientes';
let conexion = null;

export function obtenerDbServicio() {
  const email = process.env.MECANIX_SERVICIO_EMAIL;
  const password = process.env.MECANIX_SERVICIO_PASSWORD;
  if (!email || !password) {
    console.error('[pedidosClientes] Faltan MECANIX_SERVICIO_EMAIL / MECANIX_SERVICIO_PASSWORD: la función queda apagada');
    return Promise.resolve(null);
  }
  if (!conexion) {
    conexion = (async () => {
      const app = getApps().find((a) => a.name === NOMBRE_APP) ?? initializeApp(firebaseConfig, NOMBRE_APP);
      const auth = getAuth(app);
      if (!auth.currentUser) await signInWithEmailAndPassword(auth, email, password);
      // Mismo transporte que dbServer (ver firebase-server.js): long-polling en el servidor.
      return initializeFirestore(app, { experimentalAutoDetectLongPolling: true, useFetchStreams: false });
    })().catch((error) => {
      conexion = null; // se reintenta en la siguiente petición
      throw error;
    });
  }
  return conexion;
}

// config/pedidosClientes se cachea 1 minuto por instancia (se lee en cada consulta de /mi-pedido).
let cacheConfig = { valor: null, en: 0 };
async function leerConfig(db) {
  if (Date.now() - cacheConfig.en < 60 * 1000) return cacheConfig.valor;
  const snap = await getDoc(doc(db, 'config', 'pedidosClientes'));
  const valor = snap.exists() ? snap.data() : null;
  cacheConfig = { valor, en: Date.now() };
  return valor;
}
export async function habilitado(db) {
  return (await leerConfig(db))?.habilitado === true;
}
// Segunda bandera: casilla "yonkes de otros estados que hagan envíos". Exige también la primera.
export async function otrosEstados(db) {
  const config = await leerConfig(db);
  return config?.habilitado === true && config?.otrosEstados === true;
}

// Contador atómico en pedidosClientesLimite. expiraEn: para la política TTL (se borra solo).
export function contar(db, clave, max, ventanaMs) {
  const ref = doc(db, 'pedidosClientesLimite', clave);
  return runTransaction(db, async (t) => {
    const snap = await t.get(ref);
    const n = snap.exists() ? (snap.data().count || 0) : 0;
    if (n >= max) return false;
    t.set(ref, { count: n + 1, actualizado: new Date(), expiraEn: Timestamp.fromMillis(Date.now() + ventanaMs + 60 * 60 * 1000) });
    return true;
  });
}

// Pedido + privado/contacto en un solo lote: nunca queda un pedido sin su contacto o al revés.
export async function crearPedido(db, { pedido, privado }) {
  const ref = doc(collection(db, 'pedidosClientes'));
  const expiraAt = Timestamp.fromDate(pedido.expiraAt);
  const lote = writeBatch(db);
  lote.set(ref, {
    vehiculo: pedido.vehiculo, pieza: pedido.pieza, estado: pedido.estado,
    estadoPedido: 'abierta', creadoAt: serverTimestamp(), expiraAt,
    // Solo con la bandera otrosEstados encendida (si no, el documento queda igual que siempre).
    ...('aceptaOtrosEstados' in pedido ? { aceptaOtrosEstados: pedido.aceptaOtrosEstados === true } : {}),
  });
  lote.set(doc(db, 'pedidosClientes', ref.id, 'privado', 'contacto'), {
    clienteWhatsapp: privado.clienteWhatsapp, codigoHash: privado.codigoHash, expiraAt,
  });
  await lote.commit();
  return ref.id;
}

export async function leerPedido(db, id) {
  const snap = await getDoc(doc(db, 'pedidosClientes', id));
  return snap.exists() ? snap.data() : null;
}

export async function leerPrivado(db, id) {
  const snap = await getDoc(doc(db, 'pedidosClientes', id, 'privado', 'contacto'));
  return snap.exists() ? snap.data() : null;
}

export async function leerRespuestas(db, id) {
  const snap = await getDocs(collection(db, 'pedidosClientes', id, 'respuestas'));
  return snap.docs.map((d) => ({ yonkeId: d.id, ...d.data() }));
}

// Yonkes de las respuestas (lectura pública), para la marca de "Verificado" en vivo.
export async function leerYonkes(db, ids) {
  const pares = await Promise.all(ids.map(async (id) => {
    const snap = await getDoc(doc(db, 'yonkes', id));
    return [id, snap.exists() ? snap.data() : null];
  }));
  return Object.fromEntries(pares);
}

export async function listarAbiertos(db, estado, maximo) {
  const q = query(
    collection(db, 'pedidosClientes'),
    where('estado', '==', estado), where('estadoPedido', '==', 'abierta'), orderBy('creadoAt', 'desc'), limit(maximo),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

let manejadores = null;
export function manejadoresReales() {
  if (!manejadores) {
    manejadores = crearManejadores({
      obtenerDb: obtenerDbServicio, habilitado, otrosEstados, contar, crearPedido, leerPedido, leerPrivado, leerRespuestas, leerYonkes, listarAbiertos,
      estados: obtenerEstadosCombinado, notificar: notificarAdmin, ahora: () => new Date(),
      generarCodigo, hashCodigo, codigoCoincide, claveLimite,
    });
  }
  return manejadores;
}
