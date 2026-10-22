'use client';

// Acceso a Firestore para órdenes de servicio (etapa 1). Trabajos y piezas van DENTRO de la orden
// (listas de máximo 20), así que abrir una orden cuesta 1 lectura y guardarla 1 escritura.
// Las reglas (firestore.rules) son la protección real: esta capa solo prepara datos correctos,
// incluida la fecha de borrado (expiraAt) que las reglas exigen con sus fórmulas.
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, startAfter, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { MENSAJES_CONVERSION, generarFolioOrden, ordenDesdeCotizacion, planBorrado, totalOrdenCentavos, validarConversion } from '../../../../lib/ordenes';
import { ordenConSeguimiento } from '../../../../lib/avisoOrden';
import {
  MENSAJES_SEGUIMIENTO, documentoSeguimiento, generarTokenSeguimiento, huellaSeguimiento, validarNotaSeguimiento, venceSeguimiento,
} from '../../../../lib/seguimiento';
import { leerCotizacion } from '../cotizaciones/datos';

export const TAMANO_PAGINA = 20;

const ordenesRef = (tallerId) => collection(db, 'talleres', tallerId, 'ordenes');
const ordenRef = (tallerId, folio) => doc(db, 'talleres', tallerId, 'ordenes', folio);

// Bandera de la función: { habilitado, datosClienteHabilitados, avisoOrdenVersion }. Sin el
// documento devuelve null y no aparece nada (falla cerrada; las reglas tampoco dejan crear).
export async function leerConfigOrdenes() {
  const snap = await getDoc(doc(db, 'config', 'ordenes'));
  return snap.exists() ? snap.data() : null;
}

// Lista: 1 lectura por orden mostrada, de la más reciente a la más vieja, de 20 en 20.
// Con filtro de estado usa el índice compuesto estado + actualizadoAt (desc). Sin escuchas en vivo.
// Las vencidas que el TTL aún no borra no se muestran.
// direccion: 'desc' (más recientes primero) o 'asc' (más antiguas primero). 'asc' solo sin filtro de
// estado: usa el índice automático de actualizadoAt y NO necesita índice nuevo (con filtro de estado
// pediría uno compuesto estado + actualizadoAt ascendente, que no existe a propósito).
export async function listarOrdenes(tallerId, { estado = 'todos', cursor = null, direccion = 'desc' } = {}) {
  const restricciones = [];
  if (estado !== 'todos') restricciones.push(where('estado', '==', estado));
  const dir = estado === 'todos' && direccion === 'asc' ? 'asc' : 'desc';
  restricciones.push(orderBy('actualizadoAt', dir), limit(TAMANO_PAGINA));
  if (cursor) restricciones.push(startAfter(cursor));
  const snap = await getDocs(query(ordenesRef(tallerId), ...restricciones));
  const ahora = Date.now();
  return {
    items: snap.docs
      .map((d) => ({ folio: d.id, ...d.data() }))
      .filter((o) => !(o.expiraAt?.toDate && o.expiraAt.toDate().getTime() <= ahora)),
    cursor: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
    hayMas: snap.docs.length === TAMANO_PAGINA,
  };
}

export async function leerOrden(tallerId, folio) {
  const snap = await getDoc(ordenRef(tallerId, folio));
  return snap.exists() ? { folio, ...snap.data() } : null;
}

// Cuerpo completo de la orden (se escribe con setDoc: lo que no va, desaparece). Los datos del
// cliente (nombre, teléfono, placas) solo llegan aquí si la pantalla los permitió
// (datosClienteDisponibles); las reglas exigen además la bandera y la versión de aviso vigente.
function cuerpoOrden({ tallerId, datos, original, avisoVersion }) {
  const plan = planBorrado(original, datos.estado, datos.garantiaDias);
  const cuerpo = {
    tallerId,
    estado: datos.estado,
    cliente: datos.cliente ?? {},
    vehiculo: datos.vehiculo,
    fallaReportada: datos.fallaReportada,
    observaciones: datos.observaciones,
    estadoRecepcion: datos.estadoRecepcion,
    pertenencias: datos.pertenencias,
    trabajos: datos.trabajos,
    piezas: datos.piezas,
    totalCentavos: totalOrdenCentavos(datos),
    creadoAt: original ? original.creadoAt : serverTimestamp(),
    actualizadoAt: serverTimestamp(),
    expiraAt: plan.expiraAt,
    avisoVersion: original ? original.avisoVersion : avisoVersion,
  };
  if (datos.estado === 'entregado') {
    cuerpo.garantiaDias = datos.garantiaDias;
    cuerpo.fechaEntrega = plan.fechaEntrega === 'servidor' ? serverTimestamp() : plan.fechaEntrega;
  }
  // Seguimiento público (solo órdenes con un aviso que lo incluye; las reglas exigen lo mismo):
  // primeraEntregaAt se pone UNA vez (hora del servidor) al entregar por primera vez y se conserva
  // siempre; el token y la nota se conservan en cada guardado (la nota solo cambia si llega en datos).
  if (ordenConSeguimiento(cuerpo.avisoVersion)) {
    if (original?.primeraEntregaAt) cuerpo.primeraEntregaAt = original.primeraEntregaAt;
    else if (datos.estado === 'entregado') cuerpo.primeraEntregaAt = serverTimestamp();
    if (original?.seguimientoToken) cuerpo.seguimientoToken = original.seguimientoToken;
    const nota = datos.notaSeguimiento !== undefined ? datos.notaSeguimiento : original?.notaSeguimiento;
    if (original && typeof nota === 'string' && nota !== '') cuerpo.notaSeguimiento = nota;
  }
  return cuerpo;
}

// ---------- Seguimiento público (seguimientos/{huella}) ----------

const refSeguimiento = async (token) => doc(db, 'seguimientos', await huellaSeguimiento(token));

// Documento del enlace que acompaña a este guardado de la orden (sin datos del cliente ni placas).
function cuerpoSeguimiento({ tallerId, folio, cuerpo, original, taller }) {
  const primera = cuerpo.primeraEntregaAt === undefined ? null : (original?.primeraEntregaAt ? cuerpo.primeraEntregaAt : 'ahora');
  const expiraAt = venceSeguimiento(cuerpo.expiraAt, primera);
  return { ...documentoSeguimiento({ tallerId, folio, orden: cuerpo, taller, expiraAt }), actualizadoAt: serverTimestamp() };
}

// ¿El enlace de este token sigue activo? (el dueño puede leerlo; si no existe, responde que no).
export async function leerSeguimiento(token) {
  if (!token) return null;
  const snap = await getDoc(await refSeguimiento(token));
  return snap.exists() ? snap.data() : null;
}

// Escribe la orden. Si tiene enlace ACTIVO, lo reescribe en el mismo lote (las reglas lo exigen);
// si el taller lo desactivó, la orden se guarda sola.
async function escribirOrden({ tallerId, folio, cuerpo, original, taller }) {
  const token = cuerpo.seguimientoToken;
  const ref = token ? await refSeguimiento(token) : null;
  if (!ref || !(await getDoc(ref)).exists()) {
    await setDoc(ordenRef(tallerId, folio), cuerpo);
    return;
  }
  const lote = writeBatch(db);
  lote.set(ordenRef(tallerId, folio), cuerpo);
  lote.set(ref, cuerpoSeguimiento({ tallerId, folio, cuerpo, original, taller }));
  await lote.commit();
}

// "Activar seguimiento" (también reactivar): token NUEVO; si había uno, su enlace se borra en el
// mismo lote. Lee la orden FRESCA. Las reglas exigen Premium vigente, bandera, términos y aviso.
// Devuelve el token. Lanza un Error con mensaje en español.
export async function activarSeguimiento({ tallerId, folio, taller }) {
  const original = await leerOrden(tallerId, folio);
  if (!original) throw new Error(MENSAJES_SEGUIMIENTO.fallo);
  if (!ordenConSeguimiento(original.avisoVersion)) throw new Error(MENSAJES_SEGUIMIENTO.anteriorAlAviso);
  const cuerpo = cuerpoOrden({ tallerId, datos: original, original, avisoVersion: original.avisoVersion });
  const token = generarTokenSeguimiento();
  cuerpo.seguimientoToken = token;
  const seg = cuerpoSeguimiento({ tallerId, folio, cuerpo, original, taller });
  if (!seg.expiraAt || seg.expiraAt.getTime() <= Date.now()) throw new Error(MENSAJES_SEGUIMIENTO.vencido);
  const lote = writeBatch(db);
  lote.set(ordenRef(tallerId, folio), cuerpo);
  if (original.seguimientoToken) lote.delete(await refSeguimiento(original.seguimientoToken));
  lote.set(await refSeguimiento(token), seg);
  try {
    await lote.commit();
  } catch (err) {
    console.error('[seguimiento] No se pudo activar', err);
    throw new Error(MENSAJES_SEGUIMIENTO.fallo);
  }
  return token;
}

// Nota pública del enlace (0-200, sin teléfonos ni «@»). Se guarda en la orden y en su enlace.
export async function guardarNotaSeguimiento({ tallerId, folio, nota, taller }) {
  const problema = validarNotaSeguimiento(nota);
  if (problema) throw new Error(problema);
  const original = await leerOrden(tallerId, folio);
  if (!original) throw new Error(MENSAJES_SEGUIMIENTO.fallo);
  const cuerpo = cuerpoOrden({ tallerId, datos: { ...original, notaSeguimiento: nota.trim() }, original, avisoVersion: original.avisoVersion });
  try {
    await escribirOrden({ tallerId, folio, cuerpo, original, taller });
  } catch (err) {
    console.error('[seguimiento] No se pudo guardar la nota', err);
    throw new Error(MENSAJES_SEGUIMIENTO.fallo);
  }
}

// "Desactivar enlace": borra SOLO el enlace (no escribe la orden). Funciona sin Premium, con
// términos viejos y con el taller desactivado.
export async function desactivarSeguimiento(token) {
  await deleteDoc(await refSeguimiento(token));
}

// Alta (folio null): folio nuevo "O..."; si choca, prueba otro (hasta 3 veces). Un folio que ya
// existe lo rechazan las reglas (sería editar sin la orden anterior), por eso se reintenta.
// Edición (folio dado): conserva creadoAt y avisoVersion; la fecha de borrado la decide planBorrado.
// taller: para copiar nombre y WhatsApp al enlace de seguimiento si la orden tiene uno activo.
export async function guardarOrden({ tallerId, folio = null, datos, original = null, avisoVersion = '', taller = null }) {
  if (folio) {
    await escribirOrden({ tallerId, folio, cuerpo: cuerpoOrden({ tallerId, datos, original, avisoVersion }), original, taller });
    return folio;
  }
  let ultimoError = null;
  for (let intento = 0; intento < 3; intento++) {
    const nuevo = generarFolioOrden(new Date());
    try {
      await setDoc(ordenRef(tallerId, nuevo), cuerpoOrden({ tallerId, datos, original: null, avisoVersion }));
      return nuevo;
    } catch (error) {
      ultimoError = error;
    }
  }
  throw ultimoError ?? new Error('No pudimos asignar un folio a la orden.');
}

// Quita nombre, teléfono y placas. Es la única escritura permitida con versión vieja. No mueve la
// fecha de borrado. (En esta etapa las órdenes no llevan datos del cliente; queda listo para después.)
export function quitarDatosClienteOrden(tallerId, folio) {
  return updateDoc(ordenRef(tallerId, folio), { cliente: {}, 'vehiculo.placas': deleteField(), actualizadoAt: serverTimestamp() });
}

// Borrar: el dueño (taller activo y términos vigentes) o el admin, según las reglas. Si la orden
// tiene enlace de seguimiento, se borra en el mismo lote (las reglas lo exigen).
export async function borrarOrden(tallerId, folio, orden = null) {
  if (!orden?.seguimientoToken) return deleteDoc(ordenRef(tallerId, folio));
  const lote = writeBatch(db);
  lote.delete(ordenRef(tallerId, folio));
  lote.delete(await refSeguimiento(orden.seguimientoToken));
  return lote.commit();
}

// Etapa 2: "Convertir en orden". Lee la cotización FRESCA y, en UN solo guardado (todo o nada),
// crea la orden nueva y borra la cotización con todos sus renglones. Máximo 22 operaciones
// (1 orden + 20 renglones + 1 cotización), probado en el emulador con las reglas actuales.
// Si el guardado falla (sin conexión, términos viejos, taller desactivado...), Firestore no aplica
// NADA: la cotización queda intacta. Si el folio choca, prueba otro (hasta 3 veces).
// Lanza un Error con un mensaje en español listo para mostrar.
// copiarCliente: copiar nombre, teléfono y placas (solo con la bandera de datos del cliente de
// órdenes encendida y el aviso de órdenes listo; ver datosClienteDisponibles).
export async function convertirCotizacionEnOrden({ tallerId, folioCotizacion, avisoVersion = '', copiarCliente = false }) {
  const cot = await leerCotizacion(tallerId, folioCotizacion);
  if (!cot) throw new Error(MENSAJES_CONVERSION.noExiste);
  const problema = validarConversion(cot, { copiarCliente });
  if (problema) throw new Error(problema);
  const datos = ordenDesdeCotizacion(cot, { copiarCliente });
  const renglones = cot.renglones.map((r) => doc(db, 'talleres', tallerId, 'cotizaciones', folioCotizacion, 'renglones', String(r.numero)));

  for (let intento = 0; intento < 3; intento++) {
    const folio = generarFolioOrden(new Date());
    const lote = writeBatch(db);
    lote.set(ordenRef(tallerId, folio), cuerpoOrden({ tallerId, datos, original: null, avisoVersion }));
    renglones.forEach((ref) => lote.delete(ref));
    lote.delete(doc(db, 'talleres', tallerId, 'cotizaciones', folioCotizacion));
    try {
      await lote.commit();
      return folio;
    } catch (error) {
      console.error(error);
    }
  }
  throw new Error(MENSAJES_CONVERSION.fallo);
}
