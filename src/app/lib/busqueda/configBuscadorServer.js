import { doc, getDoc } from 'firebase/firestore';
import { dbServer } from '../firebase-server';
import { rangoDeConfig } from '../../../lib/rangoAnios';

// config/buscador del lado del servidor (lectura pública, dbServer sin sesión), con caché de 1
// minuto por instancia: /api/buscar lo consulta en cada búsqueda. Se lee UNA vez y de ahí salen:
// - rangoAniosServer(): el rango de años (rangoDeConfig) o null con la bandera apagada;
// - otrosEstadosSinResultadosServer(): true solo con otrosEstadosSinResultados === true;
// - otrosEstadosPorIpServer(): true solo con otrosEstadosPorIp === true;
// - scrollOtrosEstadosServer(): true solo con scrollOtrosEstados === true;
// - respaldoVehiculoServer(): AL REVÉS que las demás, encendida por omisión: solo
//   respaldoVehiculo === false la apaga (sin el campo, sin documento o si la lectura falla, sigue
//   encendida).
// Sin documento o si la lectura falla, todo apagado: el buscador queda exactamente como siempre.
const TTL_MS = 60 * 1000;
let cache = { config: null, en: 0 };

async function leerConfigBuscador() {
  if (Date.now() - cache.en < TTL_MS) return cache.config;
  let config = null;
  try {
    const snap = await getDoc(doc(dbServer, 'config', 'buscador'));
    config = snap.exists() ? snap.data() : null;
  } catch (error) {
    console.error('[buscar] No se pudo leer config/buscador; todo como siempre', { code: error?.code, message: error?.message });
  }
  cache = { config, en: Date.now() };
  return config;
}

export async function rangoAniosServer() {
  return rangoDeConfig(await leerConfigBuscador());
}

// Resultados de otros estados cuando no hay nada en el del cliente (ver otrosEstados.js).
export async function otrosEstadosSinResultadosServer() {
  return (await leerConfigBuscador())?.otrosEstadosSinResultados === true;
}

// Scroll automático hacia "Esto es lo que hay en otros estados" en la portada (OtrosEstadosResultados).
export async function scrollOtrosEstadosServer() {
  return (await leerConfigBuscador())?.scrollOtrosEstados === true;
}

// "Todos los estados" con el estado por IP del visitante (ver otrosEstadosPorIp.js).
export async function otrosEstadosPorIpServer() {
  return (await leerConfigBuscador())?.otrosEstadosPorIp === true;
}

// Respaldo por vehículo cuando la búsqueda termina sin nada (ver consultarRespaldoVehiculo).
export async function respaldoVehiculoServer() {
  return (await leerConfigBuscador())?.respaldoVehiculo !== false;
}
