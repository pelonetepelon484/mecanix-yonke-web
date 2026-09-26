import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

// Marca yonkes/{id}.ultimaActividadAt = ahora (serverTimestamp). Solo lo llaman flujos del DUEÑO
// (abrir el panel, registrar una venta) — nunca admin. updateDoc, no setDoc: no puede pisar ni
// borrar otros campos del documento. Fire-and-forget: si falla (red, reglas de Firestore) se
// ignora por completo, sin afectar la pantalla ni la operación que lo disparó.
export function registrarActividadYonke(db, yonkeId) {
  if (!yonkeId) return;
  try {
    updateDoc(doc(db, 'yonkes', yonkeId), { ultimaActividadAt: serverTimestamp() })
      .catch((error) => console.warn('[registrarActividadYonke] ignorado:', error?.code || error?.message));
  } catch (error) {
    console.warn('[registrarActividadYonke] ignorado:', error?.message);
  }
}
