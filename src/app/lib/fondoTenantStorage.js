import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';
import { comprimirImagen } from './comprimirImagen';
import { FONDO_ANCHO_MAX_PX, FONDO_ALTO_MAX_PX, FONDO_PESO_ORIGINAL_MAX_BYTES, FONDO_PESO_COMPRIMIDO_MAX_BYTES } from '../../lib/fondoTenant';

const TIPOS_PERMITIDOS = ['image/png', 'image/jpeg', 'image/webp'];

export function validarArchivoFondo(file) {
  if (!file) return 'Elige una imagen.';
  if (!TIPOS_PERMITIDOS.includes(file.type)) return 'Formato no permitido. Usa una imagen JPG, PNG o WEBP.';
  if (file.size > FONDO_PESO_ORIGINAL_MAX_BYTES) return 'La imagen pesa más de 2 MB. Elige una más ligera.';
  return null;
}

// Fondo de la franja superior del sitio con subdominio, en branding/{yonkeId}/fondo/ (mismo
// patrón que promosStorage.js/sobreNosotrosStorage.js: nombre único por subida, comprimida con la
// función compartida — ancho máx. 1920, alto máx. 640, WebP, < 500 KB). Reemplazar sube el
// archivo nuevo y borra el anterior con borrarFondoPorUrl; nunca se reconstruye una ruta a mano.
export async function subirFondoTenant(yonkeId, file) {
  const error = validarArchivoFondo(file);
  if (error) throw new Error(error);
  const blob = await comprimirImagen(file, {
    maxAncho: FONDO_ANCHO_MAX_PX, maxAlto: FONDO_ALTO_MAX_PX, tipo: 'image/webp', calidad: 0.85,
    maxBytes: FONDO_PESO_COMPRIMIDO_MAX_BYTES,
  });
  // Safari antiguo no codifica WebP y devuelve otro formato: la extensión sigue a blob.type.
  const extension = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/jpeg' ? 'jpg' : 'png';
  const archivoRef = ref(storage, `branding/${yonkeId}/fondo/${Date.now()}.${extension}`);
  await uploadBytes(archivoRef, blob, { contentType: blob.type });
  return getDownloadURL(archivoRef);
}

// Borra el fondo anterior a partir de su URL de descarga. No lanza si ya no existe.
export async function borrarFondoPorUrl(url) {
  if (!url) return;
  try {
    await deleteObject(ref(storage, url));
  } catch (e) {
    if (e?.code !== 'storage/object-not-found') throw e;
  }
}
