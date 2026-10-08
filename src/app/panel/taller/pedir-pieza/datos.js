'use client';

// Acceso a Firestore para el pedido de piezas del taller a los yonkes.
// Las reglas (firestore.rules) son la protección real: esta capa solo prepara datos correctos.
import {
  collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { calcularExpiraAtSolicitud } from '../../../../lib/solicitudesPiezas';

const solicitudesRef = () => collection(db, 'solicitudesPiezas');
const solicitudRef = (id) => doc(db, 'solicitudesPiezas', id);
const respuestasRef = (id) => collection(db, 'solicitudesPiezas', id, 'respuestas');

// Crea la solicitud y, en el mismo lote, la subcolección privada con el WhatsApp del taller
// (así ningún yonke ajeno lo ve: solo lo lee el taller dueño, el admin y el yonke elegido).
export async function crearSolicitud({ tallerId, tallerNombre, tallerWhatsapp, estado, vehiculo, pieza, nota }) {
  const nueva = doc(solicitudesRef());
  const expiraAt = calcularExpiraAtSolicitud(new Date());
  const lote = writeBatch(db);
  lote.set(nueva, {
    tallerId, tallerNombre, vehiculo, pieza, nota,
    estado, estadoSolicitud: 'abierta', yonkeElegido: null,
    creadoAt: serverTimestamp(), expiraAt,
  });
  lote.set(doc(db, 'solicitudesPiezas', nueva.id, 'privado', 'contacto'), { tallerWhatsapp, expiraAt });
  await lote.commit();

  // Aviso por WhatsApp al admin (vía endpoint server-side, nunca expone la API key de
  // CallMeBot). Si falla, la solicitud ya se creó: no se revierte ni se vuelve a intentar.
  try {
    await fetch('/api/notificar-solicitud-pieza', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tallerNombre, pieza, vehiculo, estado }),
    });
  } catch (error) {
    console.error('No se pudo enviar el aviso de nuevo pedido de pieza', error);
  }

  return nueva.id;
}

// Solicitudes del taller (todas, sin filtrar por estado): recién creadas primero.
export function escucharMisSolicitudes(tallerId, cb) {
  const q = query(solicitudesRef(), where('tallerId', '==', tallerId), orderBy('creadoAt', 'desc'));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export async function leerSolicitud(id) {
  const snap = await getDoc(solicitudRef(id));
  return snap.exists() ? { id, ...snap.data() } : null;
}

// Respuestas de los yonkes a una solicitud, en vivo.
export function escucharRespuestas(id, cb) {
  return onSnapshot(respuestasRef(id), (snap) => cb(snap.docs.map((d) => ({ yonkeId: d.id, ...d.data() }))));
}

// Elige al yonke que respondió que sí la tiene: cierra la solicitud.
export function elegirYonke(solicitudId, yonkeId) {
  return updateDoc(solicitudRef(solicitudId), { estadoSolicitud: 'cerrada', yonkeElegido: yonkeId });
}

export function cancelarSolicitud(solicitudId) {
  return updateDoc(solicitudRef(solicitudId), { estadoSolicitud: 'cancelada' });
}

// WhatsApp del yonke elegido: el documento yonkes/{id} es de lectura pública, no hace falta
// pasar por la subcolección privada (esa es solo para que el yonke vea el WhatsApp del TALLER).
export async function leerWhatsappYonke(yonkeId) {
  const snap = await getDoc(doc(db, 'yonkes', yonkeId));
  return snap.exists() ? snap.data().whatsapp : null;
}

// Con quiénes ya hay respuesta, para no volver a leerlas si solo se necesita el conteo.
export async function contarRespuestas(id) {
  const snap = await getDocs(respuestasRef(id));
  return snap.size;
}
