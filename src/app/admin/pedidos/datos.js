'use client';

// Acceso a Firestore del panel admin "Pedidos de piezas". Todo corre con la sesión del admin;
// las reglas (firestore.rules) solo dejan al admin leer privado/contacto (WhatsApp del cliente)
// y cerrar, cancelar, reabrir o borrar pedidos. Las listas traen los más recientes (los pedidos
// se borran solos a los 5 días por TTL, así que son pocos) y se filtran en memoria: sin índices nuevos.
import {
  Timestamp, collection, deleteField, doc, getCountFromServer, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc,
  updateDoc, writeBatch,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { calcularExpiraAtPedido } from '../../../lib/pedidosClientes';

export const LIMITE_LISTA = 300;

// ---------- Interruptor (config/pedidosClientes) ----------
export async function leerBanderaPedidosClientes() {
  const snap = await getDoc(doc(db, 'config', 'pedidosClientes'));
  return snap.exists() && snap.data().habilitado === true;
}

export function cambiarBanderaPedidosClientes(habilitado) {
  return setDoc(doc(db, 'config', 'pedidosClientes'), { habilitado }, { merge: true });
}

// ---------- Pedidos de clientes ----------
export async function listarPedidosClientes() {
  const snap = await getDocs(query(collection(db, 'pedidosClientes'), orderBy('creadoAt', 'desc'), limit(LIMITE_LISTA)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Conteo de respuestas sin leerlas (agregación: 1 lectura por pedido).
export async function contarRespuestas(coleccion, id) {
  const snap = await getCountFromServer(collection(db, coleccion, id, 'respuestas'));
  return snap.data().count;
}

// WhatsApp del cliente + respuestas con la marca de verificado del yonke (en vivo).
export async function leerDetallePedidoCliente(id) {
  const [privado, respuestasSnap] = await Promise.all([
    getDoc(doc(db, 'pedidosClientes', id, 'privado', 'contacto')),
    getDocs(collection(db, 'pedidosClientes', id, 'respuestas')),
  ]);
  const respuestas = respuestasSnap.docs.map((d) => ({ yonkeId: d.id, ...d.data() }));
  const yonkes = await Promise.all(respuestas.map((r) => getDoc(doc(db, 'yonkes', r.yonkeId))));
  return {
    clienteWhatsapp: privado.exists() ? privado.data().clienteWhatsapp : null,
    respuestas: respuestas.map((r, i) => ({ ...r, verificado: yonkes[i].exists() && yonkes[i].data().verificado === true })),
  };
}

export function cerrarPedidoCliente(id) {
  return updateDoc(doc(db, 'pedidosClientes', id), { estadoPedido: 'cerrada', cerradoAt: serverTimestamp() });
}

export function cancelarPedidoCliente(id) {
  return updateDoc(doc(db, 'pedidosClientes', id), { estadoPedido: 'cancelada', cerradoAt: serverTimestamp() });
}

// Reabrir: vuelve a 'abierta' y vence en 5 días desde hoy. En el MISMO lote se extiende el
// vencimiento de privado/contacto y de cada respuesta: si no, la política TTL los borraría
// antes que el pedido (el cliente perdería su enlace y sus respuestas).
export async function reabrirPedidoCliente(id) {
  const expiraAt = Timestamp.fromDate(calcularExpiraAtPedido(new Date()));
  const [privado, respuestas] = await Promise.all([
    getDoc(doc(db, 'pedidosClientes', id, 'privado', 'contacto')),
    getDocs(collection(db, 'pedidosClientes', id, 'respuestas')),
  ]);
  const lote = writeBatch(db);
  lote.update(doc(db, 'pedidosClientes', id), { estadoPedido: 'abierta', expiraAt, cerradoAt: deleteField() });
  if (privado.exists()) lote.update(privado.ref, { expiraAt });
  respuestas.docs.forEach((r) => lote.update(r.ref, { expiraAt }));
  await lote.commit();
  return expiraAt.toDate();
}

// Borra el pedido con sus respuestas y su documento privado, en un solo lote.
export async function borrarPedidoCliente(id) {
  await borrarConSubcolecciones('pedidosClientes', id);
}

// ---------- Pedidos de talleres (solo lectura + borrar) ----------
export async function listarSolicitudesTalleres() {
  const snap = await getDocs(query(collection(db, 'solicitudesPiezas'), orderBy('creadoAt', 'desc'), limit(LIMITE_LISTA)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function leerRespuestasSolicitud(id) {
  const snap = await getDocs(collection(db, 'solicitudesPiezas', id, 'respuestas'));
  return snap.docs.map((d) => ({ yonkeId: d.id, ...d.data() }));
}

// Mismas reglas de siempre: el admin ya puede borrar la solicitud, sus respuestas y su privado.
export async function borrarSolicitudTaller(id) {
  await borrarConSubcolecciones('solicitudesPiezas', id);
}

async function borrarConSubcolecciones(coleccion, id) {
  const [respuestas, privados] = await Promise.all([
    getDocs(collection(db, coleccion, id, 'respuestas')),
    getDocs(collection(db, coleccion, id, 'privado')),
  ]);
  const lote = writeBatch(db);
  respuestas.docs.forEach((d) => lote.delete(d.ref));
  privados.docs.forEach((d) => lote.delete(d.ref));
  lote.delete(doc(db, coleccion, id));
  await lote.commit();
}
