import { doc, getDoc } from 'firebase/firestore';
import { dbServer } from '../firebase-server';

// Bandera config/pedidosClientes.habilitado del lado del servidor (lectura pública, dbServer sin
// sesión), con caché de 1 minuto por instancia: /api/buscar la consulta en cada búsqueda sin
// resultados. Si la lectura falla vale false, o sea, el buscador se comporta como siempre.
const TTL_MS = 60 * 1000;
let cache = { valor: false, en: 0 };

export async function pedidosClientesActivos() {
  if (Date.now() - cache.en < TTL_MS) return cache.valor;
  let valor = false;
  try {
    const snap = await getDoc(doc(dbServer, 'config', 'pedidosClientes'));
    valor = snap.exists() && snap.data().habilitado === true;
  } catch (error) {
    console.error('[buscar] No se pudo leer config/pedidosClientes; se asume apagada', { code: error?.code, message: error?.message });
  }
  cache = { valor, en: Date.now() };
  return valor;
}
