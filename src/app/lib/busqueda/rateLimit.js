import { doc, runTransaction, Timestamp } from 'firebase/firestore';
import { dbServer } from '../firebase-server';
import { idContadorRateLimit } from '../../../lib/rateLimitId';
import { conFallbackDePermisos } from '../../../lib/conFallbackDePermisos';

const LIMITE_POR_MINUTO = 18;

// Contador en Firestore por IP+minuto (no en memoria — Vercel serverless no garantiza
// estado entre invocaciones). Usa una transacción para que el chequeo+incremento sea
// atómico y no se pueda rebasar el límite por una condición de carrera.
export async function permitirBusqueda(ip) {
  const minutoBucket = Math.floor(Date.now() / 60000);
  // El ID lleva un hash (HMAC) de la IP, no la IP: ver src/lib/rateLimitId.ts.
  const docId = idContadorRateLimit(ip, minutoBucket);
  const ref = doc(dbServer, 'busqueda_rate_limit', docId);

  const contar = (conExpiracion) => runTransaction(dbServer, async (transaction) => {
    const snap = await transaction.get(ref);
    const countActual = snap.exists() ? (snap.data().count || 0) : 0;
    if (countActual >= LIMITE_POR_MINUTO) {
      return false;
    }
    // expiraEn: campo para la política TTL de Firestore (limpieza automática de contadores viejos).
    // Un contador solo importa durante su minuto; se conserva 1 hora por margen y se borra solo.
    transaction.set(ref, {
      count: countActual + 1,
      actualizado: new Date(),
      ...(conExpiracion ? { expiraEn: Timestamp.fromMillis((minutoBucket + 60) * 60000) } : {}),
    }, { merge: true });
    return true;
  });
  // Si las reglas todavía no permiten `expiraEn`, se cuenta igual sin ese campo — de lo contrario
  // el rate limit fallaría abierto (ver route.js) y dejaría de aplicarse en silencio.
  return conFallbackDePermisos(() => contar(true), () => contar(false), 'rate limit expiraEn');
}

export const MENSAJE_RATE_LIMIT = 'Estás buscando muy seguido — espera un momento y vuelve a intentar.';
