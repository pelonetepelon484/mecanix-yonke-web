import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '../../lib/firebase-admin';
import { codigoGeoDeEstado } from '../../../lib/estadoGeoMapping';
import { construirReporteDemanda } from '../../../lib/reporteDemandaYonke';
import { CORTE_BUSQUEDAS_CONFIABLES } from '../../lib/busqueda/corteBusquedasConfiables';

// firebase-admin usa APIs nativas de Node (no soportadas en el runtime Edge) -- forzarlo explícito
// evita que el build lo trate como Edge en algún escenario y rompa la carga del módulo.
export const runtime = 'nodejs';

// Versión reducida del "Mapa de búsquedas" de admin, para el panel del yonke: solo su propio
// estado, sin ningún número (ni totales, ni conteos, ni porcentajes — ver reporteDemandaYonke.ts).
// Por eso usa Admin SDK en vez de abrir las reglas de Firestore de `busquedas` a los yonkes: el
// yonke NUNCA lee esa colección directo, solo recibe la tabla ya reducida que arma este endpoint.
//
// El estado a consultar SIEMPRE se deriva del yonke autenticado (yonkes/{id}.estado) — nunca de
// un parámetro que mande el cliente. Así ningún yonke puede pedir el reporte de otro estado ni de
// otro yonke con solo cambiar la URL.

const PERIODOS_VALIDOS = { '7': 7, '30': 30 };
const PERIODO_DEFAULT_DIAS = 7;
// Agrupación decidida con datos reales (auditoría 2026-09-29): sin año da el mismo número de
// filas que con año al volumen actual, y llega al mínimo de 2 más rápido en estados con menos
// búsquedas — ver src/lib/reporteDemandaYonke.ts.
const INCLUIR_ANIO = false;

// Caché en memoria a nivel de módulo, por estado geográfico + periodo (NO por yonke: todos los
// yonkes del mismo estado comparten exactamente el mismo resultado, así que cachear por yonke
// desperdiciaría el beneficio). 45 min, dentro del rango pedido (30-60). Vive mientras la
// instancia de servidor esté tibia — un cold start simplemente recalcula, nunca sirve datos
// incorrectos.
const TTL_CACHE_MS = 45 * 60 * 1000;
const cache = new Map();

function obtenerToken(request) {
  const header = request.headers.get('authorization') || '';
  const match = /^Bearer (.+)$/.exec(header);
  return match ? match[1] : null;
}

export async function GET(request) {
  const auth = getAdminAuth();
  const db = getAdminDb();
  if (!auth || !db) {
    console.error('[demanda-yonke] Admin SDK sin credenciales configuradas (FIREBASE_SERVICE_ACCOUNT_KEY)');
    return NextResponse.json({ error: 'Servicio no disponible por ahora' }, { status: 503 });
  }

  const token = obtenerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  let uid;
  try {
    ({ uid } = await auth.verifyIdToken(token));
  } catch (error) {
    console.warn('[demanda-yonke] Token inválido', error?.code || error?.message);
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
  }

  // Rol y yonke del que llama — nunca se confía en nada que mande el cliente aparte del token.
  let usuarioSnap;
  try {
    usuarioSnap = await db.collection('usuarios').doc(uid).get();
  } catch (error) {
    console.error('[demanda-yonke] Error leyendo usuarios/{uid}', { code: error?.code, message: error?.message });
    return NextResponse.json({ error: 'No se pudo generar el reporte' }, { status: 500 });
  }
  const usuarioData = usuarioSnap.exists ? usuarioSnap.data() : null;
  if (!usuarioData || usuarioData.rol !== 'yonke' || !usuarioData.yonkeId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  // Yonke desactivado o borrado (cascada de admin/page.js): mismo 403 genérico -- no hace falta
  // distinguir el motivo exacto para quien llama.
  let yonkeSnap;
  try {
    yonkeSnap = await db.collection('yonkes').doc(usuarioData.yonkeId).get();
  } catch (error) {
    console.error('[demanda-yonke] Error leyendo yonkes/{id}', { code: error?.code, message: error?.message });
    return NextResponse.json({ error: 'No se pudo generar el reporte' }, { status: 500 });
  }
  if (!yonkeSnap.exists || yonkeSnap.data().activo === false) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  // Disponible para todos los yonkes activos sin importar su plan (decisión explícita) — a
  // propósito no hay ningún chequeo de `plan` aquí.
  const estadoId = yonkeSnap.data().estado || 'baja-california'; // mismo default que estadoDeYonke()
  const codigoGeo = codigoGeoDeEstado(estadoId);
  if (!codigoGeo) {
    // Id de estado sin código conocido (dato corrupto, o un estado nuevo que aún no se agregó a
    // estadoGeoMapping.ts) -- nunca es un error del cliente; se responde vacío, igual que "sin
    // datos todavía", en vez de un 500 o exponer el id crudo.
    return NextResponse.json({ filas: [] });
  }

  const url = new URL(request.url);
  const dias = PERIODOS_VALIDOS[url.searchParams.get('periodo')] ?? PERIODO_DEFAULT_DIAS;

  const claveCache = `${codigoGeo}_${dias}`;
  const ahora = Date.now();
  const enCache = cache.get(claveCache);
  if (enCache && enCache.expiraEn > ahora) {
    return NextResponse.json(enCache.valor);
  }

  // Corte de confiabilidad SIEMPRE aplicado, además de la ventana de 7/30 días (decisión
  // explícita) -- hoy es casi siempre redundante (el corte ya quedó atrás), pero deja de serlo
  // con el tiempo si algún día se usa una ventana más larga.
  const desde = new Date(ahora);
  desde.setDate(desde.getDate() - dias);
  const corteEfectivo = desde > CORTE_BUSQUEDAS_CONFIABLES ? desde : CORTE_BUSQUEDAS_CONFIABLES;

  let snap;
  try {
    snap = await db.collection('busquedas')
      .where('estadoGeografico', '==', codigoGeo)
      .where('fecha', '>=', Timestamp.fromDate(corteEfectivo))
      .get();
  } catch (error) {
    console.error('[demanda-yonke] Error consultando busquedas (¿falta el índice compuesto estadoGeografico+fecha?)', {
      code: error?.code, message: error?.message,
    });
    return NextResponse.json({ error: 'No se pudo generar el reporte' }, { status: 500 });
  }

  const busquedas = snap.docs
    .map((d) => d.data())
    .filter((d) => d.estado !== 'pieza_sin_vehiculo' && d.sinVehiculo !== true)
    .map((d) => ({
      pieza: typeof d.pieza === 'string' ? d.pieza : null,
      marca: typeof d.marca === 'string' ? d.marca : null,
      modelo: typeof d.modelo === 'string' ? d.modelo : null,
      anio: typeof d.anio === 'number' ? d.anio : null,
      conResultado: d.conResultado === true,
    }));

  const filas = construirReporteDemanda(busquedas, { incluirAnio: INCLUIR_ANIO });
  const respuesta = { filas };
  cache.set(claveCache, { valor: respuesta, expiraEn: ahora + TTL_CACHE_MS });

  return NextResponse.json(respuesta);
}
