'use client';

// Acceso a Firestore para el lado del yonke en el pedido de piezas de los talleres.
// Las reglas (firestore.rules) son la protección real: esta capa solo prepara datos correctos.
import { collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

// El panel de yonke (AuthContext) no trae `estado`, `activo`, `nombre` ni `whatsapp` del yonke
// -- se leen aparte, una sola vez, aquí. Un yonke inactivo o sin estado no ve ni responde
// solicitudes; nombre y whatsapp son los que se mandan al responder (los exige la regla).
export async function leerYonkeEstadoActivo(yonkeId) {
  const snap = await getDoc(doc(db, 'yonkes', yonkeId));
  if (!snap.exists()) return { estado: null, activo: false, nombre: '', whatsapp: '' };
  const d = snap.data();
  return { estado: d.estado || null, activo: d.activo === true, nombre: d.nombre || '', whatsapp: d.whatsapp || '' };
}

const solicitudesRef = () => collection(db, 'solicitudesPiezas');
const solicitudRef = (id) => doc(db, 'solicitudesPiezas', id);
const respuestaRef = (id, yonkeId) => doc(db, 'solicitudesPiezas', id, 'respuestas', yonkeId);

// Solicitudes abiertas del mismo estado del yonke, en vivo (recién creadas primero).
// No pide el campo `orderBy` como índice aparte: usa el mismo compuesto que lista el taller
// (estado + estadoSolicitud + creadoAt) -- ver reporte de índices.
export function escucharSolicitudesAbiertas(estado, cb) {
  const q = query(solicitudesRef(), where('estado', '==', estado), where('estadoSolicitud', '==', 'abierta'), orderBy('creadoAt', 'desc'));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

// Solicitudes donde este yonke quedó elegido (para mostrarle el WhatsApp del taller aunque ya
// estén cerradas). Un solo filtro de igualdad: no necesita índice compuesto.
export function escucharSolicitudesGanadas(yonkeId, cb) {
  const q = query(solicitudesRef(), where('yonkeElegido', '==', yonkeId));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export async function leerSolicitud(id) {
  const snap = await getDoc(solicitudRef(id));
  return snap.exists() ? { id, ...snap.data() } : null;
}

// Si el yonke ya respondió esta solicitud (para no mostrarle el formulario dos veces).
export async function yaRespondio(id, yonkeId) {
  const snap = await getDoc(respuestaRef(id, yonkeId));
  return snap.exists() ? snap.data() : null;
}

// Una sola respuesta por yonke: la regla rechaza un segundo intento (ver firestore.rules).
export async function responder(id, yonkeId, { yonkeNombre, whatsapp, tieneLaPieza, precio, nota }) {
  const solicitud = await leerSolicitud(id);
  if (!solicitud) throw new Error('La solicitud ya no existe.');
  const cuerpo = {
    yonkeId, yonkeNombre, whatsapp, tieneLaPieza, nota,
    creadoAt: serverTimestamp(), expiraAt: solicitud.expiraAt,
  };
  if (tieneLaPieza) cuerpo.precio = precio;
  await setDoc(respuestaRef(id, yonkeId), cuerpo);
}

// WhatsApp del taller: solo lo puede leer el yonke elegido (lo protege la regla).
export async function leerContactoTaller(id) {
  const snap = await getDoc(doc(db, 'solicitudesPiezas', id, 'privado', 'contacto'));
  return snap.exists() ? snap.data().tallerWhatsapp : null;
}
