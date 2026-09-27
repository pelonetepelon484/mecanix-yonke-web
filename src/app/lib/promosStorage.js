import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';
import { comprimirImagen } from './comprimirImagen';
import { PROMO_ANCHO_MAX_PX, PROMO_PESO_MAX_BYTES } from '../../lib/promos';

const TIPOS_PERMITIDOS = ['image/png', 'image/jpeg', 'image/webp'];
const PESO_ORIGINAL_MAX_BYTES = 10 * 1024 * 1024; // antes de comprimir; evita cargar fotos enormes en el navegador

// Mensaje en español si el archivo no sirve; null si está bien.
export function validarArchivoPromo(file) {
  if (!file) return 'Elige una imagen.';
  if (!TIPOS_PERMITIDOS.includes(file.type)) return 'Formato no permitido. Usa una imagen PNG, JPEG o WEBP.';
  if (file.size > PESO_ORIGINAL_MAX_BYTES) return 'La imagen pesa más de 10 MB. Elige una más ligera.';
  return null;
}

// Comprime (ancho máx. 1200, WebP, < 300 KB — la misma función que el logo, configurada) y sube a
// branding/{yonkeId}/promos/. Nombre único por subida (no de ID fijo como el logo): reemplazar una
// promoción sube el archivo nuevo y después borra el anterior con borrarPromoPorUrl. Devuelve la
// URL de descarga (https), lista para guardar en promoImagenes[].url.
export async function subirPromoYonke(yonkeId, file) {
  const error = validarArchivoPromo(file);
  if (error) throw new Error(error);
  const blob = await comprimirImagen(file, {
    maxAncho: PROMO_ANCHO_MAX_PX, tipo: 'image/webp', calidad: 0.85, maxBytes: PROMO_PESO_MAX_BYTES,
  });
  // Safari antiguo no codifica WebP y devuelve otro formato: la extensión y el contentType siguen a blob.type.
  const extension = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/jpeg' ? 'jpg' : 'png';
  const nombre = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const archivoRef = ref(storage, `branding/${yonkeId}/promos/${nombre}`);
  await uploadBytes(archivoRef, blob, { contentType: blob.type });
  return getDownloadURL(archivoRef);
}

// Borra un archivo de promoción a partir de su URL de descarga. No lanza si ya no existe.
export async function borrarPromoPorUrl(url) {
  try {
    await deleteObject(ref(storage, url));
  } catch (e) {
    if (e?.code !== 'storage/object-not-found') throw e;
  }
}
