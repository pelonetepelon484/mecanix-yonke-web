import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { VERSION_LEGAL } from '../../lib/versionesLegales';

// Reaceptación de los Términos generales por los yonkes. La fuente de verdad es
// config/terminosYonkes { version, resumenCambios } en Firestore, la misma que leen las reglas:
// - Si NO existe, no se exige nada (nadie ve el aviso ni queda bloqueado).
// - Si existe, el yonke cuya aceptacionLegal.version no es su `version` ve el aviso ACEPTO y
//   solo puede ver su información y atender pedidos y reservaciones.
// La app usa SIEMPRE la versión de ese documento cuando existe, y VERSION_LEGAL solo si no existe:
// así el código nunca intenta guardar una versión que las reglas rechazarían.
export const TEXTO_BLOQUEO_TERMINOS_YONKE =
  'Acepta los términos vigentes para hacer cambios. Mientras tanto puedes ver tu información y atender pedidos y reservaciones.';

export async function leerTerminosYonkes(db) {
  const snap = await getDoc(doc(db, 'config', 'terminosYonkes'));
  if (!snap.exists()) return { existe: false, version: null, resumenCambios: '' };
  const datos = snap.data();
  return { existe: true, version: datos.version ?? null, resumenCambios: datos.resumenCambios || '' };
}

export const versionParaAceptar = (terminos) => (terminos?.existe ? terminos.version : VERSION_LEGAL);

// Sin documento: aceptado. Con documento: la versión aceptada debe ser la vigente (sin
// aceptacionLegal = no aceptado).
export const terminosAceptados = (datosYonke, terminos) =>
  !terminos?.existe || datosYonke?.aceptacionLegal?.version === terminos.version;

// Aviso ACEPTO: historial + aceptacionLegal en un solo guardado, con la hora del servidor.
export async function aceptarTerminosYonke(db, yonkeId, version) {
  const lote = writeBatch(db);
  lote.set(doc(db, 'yonkes', yonkeId, 'aceptaciones', version), { version, fecha: serverTimestamp() });
  lote.update(doc(db, 'yonkes', yonkeId), { aceptacionLegal: { version, fecha: serverTimestamp() } });
  await lote.commit();
}

// Registro: ficha nueva (con aceptacionLegal) + su entrada del historial en un solo guardado.
export async function crearYonkeConAceptacion(db, yonkeRef, datosYonke, version) {
  const lote = writeBatch(db);
  lote.set(yonkeRef, { ...datosYonke, aceptacionLegal: { version, fecha: serverTimestamp() } });
  lote.set(doc(db, 'yonkes', yonkeRef.id, 'aceptaciones', version), { version, fecha: serverTimestamp() });
  await lote.commit();
}
