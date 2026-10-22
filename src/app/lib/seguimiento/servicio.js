import { doc, getDoc } from 'firebase/firestore';
import { obtenerDbServicio } from '../pedidosClientes/servicio';
import { claveLimite, hashCodigo } from '../../../lib/pedidosClientesServidor';
import { crearManejadoresSeguimiento } from './manejadores';

// Solo servidor. Usa la MISMA identidad de servicio que el pedido de clientes (obtenerDbServicio:
// MECANIX_SERVICIO_EMAIL / MECANIX_SERVICIO_PASSWORD en Vercel). Las reglas solo le dejan leer
// seguimientos/{huella} con get (nunca list), y nunca órdenes ni talleres.

// config/ordenes.seguimientoHabilitado, con caché de 1 minuto por instancia. Si no se puede leer,
// el error sube y la ruta responde "no disponible" (falla cerrada).
let cacheConfig = { valor: null, en: 0 };
async function habilitado(db) {
  if (Date.now() - cacheConfig.en >= 60 * 1000) {
    const snap = await getDoc(doc(db, 'config', 'ordenes'));
    cacheConfig = { valor: snap.exists() ? snap.data() : null, en: Date.now() };
  }
  return cacheConfig.valor?.seguimientoHabilitado === true;
}

async function leerSeguimiento(db, huella) {
  const snap = await getDoc(doc(db, 'seguimientos', huella));
  return snap.exists() ? snap.data() : null;
}

let manejadores = null;
export function manejadoresSeguimiento() {
  if (!manejadores) {
    manejadores = crearManejadoresSeguimiento({
      obtenerDb: obtenerDbServicio, habilitado, leerSeguimiento, hashCodigo, claveLimite, ahora: () => new Date(),
    });
  }
  return manejadores;
}
