import { after } from 'next/server';
import {
  Timestamp, collection, doc, getDoc, getDocs, increment, limit, query, runTransaction, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { dbServer } from '../firebase-server';
import { obtenerDbServicio } from '../pedidosClientes/servicio';
import { leerComoUsuario, uidDeToken } from '../avisosAdmin/identidadUsuario';
import { hashConSal } from '../../../lib/rateLimitId';
import { leerConfigComparador } from '../../../lib/configComparador';
import { CAMPOS_VEHICULO } from '../../../lib/comparadorPiezas';
import { COLECCION_SUGERENCIAS, idSugerencia } from '../../../lib/equivalencias';
import { decodificarVpic } from './vpic';
import { buscarConClaude } from './buscarConClaude';
import { crearManejadorComparador } from './manejador';

// Solo servidor. Dependencias reales del comparador. Usa la MISMA identidad de servicio que los
// pedidos de clientes y asistencia vial (MECANIX_SERVICIO_EMAIL / _PASSWORD en Vercel): sin llaves
// nuevas. Colecciones (solo el servicio las lee y escribe; ver firestore.rules):
//   comparadorLimite/{tipo_hash_dia}   { count, actualizado, expiraEn }   (TTL en expiraEn)
//   comparadorUso/{AAAA-MM-DD}          conteos del día, sin datos personales
//   vinDecodificado/{clave sin serie}   caché de vPIC
//   equivalenciasPiezas/{id}            tabla propia (la llena el admin en /admin/equivalencias)
//   sugerenciasEquivalencia/{tipo_A_B}  búsqueda automática (apagada por defecto), la revisa el admin
export const COLECCION_LIMITE = 'comparadorLimite';
export const COLECCION_USO = 'comparadorUso';
export const COLECCION_VIN = 'vinDecodificado';
export const COLECCION_EQUIVALENCIAS = 'equivalenciasPiezas';

// config/comparador se cachea 1 minuto por instancia.
let cacheConfig = { valor: null, en: 0 };
async function leerConfig() {
  if (!cacheConfig.valor || Date.now() - cacheConfig.en >= 60 * 1000) {
    cacheConfig = { valor: await leerConfigComparador(dbServer), en: Date.now() };
  }
  return cacheConfig.valor;
}

async function contarLimite(db, id, max, expiraEn) {
  const ref = doc(db, COLECCION_LIMITE, id);
  return runTransaction(db, async (t) => {
    const snap = await t.get(ref);
    const actual = snap.exists() ? (snap.data().count || 0) : 0;
    if (actual >= max) return false;
    t.set(ref, { count: actual + 1, actualizado: Timestamp.now(), expiraEn: Timestamp.fromDate(expiraEn) });
    return true;
  });
}

async function devolverLimite(db, id) {
  const ref = doc(db, COLECCION_LIMITE, id);
  await runTransaction(db, async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists()) return;
    const d = snap.data();
    t.set(ref, { count: Math.max(0, (d.count || 0) - 1), actualizado: Timestamp.now(), expiraEn: d.expiraEn });
  });
}

async function leerCacheVin(db, clave) {
  const snap = await getDoc(doc(db, COLECCION_VIN, clave));
  if (!snap.exists()) return null;
  const d = snap.data();
  const vehiculo = { sinDatos: d.sinDatos === true };
  for (const c of CAMPOS_VEHICULO) vehiculo[c.key] = typeof d[c.key] === 'string' ? d[c.key] : '';
  return vehiculo;
}

async function guardarCacheVin(db, clave, vehiculo) {
  const datos = { sinDatos: vehiculo.sinDatos === true, guardadoAt: serverTimestamp() };
  for (const c of CAMPOS_VEHICULO) datos[c.key] = vehiculo[c.key] || '';
  await setDoc(doc(db, COLECCION_VIN, clave), datos);
}

async function sumarUso(db, dia, cambios) {
  const datos = { actualizadoAt: serverTimestamp() };
  for (const [k, v] of Object.entries(cambios)) if (v) datos[k] = increment(v);
  await setDoc(doc(db, COLECCION_USO, dia), datos, { merge: true });
}

const mismo = (a, b) => typeof a === 'string' && typeof b === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase() && a.trim() !== '';
const sirveParaTipo = (d, tipo) => !d.tipoPieza || d.tipoPieza === tipo;

// ¿Este registro "aplicacion" (parte -> vehículo) es del vehículo dado?
export function aplicaA(d, clave, vehiculo) {
  if (clave && d.claveVin === clave) return true;
  if (!vehiculo || vehiculo.sinDatos || !mismo(d.marca, vehiculo.marca) || !mismo(d.modelo, vehiculo.modelo)) return false;
  const anio = Number(vehiculo.anio);
  if (!anio) return false;
  const desde = Number.isInteger(d.anioDesde) ? d.anioDesde : null;
  const hasta = Number.isInteger(d.anioHasta) ? d.anioHasta : null;
  return desde !== null && hasta !== null && anio >= desde && anio <= hasta;
}

async function buscarRegistros(db, { tipo, parteA, parteB, claveA, claveB, vehiculoA, vehiculoB }) {
  const col = collection(db, COLECCION_EQUIVALENCIAS);
  let equivalentes = false;
  if (parteA && parteB && parteA !== parteB) {
    const snap = await getDocs(query(col, where('partes', 'array-contains', parteA), limit(50)));
    equivalentes = snap.docs.some((s) => {
      const d = s.data();
      return d.clase === 'equivalencia' && sirveParaTipo(d, tipo) && Array.isArray(d.partes) && d.partes.includes(parteB);
    });
  }
  let aplicacion = false;
  for (const [parte, clave, vehiculo] of [[parteA, claveB, vehiculoB], [parteB, claveA, vehiculoA]]) {
    if (aplicacion || !parte || (!clave && !vehiculo)) continue;
    const snap = await getDocs(query(col, where('parte', '==', parte), limit(50)));
    aplicacion = snap.docs.some((s) => {
      const d = s.data();
      return d.clase === 'aplicacion' && sirveParaTipo(d, tipo) && aplicaA(d, clave, vehiculo);
    });
  }
  return { equivalentes, aplicacion };
}

// Búsqueda automática de una pareja (corre DESPUÉS de responder al cliente). Una transacción
// aparta la pareja y suma 1 al conteo del día; si la pareja ya existe o se llegó al límite diario,
// no busca (y no cuesta nada). Después guarda el resultado como sugerencia para el admin.
async function sugerirEquivalencia(db, { tipo, parteA, parteB, dia, limiteDiario }) {
  const ref = doc(db, COLECCION_SUGERENCIAS, idSugerencia(tipo, parteA, parteB));
  const refUso = doc(db, COLECCION_USO, dia);
  const apartada = await runTransaction(db, async (t) => {
    const [s, u] = [await t.get(ref), await t.get(refUso)];
    if (s.exists()) return false;
    if ((u.exists() ? (u.data().iaBusquedas || 0) : 0) >= limiteDiario) return false;
    const ahora = serverTimestamp();
    t.set(ref, { tipoPieza: tipo, partes: [parteA, parteB].sort(), estado: 'buscando', creadoAt: ahora, actualizadoAt: ahora });
    t.set(refUso, { iaBusquedas: increment(1), actualizadoAt: ahora }, { merge: true });
    return true;
  });
  if (!apartada) return;
  const r = await buscarConClaude({ tipo, parteA, parteB });
  await updateDoc(ref, {
    estado: r.estado,
    equivalentes: typeof r.equivalentes === 'boolean' ? r.equivalentes : null,
    confianza: r.confianza || 'baja',
    resumen: r.resumen || '',
    partesRelacionadas: r.partesRelacionadas || [],
    fuentes: r.fuentes || [],
    tokensEntrada: r.tokensEntrada || 0,
    tokensSalida: r.tokensSalida || 0,
    busquedas: r.busquedas || 0,
    actualizadoAt: serverTimestamp(),
  });
  await sumarUso(db, dia, { iaTokensEntrada: r.tokensEntrada, iaTokensSalida: r.tokensSalida, iaBusquedasWeb: r.busquedas });
}

// Corre una tarea después de responder (Next.js "after"): el cliente no espera la búsqueda.
function enSegundoPlano(tarea) {
  after(async () => {
    try { await tarea(); } catch (error) {
      console.warn('[comparador] Falló la sugerencia automática', error?.code || error?.message);
    }
  });
}

async function leerRol(token, uid) {
  const u = await leerComoUsuario(token, `usuarios/${uid}`);
  return typeof u?.rol === 'string' ? u.rol : null;
}

let manejador = null;
export function manejadorComparador() {
  if (!manejador) {
    manejador = crearManejadorComparador({
      leerConfig,
      obtenerDb: obtenerDbServicio,
      uidDeToken: (t) => uidDeToken(t),
      leerRol,
      hash: (t) => hashConSal(t),
      contarLimite,
      devolverLimite,
      leerCacheVin,
      guardarCacheVin,
      decodificar: (clave) => decodificarVpic(clave),
      buscarRegistros,
      sumarUso,
      sugerirEquivalencia,
      enSegundoPlano,
      ahora: () => new Date(),
    });
  }
  return manejador;
}
