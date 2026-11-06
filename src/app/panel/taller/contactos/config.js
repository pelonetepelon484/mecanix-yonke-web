'use client';

// Bandera de la libreta de contactos: config/contactos { habilitado }. Sin el documento devuelve
// null y la función no aparece (falla cerrada; las reglas tampoco dejan escribir). Va aparte de
// datos.js para que el inicio del taller solo cargue esta lectura.
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

export async function leerConfigContactos() {
  const snap = await getDoc(doc(db, 'config', 'contactos'));
  return snap.exists() ? snap.data() : null;
}
