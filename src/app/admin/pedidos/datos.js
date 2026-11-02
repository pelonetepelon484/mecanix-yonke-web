'use client';

// Acceso a Firestore del panel admin "Pedidos de piezas". Todo corre con la sesión del admin;
// las reglas (firestore.rules) solo dejan al admin leer privado/contacto (WhatsApp del cliente)
// y cerrar, cancelar, reabrir o borrar pedidos. Las listas traen los más recientes (los pedidos
// se borran solos a los 5 días por TTL, así que son pocos) y se filtran en memoria: sin índices nuevos.
import {
  Timestamp, collection, deleteDoc, deleteField, doc, getCountFromServer, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc,
  updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { calcularExpiraEvidencia, textoBusquedaEvidencia } from '../../../lib/evidenciaSugerir';
import { calcularExpiraAtPedido } from '../../../lib/pedidosClientes';
import { MOTIVO_CONSERVAR_RECLAMO, MOTIVO_NUMERO_AJENO } from '../../../lib/retiroRespuestas';
import { esRegistroLigero } from '../../../lib/yonkeLigero';
import { actualizarResumenAlertas } from '../../lib/pedidosClientes/resumenAlertas';

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

// Resumen público de alertas (publico/alertasRecientes): con config/pedidosClientes.alertasPortada
// encendida, después de cerrar, cancelar, reabrir o borrar se rehace para que la portada y
// /pedidos-abiertos dejen de mostrar (o vuelvan a mostrar) esa alerta. Nunca tumba la acción del
// admin: si falla, el resumen se corrige con la siguiente alerta nueva.
async function refrescarResumenAlertas() {
  try {
    const config = await getDoc(doc(db, 'config', 'pedidosClientes'));
    if (config.exists() && config.data().habilitado === true && config.data().alertasPortada === true) {
      await actualizarResumenAlertas(db);
    }
  } catch (error) {
    console.warn('[admin] No se pudo actualizar el resumen de alertas', error?.code || error?.message);
  }
}

export async function cerrarPedidoCliente(id) {
  await updateDoc(doc(db, 'pedidosClientes', id), { estadoPedido: 'cerrada', cerradoAt: serverTimestamp() });
  await refrescarResumenAlertas();
}

export async function cancelarPedidoCliente(id) {
  await updateDoc(doc(db, 'pedidosClientes', id), { estadoPedido: 'cancelada', cerradoAt: serverTimestamp() });
  await refrescarResumenAlertas();
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
  await refrescarResumenAlertas();
  return expiraAt.toDate();
}

// Borra el pedido con sus respuestas y su documento privado, en un solo lote.
export async function borrarPedidoCliente(id) {
  await borrarConSubcolecciones('pedidosClientes', id);
  await refrescarResumenAlertas();
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

// ---------- "Sugerir yonke" y "Quitar respuesta" (las dos colecciones) ----------
// Banderas config/pedidosClientes.sugerirYonkeAdmin y config/solicitudesPiezas.sugerirYonkeAdmin:
// solo true exacto, y con la función de ese tipo de pedido encendida (habilitado), igual que las reglas.
export async function leerBanderasSugerirYonke() {
  const [clientes, talleres] = await Promise.all([
    getDoc(doc(db, 'config', 'pedidosClientes')), getDoc(doc(db, 'config', 'solicitudesPiezas')),
  ]);
  const encendida = (snap) => snap.exists() && snap.data().habilitado === true && snap.data().sugerirYonkeAdmin === true;
  return { clientes: encendida(clientes), talleres: encendida(talleres) };
}

// Yonkes activos de UN estado (dos igualdades: sin índice compuesto). Nunca se leen todos.
// sinLigeros: pedidos de talleres, que un yonke ligero no ve ni puede atender.
export async function listarYonkesActivosDeEstado(estado, { sinLigeros = false } = {}) {
  const snap = await getDocs(query(collection(db, 'yonkes'), where('estado', '==', estado), where('activo', '==', true)));
  return snap.docs
    .filter((d) => !(sinLigeros && esRegistroLigero(d.data())))
    .map((d) => ({ id: d.id, nombre: d.data().nombre, whatsapp: d.data().whatsapp, estado: d.data().estado }))
    .filter((y) => typeof y.nombre === 'string' && y.nombre !== '' && typeof y.whatsapp === 'string');
}

// Respuesta en nombre del yonke, con los campos que exigen las reglas: siempre "precio a tratar"
// (sin precio), sin `dia` (no pasa por el tope diario ni toca respuestasDiarias) y sin inventario
// automático. El vencimiento se lee del pedido en este momento (por si se reabrió). La evidencia de
// la autorización entra en el mismo lote: sin ella, no hay respuesta.
export async function sugerirYonke(coleccion, pedidoId, yonke, evidencia) {
  const padre = await getDoc(doc(db, coleccion, pedidoId));
  if (!padre.exists()) throw new Error('El pedido ya no existe.');
  const adminUid = auth.currentUser?.uid ?? '';
  const refEvidencia = doc(collection(db, 'evidenciasSugerir'));
  const lote = writeBatch(db);
  lote.set(doc(db, coleccion, pedidoId, 'respuestas', yonke.id), {
    yonkeId: yonke.id, yonkeNombre: yonke.nombre, whatsapp: yonke.whatsapp,
    tieneLaPieza: true, precioATratar: true, nota: '',
    creadoPorAdmin: true, creadoPorAdminUid: adminUid, evidenciaId: refEvidencia.id,
    creadoAt: serverTimestamp(), expiraAt: padre.data().expiraAt,
  });
  lote.set(refEvidencia, {
    coleccion, pedidoId, busqueda: textoBusquedaEvidencia(padre.data()),
    yonkeId: yonke.id, yonkeNombre: yonke.nombre, yonkeWhatsapp: yonke.whatsapp,
    medio: evidencia.medio, mensaje: evidencia.mensaje, recibidoAt: Timestamp.fromDate(evidencia.recibidoAt),
    autorizacionConfirmada: true, adminUid, adminEmail: auth.currentUser?.email ?? '',
    creadoAt: serverTimestamp(), expiraAt: Timestamp.fromDate(calcularExpiraEvidencia(new Date())),
  });
  await lote.commit();
}

// Quita una respuesta (de yonke o sugerida) y deja el registro del motivo en el mismo lote. Si es un
// número ajeno, conserva su evidencia: el reclamo la saca del borrado automático. El contador diario
// del yonke no se toca.
export async function quitarRespuesta(coleccion, pedidoId, respuesta, motivo) {
  const lote = writeBatch(db);
  lote.delete(doc(db, coleccion, pedidoId, 'respuestas', respuesta.yonkeId));
  lote.set(doc(collection(db, 'retirosRespuestas')), {
    coleccion, pedidoId, yonkeId: respuesta.yonkeId, yonkeNombre: respuesta.yonkeNombre, motivo,
    adminUid: auth.currentUser?.uid ?? '', adminEmail: auth.currentUser?.email ?? '',
    fecha: serverTimestamp(), expiraAt: Timestamp.fromDate(calcularExpiraEvidencia(new Date())),
  });
  if (motivo === MOTIVO_NUMERO_AJENO && respuesta.evidenciaId) {
    const evidencia = await getDoc(doc(db, 'evidenciasSugerir', respuesta.evidenciaId));
    if (evidencia.exists() && evidencia.data().expiraAt?.toDate() > new Date()) {
      lote.update(evidencia.ref, datosConservacion(MOTIVO_CONSERVAR_RECLAMO));
    }
  }
  await lote.commit();
}

// WhatsApp de quien hizo la búsqueda, para avisarle a mano: el cliente o el taller.
export async function leerWhatsappSolicitante(coleccion, pedido) {
  const snap = await getDoc(coleccion === 'pedidosClientes'
    ? doc(db, 'pedidosClientes', pedido.id, 'privado', 'contacto')
    : doc(db, 'talleres', pedido.tallerId));
  if (!snap.exists()) return null;
  return (coleccion === 'pedidosClientes' ? snap.data().clienteWhatsapp : snap.data().whatsapp) || null;
}

// ---------- Reclamo de número ajeno (/admin/yonke/{id}) ----------
// Respuestas de un yonke en búsquedas sin vencer. Una lectura por búsqueda, sin índice nuevo: lee
// el documento respuestas/{yonkeId}. También las de búsquedas cerradas: el enlace las sigue mostrando.
export async function buscarRespuestasDeYonke(yonkeId) {
  const [clientes, talleres] = await Promise.all([listarPedidosClientes(), listarSolicitudesTalleres()]);
  const ahora = new Date();
  const vigentes = [
    ...clientes.map((pedido) => ({ coleccion: 'pedidosClientes', pedido })),
    ...talleres.map((pedido) => ({ coleccion: 'solicitudesPiezas', pedido })),
  ].filter(({ pedido }) => pedido.expiraAt?.toDate() > ahora);
  const encontradas = await Promise.all(vigentes.map(async (item) => {
    const snap = await getDoc(doc(db, item.coleccion, item.pedido.id, 'respuestas', yonkeId));
    return snap.exists() ? { ...item, respuesta: { yonkeId, ...snap.data() } } : null;
  }));
  return encontradas.filter(Boolean);
}

export function desactivarYonke(yonkeId) {
  return updateDoc(doc(db, 'yonkes', yonkeId), { activo: false });
}

// ---------- Evidencias de "Sugerir yonke" (/admin/evidencias) ----------
export async function listarEvidencias() {
  const snap = await getDocs(query(collection(db, 'evidenciasSugerir'), orderBy('creadoAt', 'desc'), limit(LIMITE_LISTA)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Reclamación dentro del plazo: sin expiraAt, el borrado automático ya no la alcanza.
const datosConservacion = (motivo) => ({
  expiraAt: deleteField(), conservadaAt: serverTimestamp(), conservadaPorUid: auth.currentUser?.uid ?? '', motivoConservacion: motivo,
});
export function conservarEvidencia(id, motivo) {
  return updateDoc(doc(db, 'evidenciasSugerir', id), datosConservacion(motivo));
}

// Solo las conservadas, cuando la reclamación ya se atendió (las reglas rechazan las demás).
export function borrarEvidenciaConservada(id) {
  return deleteDoc(doc(db, 'evidenciasSugerir', id));
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
