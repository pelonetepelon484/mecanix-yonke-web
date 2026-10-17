import { doc, getDoc } from 'firebase/firestore';
import { dbServer } from '../firebase-server';
import { rangoDeConfig } from '../../../lib/rangoAnios';

// config/buscador del lado del servidor (lectura pública, dbServer sin sesión), con caché de 1
// minuto por instancia: /api/buscar lo consulta en cada búsqueda. Devuelve el rango de años
// (rangoDeConfig) o null con la bandera apagada, sin documento o si la lectura falla: el buscador
// queda exactamente como siempre.
const TTL_MS = 60 * 1000;
let cache = { valor: null, en: 0 };

export async function rangoAniosServer() {
  if (Date.now() - cache.en < TTL_MS) return cache.valor;
  let valor = null;
  try {
    const snap = await getDoc(doc(dbServer, 'config', 'buscador'));
    valor = rangoDeConfig(snap.exists() ? snap.data() : null);
  } catch (error) {
    console.error('[buscar] No se pudo leer config/buscador; rango de siempre', { code: error?.code, message: error?.message });
  }
  cache = { valor, en: Date.now() };
  return valor;
}
