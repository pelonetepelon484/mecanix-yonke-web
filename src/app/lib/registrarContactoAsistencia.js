import { doc, increment, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { COLECCION_ASISTENCIA, mesContadorAsistencia } from '../../lib/asistenciaVial';

// Toque en "Llamar" (tipo 'llamadas') o "WhatsApp" (tipo 'whatsapp') de un proveedor de asistencia
// vial: asistenciaVial/{id}/contactos/{AAAA-MM}. No guarda nada de quien toca. Fire-and-forget,
// igual que registrarContactoRefaccionaria: nunca retrasa la llamada ni WhatsApp.
export function registrarContactoAsistencia(proveedorId, tipo) {
  if (!proveedorId || (tipo !== 'llamadas' && tipo !== 'whatsapp')) return;
  setDoc(doc(db, COLECCION_ASISTENCIA, proveedorId, 'contactos', mesContadorAsistencia()), { [tipo]: increment(1) }, { merge: true })
    .catch((error) => console.warn('[registrarContactoAsistencia] ignorado:', error?.code || error?.message));
  if (typeof window !== 'undefined' && window.gtag) window.gtag('event', 'asistencia_vial_contacto', { tipo });
}
