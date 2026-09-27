import { doc, setDoc, increment } from 'firebase/firestore';
import { db } from './firebase';

// Clave del documento acumulador: uno por vehículo y mes (yyyy-mm), para no acumular un
// documento nuevo por cada clic. Sin límite por IP — se retiró junto con el endpoint de Admin
// SDK; la única defensa contra abuso es la regla de Firestore (solo permite crear con clics:1 y
// actualizar sumando exactamente 1, ver más abajo).
function claveContador(vehiculoId, fecha = new Date()) {
  const mes = fecha.toISOString().slice(0, 7);
  const vehiculoSeguro = (vehiculoId || 'x').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
  return `${vehiculoSeguro}_${mes}`;
}

// "Toques al botón de WhatsApp" de un vehículo — fire-and-forget, con el SDK normal del
// navegador: nunca bloquea ni retrasa que se abra WhatsApp (el enlace <a target="_blank"> ya
// navega por su cuenta). Cualquier falla se ignora en silencio, igual que registrarActividadYonke.
//
// setDoc con merge:true sirve para los dos casos con una sola llamada: si el documento no existe,
// lo crea con clics:1 (increment(1) sobre un campo ausente empieza en 0); si ya existe, suma 1 de
// forma atómica. Regla de Firestore esperada en yonkes/{id}/contactosVehiculo/{docId}:
//   allow read: if false;
//   allow create: if request.resource.data.keys().hasOnly(['clics']) && request.resource.data.clics == 1;
//   allow update: if request.resource.data.diff(resource.data).affectedKeys().hasOnly(['clics'])
//     && request.resource.data.clics == resource.data.clics + 1;
export function registrarContactoVehiculo(yonkeId, vehiculoId) {
  if (!yonkeId || !vehiculoId) return;
  const ref = doc(db, 'yonkes', yonkeId, 'contactosVehiculo', claveContador(vehiculoId));
  setDoc(ref, { clics: increment(1) }, { merge: true })
    .catch((error) => console.warn('[registrarContactoVehiculo] ignorado:', error?.code || error?.message));
}
