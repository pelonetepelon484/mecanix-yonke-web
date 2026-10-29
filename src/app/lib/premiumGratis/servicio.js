import { Timestamp, doc, getDoc, runTransaction } from 'firebase/firestore';
import { dbServer } from '../firebase-server';
import { obtenerDbServicio } from '../pedidosClientes/servicio';
import { claveLimite } from '../../../lib/pedidosClientesServidor';
import { leerComoUsuario, uidDeToken } from '../avisosAdmin/identidadUsuario';
import { ORIGEN_PROMO } from '../../../lib/premiumGratis';
import { crearManejadorPremiumGratis } from './manejadores';

// Solo servidor. Dependencias reales de la promoción de Premium gratis para talleres.

// config/talleres se cachea 1 minuto por instancia (igual que config/pedidosClientes).
let cacheConfig = { valor: null, en: 0 };
async function leerConfig() {
  if (Date.now() - cacheConfig.en < 60 * 1000) return cacheConfig.valor;
  const snap = await getDoc(doc(dbServer, 'config', 'talleres'));
  const valor = snap.exists() ? snap.data() : null;
  cacheConfig = { valor, en: Date.now() };
  return valor;
}

// Una sola transacción con el usuario de servicio: si alguna huella ya existe -> 'yaUsada' (no se
// escribe nada); si no, Premium del taller + las huellas. Las huellas usan el formato de los
// contadores de pedidosClientesLimite ({ count, actualizado, expiraEn }), así que no hacen falta
// reglas nuevas para ellas; expiraEn las borra solas (política TTL).
export async function otorgar(db, { tallerId, premiumHasta, huellas, vidaHuellaMs }) {
  return runTransaction(db, async (t) => {
    const refs = huellas.map((clave) => doc(db, 'pedidosClientesLimite', clave));
    const snaps = await Promise.all(refs.map((r) => t.get(r)));
    if (snaps.some((s) => s.exists())) return 'yaUsada';
    t.update(doc(db, 'talleres', tallerId), {
      plan: 'premium', premiumHasta: Timestamp.fromDate(premiumHasta), premiumOrigen: ORIGEN_PROMO,
    });
    const ahora = new Date();
    for (const r of refs) {
      t.set(r, { count: 1, actualizado: ahora, expiraEn: Timestamp.fromMillis(ahora.getTime() + vidaHuellaMs) });
    }
    return 'otorgada';
  });
}

let manejador = null;
export function manejadorPremiumGratis() {
  if (!manejador) {
    manejador = crearManejadorPremiumGratis({
      leerConfig, uidDeToken, leerComoUsuario, obtenerDb: obtenerDbServicio, claveLimite, otorgar, ahora: () => new Date(),
    });
  }
  return manejador;
}
