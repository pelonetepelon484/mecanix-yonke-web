'use client';

// Bandera de las citas: config/citas { habilitado, requierePremium }. Sin el documento devuelve
// null y la función no aparece (falla cerrada; las reglas tampoco dejan escribir). Va aparte de
// datos.js para que el inicio del taller solo cargue esta lectura.
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

export async function leerConfigCitas() {
  const snap = await getDoc(doc(db, 'config', 'citas'));
  return snap.exists() ? snap.data() : null;
}
