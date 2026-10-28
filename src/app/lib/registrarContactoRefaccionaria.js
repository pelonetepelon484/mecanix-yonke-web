import { doc, setDoc, increment } from 'firebase/firestore';
import { db } from './firebase';

// Mes del contador (AAAA-MM), igual que el de los vehículos (registrarContactoVehiculo.js).
export const mesContador = (fecha = new Date()) => fecha.toISOString().slice(0, 7);

// "Toques al botón de WhatsApp" de una refaccionaria: refaccionarias/{id}/contactos/{AAAA-MM}.
// Fire-and-forget: nunca retrasa que se abra WhatsApp; cualquier falla se ignora. La regla solo
// deja crear con clics: 1 y sumar exactamente 1 (setDoc con merge + increment cubre los dos casos).
export function registrarContactoRefaccionaria(refaccionariaId) {
  if (!refaccionariaId) return;
  setDoc(doc(db, 'refaccionarias', refaccionariaId, 'contactos', mesContador()), { clics: increment(1) }, { merge: true })
    .catch((error) => console.warn('[registrarContactoRefaccionaria] ignorado:', error?.code || error?.message));
}
