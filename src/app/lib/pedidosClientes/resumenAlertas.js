import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { LECTURA_RESUMEN_ALERTAS, armarResumen } from '../../../lib/alertasRecientes';

// Rehace publico/alertasRecientes con las alertas abiertas más recientes. Lo llaman el servidor
// (usuario de servicio, al crear una alerta o si el resumen no existe) y el panel admin (al
// cerrar, cancelar, reabrir o borrar). Las reglas solo dejan a esos dos leerlo y escribirlo.
// Sin índices nuevos: ordena solo por creadoAt (índice automático) y filtra en memoria.
// Devuelve la lista guardada.
export async function actualizarResumenAlertas(db, ahora = new Date()) {
  const snap = await getDocs(query(collection(db, 'pedidosClientes'), orderBy('creadoAt', 'desc'), limit(LECTURA_RESUMEN_ALERTAS)));
  const alertas = armarResumen(snap.docs.map((d) => ({ id: d.id, ...d.data() })), ahora);
  await setDoc(doc(db, 'publico', 'alertasRecientes'), { alertas, actualizadoAt: serverTimestamp() });
  return alertas;
}

// La lista guardada, o null si el resumen todavía no existe.
export async function leerResumenAlertas(db) {
  const snap = await getDoc(doc(db, 'publico', 'alertasRecientes'));
  return snap.exists() ? (snap.data().alertas || []) : null;
}
