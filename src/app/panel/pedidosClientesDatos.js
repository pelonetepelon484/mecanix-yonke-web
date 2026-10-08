'use client';

// Acceso a Firestore para el lado del yonke en el pedido de pieza de clientes sin cuenta.
// Las reglas (firestore.rules, pedidosClientes) son la protección real: el yonke solo ve
// vehículo, pieza y estado, nunca el WhatsApp del cliente (vive en privado/contacto).
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Bandera de la función: sin config/pedidosClientes, o con habilitado != true, quien llama no
// debe hacer ninguna otra lectura de este módulo.
export async function leerConfigPedidosClientes() {
  const snap = await getDoc(doc(db, 'config', 'pedidosClientes'));
  return snap.exists() ? snap.data() : null;
}

const vencido = (p) => !(p.expiraAt?.toDate && p.expiraAt.toDate().getTime() > Date.now());

// Pedidos abiertos del estado del yonke, en vivo (recién creados primero). Los vencidos que la
// política TTL todavía no borra se ocultan aquí. Índice: estado + estadoPedido + creadoAt desc.
export function escucharPedidosClientesAbiertos(estado, cb) {
  const q = query(
    collection(db, 'pedidosClientes'),
    where('estado', '==', estado), where('estadoPedido', '==', 'abierta'), orderBy('creadoAt', 'desc'), limit(50),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => !vencido(p))),
    (error) => console.error('[pedidosClientes] No se pudo escuchar los pedidos (¿falta el índice?)', error),
  );
}

export async function yaRespondioPedido(id, yonkeId) {
  const snap = await getDoc(doc(db, 'pedidosClientes', id, 'respuestas', yonkeId));
  return snap.exists() ? snap.data() : null;
}

// Una sola respuesta por yonke: la regla rechaza un segundo intento. expiraAt = el del pedido.
export async function responderPedido(pedido, yonkeId, { yonkeNombre, whatsapp, tieneLaPieza, precio, nota }) {
  const cuerpo = {
    yonkeId, yonkeNombre, whatsapp, tieneLaPieza, nota,
    creadoAt: serverTimestamp(), expiraAt: pedido.expiraAt,
  };
  if (tieneLaPieza) cuerpo.precio = precio;
  await setDoc(doc(db, 'pedidosClientes', pedido.id, 'respuestas', yonkeId), cuerpo);
}
