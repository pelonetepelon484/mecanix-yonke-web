import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';
import { comprimirImagen } from './comprimirImagen';

const TIPOS_PERMITIDOS = ['image/png', 'image/jpeg', 'image/webp'];
const TAMANO_MAXIMO_BYTES = 2 * 1024 * 1024;
const LADO_MAXIMO_PX = 400;

export function validarArchivoLogo(file) {
  if (!TIPOS_PERMITIDOS.includes(file.type)) {
    return 'Formato no permitido. Usa una imagen PNG, JPEG o WEBP.';
  }
  if (file.size > TAMANO_MAXIMO_BYTES) {
    return 'La imagen pesa más de 2MB. Elige una más ligera.';
  }
  return null;
}

// Redimensiona a máx 400x400px manteniendo proporción y devuelve un Blob PNG listo para subir. Si
// la imagen ya es más chica, no la agranda. Usa la compresión compartida (comprimirImagen.js), la
// misma que las promociones, con los parámetros originales del logo.
function redimensionarImagen(file) {
  return comprimirImagen(file, { maxAncho: LADO_MAXIMO_PX, maxAlto: LADO_MAXIMO_PX, tipo: 'image/png' });
}

// Sube el logo a Storage en logos/{yonkeId}.png — ruta de ID fijo: cada subida sobrescribe
// la anterior, nunca acumula archivos huérfanos. El canvas siempre re-codifica a PNG, así
// que la ruta es consistente sin importar si el original era JPEG/WEBP. Devuelve el
// downloadURL, listo para guardar en el campo `logoUrl` del documento del yonke.
export async function subirLogoYonke(yonkeId, file) {
  const errorValidacion = validarArchivoLogo(file);
  if (errorValidacion) throw new Error(errorValidacion);
  const blob = await redimensionarImagen(file);
  const logoRef = ref(storage, `logos/${yonkeId}.png`);
  await uploadBytes(logoRef, blob, { contentType: 'image/png' });
  return getDownloadURL(logoRef);
}

// Quita el logo actual. No lanza si ya no existe (ej. doble clic).
export async function borrarLogoYonke(yonkeId) {
  try {
    await deleteObject(ref(storage, `logos/${yonkeId}.png`));
  } catch (e) {
    if (e?.code !== 'storage/object-not-found') throw e;
  }
}
