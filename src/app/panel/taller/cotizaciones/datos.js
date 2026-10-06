'use client';

// Acceso a Firestore para cotizaciones. Todo lo que cambia una cotización va en UN lote
// (cotización + renglones), así que nunca queda una cotización a medias.
// Lote máximo: 1 cotización + 20 renglones escritos + hasta 19 renglones borrados = 21 operaciones.
import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, startAfter, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { generarFolio, totalCentavos } from '../../../../lib/cotizaciones';

export const TAMANO_PAGINA = 20;

const cotizacionesRef = (tallerId) => collection(db, 'talleres', tallerId, 'cotizaciones');
const cotizacionRef = (tallerId, folio) => doc(db, 'talleres', tallerId, 'cotizaciones', folio);
const renglonesRef = (tallerId, folio) => collection(db, 'talleres', tallerId, 'cotizaciones', folio, 'renglones');

export async function leerTaller(tallerId) {
  const snap = await getDoc(doc(db, 'talleres', tallerId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Lista: 1 lectura por cotización. Usa solo el total guardado; no lee renglones.
export async function listarCotizaciones(tallerId, { archivada, cursor = null }) {
  const restricciones = [where('archivada', '==', archivada), orderBy('actualizadoAt', 'desc'), limit(TAMANO_PAGINA)];
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
    .map((d) => ({ numero: Number(d.id), tipo: d.data().tipo, descripcion: d.data().descripcion, cantidad: d.data().cantidad, precioUnitario: d.data().precioUnitario }))
    .sort((a, b) => a.numero - b.numero);
  return { folio, ...snap.data(), renglones };
}

// Escribe cotización + renglones en un lote. Los renglones sobrantes (al editar) se borran en el mismo lote.
async function escribirLote(tallerId, folio, cuerpo, renglones, renglonesAnteriores) {
  const lote = writeBatch(db);
  lote.set(cotizacionRef(tallerId, folio), cuerpo);
  renglones.forEach((r, i) => {
    lote.set(doc(renglonesRef(tallerId, folio), String(i)), {
      tipo: r.tipo, descripcion: r.descripcion, cantidad: r.cantidad, precioUnitario: r.precioUnitario,
    });
  });
  for (let i = renglones.length; i < renglonesAnteriores; i++) {
    lote.delete(doc(renglonesRef(tallerId, folio), String(i)));
  }
  await lote.commit();
}

// Alta (folio null): genera un folio y, si choca con otro, prueba otro (hasta 3 veces).
// Edición (folio dado): conserva creadoAt original y reemplaza renglones.
export async function guardarCotizacion({ tallerId, folio = null, datos, creadoAt = null, renglonesAnteriores = 0 }) {
  const cuerpo = {
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
    await escribirLote(tallerId, folio, { ...cuerpo, creadoAt, actualizadoAt: serverTimestamp() }, datos.renglones, renglonesAnteriores);
    return folio;
  }
  let ultimoError = null;
  for (let intento = 0; intento < 3; intento++) {
    const nuevo = generarFolio(new Date());
    try {
      await escribirLote(tallerId, nuevo, { ...cuerpo, creadoAt: serverTimestamp(), actualizadoAt: serverTimestamp() }, datos.renglones, 0);
      return nuevo;
    } catch (error) {
      ultimoError = error;
    }
  }
  throw ultimoError;
}

// Archivar o desarchivar: solo cambia la marca, nunca borra.
export function cambiarArchivada(tallerId, folio, archivada) {
  return updateDoc(cotizacionRef(tallerId, folio), { archivada, actualizadoAt: serverTimestamp() });
}

// Quita nombre, teléfono y placas. Es una actualización normal; el documento se queda.
export async function quitarDatosCliente(tallerId, folio) {
  const snap = await getDoc(cotizacionRef(tallerId, folio));
  const { placas: _placas, ...vehiculo } = snap.data().vehiculo;
  return updateDoc(cotizacionRef(tallerId, folio), { cliente: {}, vehiculo, actualizadoAt: serverTimestamp() });
}

// Duplicar: nueva cotización en borrador, archivada = false, con folio nuevo.
export async function duplicarCotizacion(tallerId, folioOrigen) {
  const original = await leerCotizacion(tallerId, folioOrigen);
  if (!original) throw new Error('La cotización original ya no existe.');
  return guardarCotizacion({
    tallerId,
    folio: null,
    datos: {
      estado: 'borrador',
      archivada: false,
      cliente: original.cliente ?? {},
      vehiculo: original.vehiculo,
      observaciones: original.observaciones ?? '',
      vigenciaDias: original.vigenciaDias,
      renglones: original.renglones,
    },
  });
}

// Solo admin. Borra primero los renglones y luego la cotización, en un solo lote.
// Las reglas no pueden impedir cotizaciones huérfanas; por eso el borrado va siempre por aquí.
export async function borrarCotizacionCompleta(tallerId, folio) {
  const rs = await getDocs(renglonesRef(tallerId, folio));
  const lote = writeBatch(db);
  rs.docs.forEach((d) => lote.delete(d.ref));
  lote.delete(cotizacionRef(tallerId, folio));
  await lote.commit();
}
