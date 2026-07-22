import { doc, runTransaction } from 'firebase/firestore';
import { dbServer } from '../firebase-server';

const LIMITE_POR_MINUTO = 18;

// Contador en Firestore por IP+minuto (no en memoria — Vercel serverless no garantiza
// estado entre invocaciones). Usa una transacción para que el chequeo+incremento sea
// atómico y no se pueda rebasar el límite por una condición de carrera.
export async function permitirBusqueda(ip) {
  const minutoBucket = Math.floor(Date.now() / 60000);
  const docId = `${ip}_${minutoBucket}`.replace(/[/\s]/g, '_');
  const ref = doc(dbServer, 'busqueda_rate_limit', docId);

  return runTransaction(dbServer, async (transaction) => {
    const snap = await transaction.get(ref);
    const countActual = snap.exists() ? (snap.data().count || 0) : 0;
    if (countActual >= LIMITE_POR_MINUTO) {
      return false;
    }
    transaction.set(ref, { count: countActual + 1, actualizado: new Date() }, { merge: true });
    return true;
  });
}

export const MENSAJE_RATE_LIMIT = 'Estás buscando muy seguido — espera un momento y vuelve a intentar.';
