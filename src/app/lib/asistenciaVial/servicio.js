import { Timestamp, deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { dbServer } from '../firebase-server';
import { obtenerDbServicio } from '../pedidosClientes/servicio';
import { hashCodigo } from '../../../lib/pedidosClientesServidor';
import { leerConfigPortada } from '../../../lib/configPortada';
import { COLECCION_ASISTENCIA } from '../../../lib/asistenciaVial';
import { COLECCION_CHECKINS, COLECCION_UBICACIONES } from '../../../lib/ubicacionAsistencia';
import { crearManejadorAqui } from './aqui';

// Solo servidor. Usa la MISMA identidad de servicio que el pedido de clientes y el seguimiento
// (MECANIX_SERVICIO_EMAIL / MECANIX_SERVICIO_PASSWORD en Vercel): sin llaves nuevas. Las reglas
// solo le dejan leer checkinsAsistencia/{huella} uno por uno y escribir ubicacionesAsistencia
// con la forma válida (ver firestore.rules).

// config/portada se cachea 1 minuto por instancia.
let cacheBanderas = { valor: null, en: 0 };
async function leerBanderas() {
  if (Date.now() - cacheBanderas.en >= 60 * 1000) {
    cacheBanderas = { valor: await leerConfigPortada(dbServer), en: Date.now() };
  }
  return cacheBanderas.valor;
}

const leer = async (db, ...ruta) => {
  const snap = await getDoc(doc(db, ...ruta));
  return snap.exists() ? snap.data() : null;
};

let manejador = null;
export function manejadorAqui() {
  if (!manejador) {
    manejador = crearManejadorAqui({
      leerBanderas,
      obtenerDb: obtenerDbServicio,
      hash: hashCodigo,
      leerCheckin: (db, huella) => leer(db, COLECCION_CHECKINS, huella),
      leerProveedor: (db, id) => leer(db, COLECCION_ASISTENCIA, id),
      leerUbicacion: (db, id) => leer(db, COLECCION_UBICACIONES, id),
      guardarUbicacion: (db, id, { lat, lng, hastaMs }) => setDoc(doc(db, COLECCION_UBICACIONES, id), {
        lat, lng, hastaAt: Timestamp.fromMillis(hastaMs), actualizadoAt: serverTimestamp(),
      }),
      borrarUbicacion: (db, id) => deleteDoc(doc(db, COLECCION_UBICACIONES, id)),
    });
  }
  return manejador;
}
