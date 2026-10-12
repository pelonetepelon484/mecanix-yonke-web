// Solo servidor. Dependencias reales de los avisos en el dispositivo: Firestore con el usuario de
// servicio (el mismo de pedidosClientes) y FCM con la cuenta de servicio de las variables de entorno.
import { collection, deleteDoc, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { claveLimite } from '../../../lib/pedidosClientesServidor';
import { crearAvisarYonkes } from './avisarYonkes';
import { crearClienteFcm, leerCredenciales } from './fcm';

// config/notificaciones se cachea 1 minuto por instancia.
let cacheConfig = { valor: false, en: 0 };
async function habilitado(db) {
  if (Date.now() - cacheConfig.en < 60 * 1000) return cacheConfig.valor;
  const snap = await getDoc(doc(db, 'config', 'notificaciones'));
  const valor = snap.exists() && snap.data().habilitado === true;
  cacheConfig = { valor, en: Date.now() };
  return valor;
}

let cliente;
function clienteFcm() {
  if (cliente === undefined) {
    const credenciales = leerCredenciales();
    cliente = credenciales ? crearClienteFcm({ credenciales }) : null;
  }
  return cliente;
}

async function yonkesDelEstado(db, estado) {
  if (typeof estado !== 'string' || !estado) return [];
  const snap = await getDocs(query(collection(db, 'yonkes'), where('estado', '==', estado), where('activo', '==', true)));
  return snap.docs.map((d) => ({ id: d.id }));
}

async function yonkesOtrosEstados(db) {
  const snap = await getDocs(query(collection(db, 'yonkes'), where('verAlertasOtrosEstados', '==', true)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Firestore admite hasta 30 valores en un "in".
async function dispositivosDe(db, yonkeIds) {
  const lista = [];
  for (let i = 0; i < yonkeIds.length; i += 30) {
    const snap = await getDocs(query(collection(db, 'dispositivosPush'), where('yonkeId', 'in', yonkeIds.slice(i, i + 30))));
    for (const d of snap.docs) lista.push({ docId: d.id, yonkeId: d.data().yonkeId, token: d.data().token });
  }
  return lista;
}

const borrarDispositivo = (db, docId) => deleteDoc(doc(db, 'dispositivosPush', docId));

// `contar` llega de quien llama (pedidosClientes/servicio.js), para no importarlo de ida y vuelta.
export function crearAvisarYonkesReal({ contar }) {
  return crearAvisarYonkes({
    habilitado, cliente: clienteFcm, yonkesDelEstado, yonkesOtrosEstados, dispositivosDe, borrarDispositivo,
    contar, claveLimite, ahora: () => new Date(),
  });
}
