'use client';

// Acceso a Firestore de la libreta de contactos (talleres/{tallerId}/contactosClientes/{id}).
// Las reglas (firestore.rules) son la protección real: solo el dueño lee; escribir pide taller
// activo, términos vigentes y config/contactos.habilitado; en Básico solo los lugares c01 ... c25.
// Sin índices nuevos: la lista por nombreBusqueda, la búsqueda por teléfono (==), por placas
// (array-contains) y por inicio del nombre usan los índices automáticos de un campo.
import {
  Timestamp, collection, deleteDoc, doc, documentId, getDoc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, startAfter,
  updateDoc, where,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { MENSAJES_CONTACTO, RANURAS_BASICO, camposContacto, expiraContacto, idParaNuevoContacto, tipoBusqueda } from '../../../../lib/contactosTaller';

export const TAMANO_PAGINA_CONTACTOS = 50;
const TAMANO_BUSQUEDA = 20;

const contactosRef = (tallerId) => collection(db, 'talleres', tallerId, 'contactosClientes');
const contactoRef = (tallerId, id) => doc(db, 'talleres', tallerId, 'contactosClientes', id);
const conId = (d) => ({ id: d.id, ...d.data() });
const tiempos = () => ({ actualizadoAt: serverTimestamp(), expiraAt: Timestamp.fromDate(expiraContacto()) });

// Lista por nombre (A-Z), de 50 en 50.
export async function listarContactos(tallerId, cursor = null) {
  const restricciones = [orderBy('nombreBusqueda'), limit(TAMANO_PAGINA_CONTACTOS)];
  if (cursor) restricciones.push(startAfter(cursor));
  const snap = await getDocs(query(contactosRef(tallerId), ...restricciones));
  return {
    items: snap.docs.map(conId),
    cursor: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
    hayMas: snap.docs.length === TAMANO_PAGINA_CONTACTOS,
  };
}

// Búsqueda en Firestore (solo cuando la lista no está completa en pantalla): por WhatsApp exacto,
// por placas exactas o por el inicio del nombre (sin acentos ni mayúsculas).
export async function buscarContactos(tallerId, texto) {
  const b = tipoBusqueda(texto);
  if (!b) return [];
  let q;
  if (b.campo === 'telefono') q = query(contactosRef(tallerId), where('telefono', '==', b.valor), limit(TAMANO_BUSQUEDA));
  else if (b.campo === 'placasLista') q = query(contactosRef(tallerId), where('placasLista', 'array-contains', b.valor), limit(TAMANO_BUSQUEDA));
  else {
    q = query(contactosRef(tallerId), where('nombreBusqueda', '>=', b.valor), where('nombreBusqueda', '<=', `${b.valor}`), orderBy('nombreBusqueda'), limit(TAMANO_BUSQUEDA));
  }
  const snap = await getDocs(q);
  return snap.docs.map(conId);
}

export async function leerContacto(tallerId, id) {
  const snap = await getDoc(contactoRef(tallerId, id));
  return snap.exists() ? conId(snap) : null;
}

// Lugares del plan Básico ocupados (c01 ... c25): una consulta, 1 lectura por lugar ocupado.
export async function lugaresOcupados(tallerId) {
  const snap = await getDocs(query(contactosRef(tallerId), where(documentId(), 'in', RANURAS_BASICO)));
  return snap.docs.map((d) => d.id);
}

class Lleno extends Error {}

// Alta: primer lugar libre (cualquier plan); sin lugar libre, con Premium un ID automático y sin
// Premium error "lleno". En una transacción que revisa que el lugar siga libre (si otro celular lo
// tomó al mismo tiempo, vuelve a buscar una vez). Devuelve el ID. Errores en español.
export async function crearContacto({ tallerId, datos, premium }) {
  for (let intento = 0; intento < 2; intento++) {
    const r = idParaNuevoContacto(await lugaresOcupados(tallerId), premium, () => doc(contactosRef(tallerId)).id);
    if ('lleno' in r) throw new Error(MENSAJES_CONTACTO.lleno);
    try {
      await runTransaction(db, async (tx) => {
        const ref = contactoRef(tallerId, r.id);
        if ((await tx.get(ref)).exists()) throw new Lleno();
        tx.set(ref, { ...camposContacto(datos), creadoAt: serverTimestamp(), ...tiempos() });
      });
      return r.id;
    } catch (err) {
      if (err instanceof Lleno) continue;
      console.error('[contactos] No se pudo crear', err);
      throw new Error(MENSAJES_CONTACTO.guardarFallo);
    }
  }
  throw new Error(MENSAJES_CONTACTO.guardarFallo);
}

// Edición: los mismos campos; creadoAt no se toca. Renueva la fecha de borrado.
export async function guardarContacto({ tallerId, id, datos }) {
  try {
    await updateDoc(contactoRef(tallerId, id), { ...camposContacto(datos), ...tiempos() });
  } catch (err) {
    console.error('[contactos] No se pudo guardar', err);
    throw new Error(MENSAJES_CONTACTO.guardarFallo);
  }
}

// Al escribirle por WhatsApp el contacto cuenta como "usado": se renueva su fecha de borrado.
// Si no se puede (sin conexión, términos viejos...), no pasa nada: WhatsApp abre igual.
export async function marcarUsado(tallerId, id) {
  try {
    await updateDoc(contactoRef(tallerId, id), tiempos());
  } catch (err) {
    console.error('[contactos] No se pudo renovar', err);
  }
}

export function borrarContacto(tallerId, id) {
  return deleteDoc(contactoRef(tallerId, id));
}
