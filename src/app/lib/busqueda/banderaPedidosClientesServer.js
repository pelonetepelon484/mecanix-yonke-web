import { doc, getDoc } from 'firebase/firestore';
import { dbServer } from '../firebase-server';
import { inventarioVehiculosActivo } from '../../../lib/vehiculosAlerta';

// Bandera config/pedidosClientes.habilitado del lado del servidor (lectura pública, dbServer sin
// sesión), con caché de 1 minuto por instancia: /api/buscar la consulta en cada búsqueda sin
// resultados. Si la lectura falla vale false, o sea, el buscador se comporta como siempre.
const TTL_MS = 60 * 1000;
let cache = { config: null, en: 0 };

async function leerConfig() {
  if (Date.now() - cache.en < TTL_MS) return cache.config;
  let config = null;
  try {
    const snap = await getDoc(doc(dbServer, 'config', 'pedidosClientes'));
    config = snap.exists() ? snap.data() : null;
  } catch (error) {
    console.error('[buscar] No se pudo leer config/pedidosClientes; se asume apagada', { code: error?.code, message: error?.message });
  }
  cache = { config, en: Date.now() };
  return config;
}

export async function pedidosClientesActivos() {
  return (await leerConfig())?.habilitado === true;
}

// Segunda bandera, mismo documento y misma caché: inventario de vehículos completos de las alertas.
export async function inventarioVehiculosActivoServer() {
  return inventarioVehiculosActivo(await leerConfig());
}
