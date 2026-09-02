import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

// ID por defecto cuando un yonke no tiene el campo `estado` — todos los yonkes de antes de
// este cambio quedan como Baja California, sin necesidad de ninguna migración masiva de datos.
export const ESTADO_DEFAULT = 'baja-california';

// Única función que decide "¿en qué estado está este yonke?" — se usa en TODO el código
// (buscador, planes, admin) para que la regla de compatibilidad nunca se desincronice entre
// un lugar y otro. Ausente/vacío = Baja California, exactamente igual que hoy.
export function estadoDeYonke(yonkeData) {
  return yonkeData?.estado || ESTADO_DEFAULT;
}

// Lee la colección `estados` (lectura pública, ver reglas de Firestore) para llenar
// selectores en el cliente: registro, planes, filtro de búsqueda, admin. Devuelve siempre al
// menos Baja California aunque la colección todavía no exista/esté vacía, para que ningún
// selector se quede sin opciones mientras David no haya entrado a /admin/estados.
export async function cargarEstados() {
  try {
    const snap = await getDocs(collection(db, 'estados'));
    if (snap.empty) return [{ id: ESTADO_DEFAULT, nombre: 'Baja California', tieneVisitas: true, orden: 1 }];
    const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    lista.sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99) || (a.nombre || '').localeCompare(b.nombre || '', 'es'));
    return lista;
  } catch (e) {
    console.error('[estados] No se pudo cargar la colección estados, usando solo Baja California', e);
    return [{ id: ESTADO_DEFAULT, nombre: 'Baja California', tieneVisitas: true, orden: 1 }];
  }
}
