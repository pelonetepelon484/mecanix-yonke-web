import { initializeApp, getApps } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';

const serverApp = getApps().find(a => a.name === 'server')
  ?? initializeApp(firebaseConfig, 'server');

// El SDK de cliente de Firestore usa por default un transporte de streaming (WebChannel) pensado
// para un navegador con una sola sesión larga. Reutilizado entre peticiones en un lambda
// serverless "caliente" (Vercel), ese transporte puede degradarse bajo carga -- sin lanzar
// ningún error -- y getDocs() termina devolviendo snapshots vacíos (visto en producción: yonkes
// con inventario grande, ej. "el patos"/"el camino", con ~100+ lecturas en paralelo por página,
// tardaban ~10s y regresaban 0 vehículos/motores pese a tener inventario real en Firestore).
// experimentalAutoDetectLongPolling fuerza long-polling en vez de streaming cuando detecta que no
// está en un navegador normal -- es la mitigación documentada de Firebase para este escenario
// exacto (SDK de cliente corriendo del lado servidor). Nunca se adoptó Admin SDK aquí a propósito
// (ver la saga de firebase-admin/jose/ERR_REQUIRE_ESM en Vercel, commit del panel Demanda).
export const dbServer = initializeFirestore(serverApp, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false,
});
