'use client';

// Acceso a Firestore para cotizaciones. Todo lo que cambia una cotización va en UN lote
// (cotización + renglones), así que nunca queda una cotización a medias.
// Lote máximo: 1 cotización + 20 renglones escritos + hasta 19 renglones borrados = 21 operaciones.
// Las reglas (firestore.rules) son la protección real: esta capa solo prepara datos correctos.
import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, startAfter, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { calcularExpiraAt, copiaSinDatosCliente, generarFolio, totalCentavos } from '../../../../lib/cotizaciones';

export const TAMANO_PAGINA = 20;

const cotizacionesRef = (tallerId) => collection(db, 'talleres', tallerId, 'cotizaciones');
const cotizacionRef = (tallerId, folio) => doc(db, 'talleres', tallerId, 'cotizaciones', folio);
const renglonesRef = (tallerId, folio) => collection(db, 'talleres', tallerId, 'cotizaciones', folio, 'renglones');

export async function leerTaller(tallerId) {
  const snap = await getDoc(doc(db, 'talleres', tallerId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Versión de términos vigente, bandera de datos del cliente y versión del aviso de talleres.
// Si el documento no existe, devuelve null: la app no permite crear ni editar nada.
export async function leerConfigCotizaciones() {
  const snap = await getDoc(doc(db, 'config', 'cotizaciones'));
  return snap.exists() ? snap.data() : null;
}

// Lista: solo cotizaciones vigentes (no vencidas), 1 lectura por cotización, sin leer renglones.
export async function listarCotizaciones(tallerId, { archivada, cursor = null }) {
  const restricciones = [
    where('archivada', '==', archivada),
    where('expiraAt', '>', new Date()),
    orderBy('expiraAt', 'desc'),
    limit(TAMANO_PAGINA),
  ];
  if (cursor) restricciones.push(startAfter(cursor));
  const snap = await getDocs(query(cotizacionesRef(tallerId), ...restricciones));
  return {
    items: snap.docs.map((d) => ({ folio: d.id, ...d.data() })),
    cursor: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
    hayMas: snap.docs.length === TAMANO_PAGINA,
  };
}

// Abrir una cotización: 1 lectura de la cotización + 1 por renglón (máximo 20).
export async function leerCotizacion(tallerId, folio) {
  const snap = await getDoc(cotizacionRef(tallerId, folio));
  if (!snap.exists()) return null;
  const rs = await getDocs(renglonesRef(tallerId, folio));
  const renglones = rs.docs
    .map((d) => ({ numero: Number(d.id), tipo: d.data().tipo, descripcion: d.data().descripcion, cantidad: d.data().cantidad, precioUnitario: d.data().precioUnitario, expiraAt: d.data().expiraAt }))
    .sort((a, b) => a.numero - b.numero);
  return { folio, ...snap.data(), renglones };
}

// Escribe cotización y renglones en un lote. Los renglones sobrantes (al editar) se borran en el mismo lote.
// Cada renglón lleva el MISMO expiraAt que la cotización (la regla lo exige).
async function escribirLote(tallerId, folio, cuerpo, renglones, renglonesAnteriores, expiraAt) {
  const lote = writeBatch(db);
  lote.set(cotizacionRef(tallerId, folio), cuerpo);
  renglones.forEach((r, i) => {
    lote.set(doc(renglonesRef(tallerId, folio), String(i)), {
      tipo: r.tipo, descripcion: r.descripcion, cantidad: r.cantidad, precioUnitario: r.precioUnitario, expiraAt,
    });
  });
  for (let i = renglones.length; i < renglonesAnteriores; i++) {
    lote.delete(doc(renglonesRef(tallerId, folio), String(i)));
  }
  await lote.commit();
}

// Alta (folio null): folio nuevo y expiración a 88 días; si el folio choca, prueba otro (hasta 3 veces).
// Edición (folio dado): conserva creadoAt, expiraAt y avisoVersion originales.
export async function guardarCotizacion({ tallerId, folio = null, datos, original = null, avisoVersion, renglonesAnteriores = 0 }) {
  const cuerpoBase = {
    tallerId,
    estado: datos.estado,
    archivada: datos.archivada,
    cliente: datos.cliente,
    vehiculo: datos.vehiculo,
    observaciones: datos.observaciones,
    vigenciaDias: datos.vigenciaDias,
    totalCentavos: totalCentavos(datos.renglones),
    numRenglones: datos.renglones.length,
  };
  if (folio) {
    const cuerpo = {
      ...cuerpoBase,
      creadoAt: original.creadoAt,
      expiraAt: original.expiraAt,
      avisoVersion: original.avisoVersion,
      actualizadoAt: serverTimestamp(),
    };
    await escribirLote(tallerId, folio, cuerpo, datos.renglones, renglonesAnteriores, original.expiraAt);
    return folio;
  }
  let ultimoError = null;
  for (let intento = 0; intento < 3; intento++) {
    const nuevo = generarFolio(new Date());
    const expiraAt = calcularExpiraAt(new Date());
    const cuerpo = {
      ...cuerpoBase,
      creadoAt: serverTimestamp(),
      expiraAt,
      avisoVersion,
      actualizadoAt: serverTimestamp(),
    };
    try {
      await escribirLote(tallerId, nuevo, cuerpo, datos.renglones, 0, expiraAt);
      return nuevo;
    } catch (error) {
      ultimoError = error;
    }
  }
  throw ultimoError;
}

// Archivar o desarchivar: solo cambia la marca, nunca borra. Requiere versión vigente (lo decide la regla).
export function cambiarArchivada(tallerId, folio, archivada) {
  return updateDoc(cotizacionRef(tallerId, folio), { archivada, actualizadoAt: serverTimestamp() });
}

// Quita nombre, teléfono y placas. Es la única escritura permitida con versión vieja o taller desactivado.
export async function quitarDatosCliente(tallerId, folio) {
  const snap = await getDoc(cotizacionRef(tallerId, folio));
  const { placas: _placas, ...vehiculo } = snap.data().vehiculo;
  return updateDoc(cotizacionRef(tallerId, folio), { cliente: {}, vehiculo, actualizadoAt: serverTimestamp() });
}

// Duplicar: nueva cotización en borrador, sin nombre, teléfono, placas ni kilometraje.
// Recibe la versión del aviso VIGENTE del taller (no la de la original).
export async function duplicarCotizacion(tallerId, folioOrigen, avisoVersion) {
  const original = await leerCotizacion(tallerId, folioOrigen);
  if (!original) throw new Error('La cotización original ya no existe.');
  const copia = copiaSinDatosCliente({
    cliente: original.cliente ?? {},
    vehiculo: original.vehiculo,
    renglones: original.renglones,
    observaciones: original.observaciones ?? '',
    vigenciaDias: original.vigenciaDias,
  });
  return guardarCotizacion({
    tallerId,
    folio: null,
    avisoVersion,
    datos: {
      estado: 'borrador',
      archivada: false,
      cliente: copia.cliente,
      vehiculo: copia.vehiculo,
      observaciones: copia.observaciones,
      vigenciaDias: copia.vigenciaDias,
      renglones: copia.renglones.map(({ tipo, descripcion, cantidad, precioUnitario }) => ({ tipo, descripcion, cantidad, precioUnitario })),
    },
  });
}

// Aceptar la versión vigente: entrada del historial + versión en el taller, en un lote.
export async function aceptarVersion(tallerId, version) {
  const lote = writeBatch(db);
  lote.set(doc(db, 'talleres', tallerId, 'aceptaciones', version), { version, fecha: serverTimestamp() });
  lote.update(doc(db, 'talleres', tallerId), { aceptacionVersion: version });
  await lote.commit();
}

// Solo admin. Borra primero los renglones y luego la cotización, en un lote.
export async function borrarCotizacionCompleta(tallerId, folio) {
  const rs = await getDocs(renglonesRef(tallerId, folio));
  const lote = writeBatch(db);
  rs.docs.forEach((d) => lote.delete(d.ref));
  lote.delete(cotizacionRef(tallerId, folio));
  await lote.commit();
}
