'use client';

// Acceso a Firestore para órdenes de servicio (etapa 1). Trabajos y piezas van DENTRO de la orden
// (listas de máximo 20), así que abrir una orden cuesta 1 lectura y guardarla 1 escritura.
// Las reglas (firestore.rules) son la protección real: esta capa solo prepara datos correctos,
// incluida la fecha de borrado (expiraAt) que las reglas exigen con sus fórmulas.
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, startAfter, updateDoc, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { generarFolioOrden, planBorrado, totalOrdenCentavos } from '../../../../lib/ordenes';

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
export async function listarOrdenes(tallerId, { estado = 'todos', cursor = null } = {}) {
  const restricciones = [];
  if (estado !== 'todos') restricciones.push(where('estado', '==', estado));
  restricciones.push(orderBy('actualizadoAt', 'desc'), limit(TAMANO_PAGINA));
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

// Cuerpo completo de la orden (se escribe con setDoc: lo que no va, desaparece). En esta etapa
// nunca lleva datos del cliente: cliente vacío y sin placas.
function cuerpoOrden({ tallerId, datos, original, avisoVersion }) {
  const plan = planBorrado(original, datos.estado, datos.garantiaDias);
  const cuerpo = {
    tallerId,
    estado: datos.estado,
    cliente: {},
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
  return cuerpo;
}

// Alta (folio null): folio nuevo "O..."; si choca, prueba otro (hasta 3 veces). Un folio que ya
// existe lo rechazan las reglas (sería editar sin la orden anterior), por eso se reintenta.
// Edición (folio dado): conserva creadoAt y avisoVersion; la fecha de borrado la decide planBorrado.
export async function guardarOrden({ tallerId, folio = null, datos, original = null, avisoVersion = '' }) {
  if (folio) {
    await setDoc(ordenRef(tallerId, folio), cuerpoOrden({ tallerId, datos, original, avisoVersion }));
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

// Borrar: el dueño (taller activo y términos vigentes) o el admin, según las reglas.
export function borrarOrden(tallerId, folio) {
  return deleteDoc(ordenRef(tallerId, folio));
}
