'use client';

// Acceso a Firestore de las citas (talleres/{tallerId}/citas/{id}).
// Las reglas (firestore.rules) son la protección real: solo el dueño lee; escribir pide taller
// activo, términos vigentes, config/citas.habilitado y, con requierePremium, Premium vigente.
// Sin índices nuevos: las listas por fecha usan el índice automático de un campo.
import {
  Timestamp, addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, where,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { MENSAJES_CITA, expiraCita } from '../../../../lib/citasTaller';

export const TAMANO_LISTA_CITAS = 100;

const citasRef = (tallerId) => collection(db, 'talleres', tallerId, 'citas');
const citaRef = (tallerId, id) => doc(db, 'talleres', tallerId, 'citas', id);
const conId = (d) => ({ id: d.id, ...d.data() });

// Lo que se guarda de una cita (datos ya validados con validarCita).
function campos(d) {
  return {
    fecha: Timestamp.fromDate(d.fecha),
    nombre: d.nombre, telefono: d.telefono, vehiculo: d.vehiculo, placas: d.placas, motivo: d.motivo, estado: d.estado,
    actualizadoAt: serverTimestamp(),
    expiraAt: Timestamp.fromDate(expiraCita(d.fecha)),
  };
}

// De hoy en adelante, de la más cercana a la más lejana.
export async function listarProximas(tallerId, desde) {
  const snap = await getDocs(query(citasRef(tallerId), where('fecha', '>=', Timestamp.fromDate(desde)), orderBy('fecha'), limit(TAMANO_LISTA_CITAS)));
  return snap.docs.map(conId);
}

// Antes de hoy, de la más reciente a la más vieja (se borran solas a los 30 días).
export async function listarPasadas(tallerId, antesDe) {
  const snap = await getDocs(query(citasRef(tallerId), where('fecha', '<', Timestamp.fromDate(antesDe)), orderBy('fecha', 'desc'), limit(TAMANO_LISTA_CITAS)));
  return snap.docs.map(conId);
}

export async function leerCita(tallerId, id) {
  const snap = await getDoc(citaRef(tallerId, id));
  return snap.exists() ? conId(snap) : null;
}

// Alta con ID automático. Devuelve el ID. Errores en español.
export async function crearCita({ tallerId, datos }) {
  try {
    const r = await addDoc(citasRef(tallerId), { ...campos(datos), creadoAt: serverTimestamp() });
    return r.id;
  } catch (err) {
    console.error('[citas] No se pudo crear', err);
    throw new Error(MENSAJES_CITA.guardarFallo);
  }
}

// Edición completa (creadoAt no se toca; la fecha de borrado sigue a la fecha de la cita).
export async function guardarCita({ tallerId, id, datos }) {
  try {
    await updateDoc(citaRef(tallerId, id), campos(datos));
  } catch (err) {
    console.error('[citas] No se pudo guardar', err);
    throw new Error(MENSAJES_CITA.guardarFallo);
  }
}

export async function cambiarEstadoCita({ tallerId, id, estado }) {
  try {
    await updateDoc(citaRef(tallerId, id), { estado, actualizadoAt: serverTimestamp() });
  } catch (err) {
    console.error('[citas] No se pudo cambiar el estado', err);
    throw new Error(MENSAJES_CITA.estadoFallo);
  }
}

export function borrarCita(tallerId, id) {
  return deleteDoc(citaRef(tallerId, id));
}
