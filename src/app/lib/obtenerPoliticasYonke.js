import { doc, getDoc } from 'firebase/firestore';
import { politicasDesdeGarantia } from '../../lib/politicasYonke';

// Lee yonkes/{id}.garantia y la reduce con la misma función pura que usa la página pública
// /politicas — así NotaGarantiaModal.js y el tenant nunca pueden desincronizarse sobre qué
// cuenta como "políticas capturadas". `dbInstancia` es la instancia de Firestore del llamador
// (db del navegador para el panel, dbServer para el tenant) — mismo patrón que
// buscarVehiculosPorAnio(dbInstancia, ...).
export async function obtenerPoliticasYonke(dbInstancia, yonkeId) {
  const snap = await getDoc(doc(dbInstancia, 'yonkes', yonkeId));
  return politicasDesdeGarantia(snap.exists() ? snap.data().garantia : null);
}
