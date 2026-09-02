import { collection, getDocs } from 'firebase/firestore';
import { dbServer } from '../firebase-server';
import { ESTADO_DEFAULT, estadoDeYonke } from '../estados';

export { ESTADO_DEFAULT, estadoDeYonke };

const TTL_MS = 10 * 60 * 1000; // 10 minutos — misma estrategia que catalogoCombinado.js:
// config chica que casi no cambia, leída potencialmente en cada búsqueda del buscador
// inteligente, así que se cachea en memoria por instancia de servidor.
let cache = null;
let cacheEn = 0;

async function construirEstados() {
  try {
    const snap = await getDocs(collection(dbServer, 'estados'));
    if (snap.empty) return [{ id: ESTADO_DEFAULT, nombre: 'Baja California', tieneVisitas: true }];
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('[estadosServer] No se pudo leer la colección estados, usando solo Baja California', {
      code: error?.code,
      message: error?.message,
    });
    return [{ id: ESTADO_DEFAULT, nombre: 'Baja California', tieneVisitas: true }];
  }
}

// Usado por route.js/consultarInventario.js para saber si un id de estado es válido y, más
// adelante, si tiene visitas — con caché para no pagar una lectura de Firestore extra en cada
// búsqueda del buscador inteligente.
export async function obtenerEstadosCombinado() {
  const ahora = Date.now();
  if (cache && (ahora - cacheEn) < TTL_MS) {
    return cache;
  }
  cache = await construirEstados();
  cacheEn = ahora;
  return cache;
}
