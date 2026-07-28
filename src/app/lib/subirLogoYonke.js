import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

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

// Redimensiona a máx 400x400px manteniendo proporción, vía canvas (sin librerías externas).
// Si la imagen ya es más chica, no la agranda. Devuelve un Blob PNG listo para subir.
function redimensionarImagen(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > LADO_MAXIMO_PX || height > LADO_MAXIMO_PX) {
        const escala = Math.min(LADO_MAXIMO_PX / width, LADO_MAXIMO_PX / height);
        width = Math.round(width * escala);
        height = Math.round(height * escala);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob); else reject(new Error('No se pudo procesar la imagen'));
      }, 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
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
