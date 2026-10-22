// Borrado completo de un taller, solo para admin, SIN pantalla (por ahora).
// Orden: renglones -> cotizaciones -> enlaces de seguimiento -> órdenes de servicio -> historial de vehículos ->
// historial de aceptaciones -> taller -> usuario de rol taller.
// La cuenta de Firebase Auth NO se borra aquí: se borra a mano en la consola.
// Las dependencias de Firebase se pasan desde fuera (fns) para poder probarlo en el emulador.
// Es idempotente: si falla a la mitad, volver a correrla termina lo que falta.

const LOTE_MAX = 400;

export async function borrarTallerCompleto({ db, fns }, tallerId) {
  const { collection, getDocs, writeBatch, query, where } = fns;
  if (!tallerId || typeof tallerId !== 'string') throw new Error('Falta el ID del taller.');

  const resumen = { cotizaciones: 0, renglones: 0, seguimientos: 0, ordenes: 0, historial: 0, aceptaciones: 0, usuarios: 0, taller: false };

  // 1) Renglones y 2) cotización, de una en una (cada lote tiene como máximo 21 operaciones)
  const cotizaciones = await getDocs(collection(db, 'talleres', tallerId, 'cotizaciones'));
  for (const cot of cotizaciones.docs) {
    const renglones = await getDocs(collection(db, 'talleres', tallerId, 'cotizaciones', cot.id, 'renglones'));
    const lote = writeBatch(db);
    renglones.docs.forEach((r) => lote.delete(r.ref));
    lote.delete(cot.ref);
    await lote.commit();
    resumen.cotizaciones += 1;
    resumen.renglones += renglones.size;
  }

  // 2a) Enlaces de seguimiento públicos del taller (seguimientos/{huella}, colección aparte), antes
  //     que sus órdenes, para que ningún enlace quede abriendo.
  const seguimientos = await getDocs(query(collection(db, 'seguimientos'), where('tallerId', '==', tallerId)));
  resumen.seguimientos = await borrarRefs(db, writeBatch, seguimientos.docs.map((d) => d.ref));

  // 2b) Órdenes de servicio (sin subcolecciones: trabajos y piezas van dentro de cada orden), en lotes
  const ordenes = await getDocs(collection(db, 'talleres', tallerId, 'ordenes'));
  resumen.ordenes = await borrarRefs(db, writeBatch, ordenes.docs.map((d) => d.ref));

  // 2c) Historial de vehículos (talleres/{id}/historial/{vehiculoId}): un documento por vehículo con
  //     sus servicios y recordatorios DENTRO (sin subcolecciones), en lotes. Antes que el taller, para
  //     que no quede ningún vehículo huérfano.
  const historial = await getDocs(collection(db, 'talleres', tallerId, 'historial'));
  resumen.historial = await borrarRefs(db, writeBatch, historial.docs.map((d) => d.ref));

  // 3) Historial de aceptaciones (en lotes)
  const aceptaciones = await getDocs(collection(db, 'talleres', tallerId, 'aceptaciones'));
  resumen.aceptaciones = await borrarRefs(db, writeBatch, aceptaciones.docs.map((d) => d.ref));

  // 4) Taller
  const lote4 = writeBatch(db);
  lote4.delete(fns.doc(db, 'talleres', tallerId));
  await lote4.commit();
  resumen.taller = true;

  // 5) Usuario de rol taller ligado a ese taller
  const usuarios = await getDocs(query(collection(db, 'usuarios'), where('tallerId', '==', tallerId)));
  resumen.usuarios = await borrarRefs(db, writeBatch, usuarios.docs.map((d) => d.ref));

  return resumen;
}

async function borrarRefs(db, writeBatch, refs) {
  for (let i = 0; i < refs.length; i += LOTE_MAX) {
    const lote = writeBatch(db);
    refs.slice(i, i + LOTE_MAX).forEach((ref) => lote.delete(ref));
    await lote.commit();
  }
  return refs.length;
}
