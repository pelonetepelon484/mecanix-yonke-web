import { collection, deleteDoc, doc, getDoc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { generarSlug, leerConfigRefaccionariasDe } from '../../../lib/refaccionarias';

// Lecturas y escrituras de la cuenta de refaccionaria (etapa 1). Las reglas de Firestore deciden
// lo que se puede: aquí solo se arman los documentos como las reglas los esperan.

// config/refaccionarias, ya interpretada (bandera, versión de términos, topes y vigencias).
export async function leerConfigRefaccionarias() {
  const snap = await getDoc(doc(db, 'config', 'refaccionarias'));
  return leerConfigRefaccionariasDe(snap.exists() ? snap.data() : null);
}

export async function leerRefaccionaria(refaccionariaId) {
  const snap = await getDoc(doc(db, 'refaccionarias', refaccionariaId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export const nuevoIdRefaccionaria = () => doc(collection(db, 'refaccionarias')).id;

// Registro: datos públicos (sin aceptar, sin Verificado ni plan) + correo en privado/datos, en un lote.
export async function crearRefaccionaria(refaccionariaId, uid, datos) {
  const lote = writeBatch(db);
  lote.set(doc(db, 'refaccionarias', refaccionariaId), {
    nombre: datos.nombre,
    whatsapp: datos.whatsapp,
    estado: datos.estado,
    ciudad: datos.ciudad,
    logoUrl: '',
    ...(datos.zonaEntrega ? { zonaEntrega: datos.zonaEntrega } : {}),
    slug: generarSlug(datos.nombre, refaccionariaId),
    ownerUid: uid,
    activo: true,
    creadoAt: serverTimestamp(),
    aceptacionVersion: '',
  });
  lote.set(doc(db, 'refaccionarias', refaccionariaId, 'privado', 'datos'), { email: datos.email });
  await lote.commit();
}

export async function borrarRefaccionaria(refaccionariaId) {
  await deleteDoc(doc(db, 'refaccionarias', refaccionariaId, 'privado', 'datos'));
  await deleteDoc(doc(db, 'refaccionarias', refaccionariaId));
}

export function crearUsuarioRefaccionaria(uid, refaccionariaId, email) {
  return setDoc(doc(db, 'usuarios', uid), { rol: 'refaccionaria', refaccionariaId, email, fechaRegistro: serverTimestamp() });
}

// Aceptación: historial + versión aceptada en un solo lote (las reglas exigen las dos cosas juntas).
export async function aceptarVersionRefaccionaria(refaccionariaId, version) {
  const lote = writeBatch(db);
  lote.set(doc(db, 'refaccionarias', refaccionariaId, 'aceptaciones', version), { version, fecha: serverTimestamp() });
  lote.update(doc(db, 'refaccionarias', refaccionariaId), { aceptacionVersion: version });
  await lote.commit();
}
