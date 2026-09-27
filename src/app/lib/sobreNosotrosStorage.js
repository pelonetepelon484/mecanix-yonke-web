import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';
import { comprimirImagen } from './comprimirImagen';

const TIPOS_PERMITIDOS = ['image/png', 'image/jpeg', 'image/webp'];
const PESO_ORIGINAL_MAX_BYTES = 10 * 1024 * 1024;
const ANCHO_MAX_PX = 1200;
const PESO_MAX_BYTES = 400 * 1024;

export function validarArchivoFotoSobreNosotros(file) {
  if (!file) return 'Elige una imagen.';
  if (!TIPOS_PERMITIDOS.includes(file.type)) return 'Formato no permitido. Usa una imagen PNG, JPEG o WEBP.';
  if (file.size > PESO_ORIGINAL_MAX_BYTES) return 'La imagen pesa más de 10 MB. Elige una más ligera.';
  return null;
}

// Foto de "Sobre nosotros" en branding/{yonkeId}/sobre-nosotros/, comprimida con la misma función
// que el logo y las promociones (ancho máx. 1200, WebP, < 400 KB). El nombre de archivo NO es fijo
// (a diferencia del logo): la mayoría de navegadores codifican WebP, pero si alguno no puede,
// comprimirImagen devuelve otro formato y aquí se usa la extensión real (blob.type) — igual que
// promosStorage.js. Por eso reemplazar sube el archivo nuevo y borra el anterior por su URL
// guardada (borrarFotoSobreNosotrosPorUrl), no por una ruta reconstruida a mano.
export async function subirFotoSobreNosotros(yonkeId, file) {
  const error = validarArchivoFotoSobreNosotros(file);
  if (error) throw new Error(error);
  const blob = await comprimirImagen(file, { maxAncho: ANCHO_MAX_PX, tipo: 'image/webp', calidad: 0.85, maxBytes: PESO_MAX_BYTES });
  const extension = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/jpeg' ? 'jpg' : 'png';
  const archivoRef = ref(storage, `branding/${yonkeId}/sobre-nosotros/${Date.now()}.${extension}`);
  await uploadBytes(archivoRef, blob, { contentType: blob.type });
  return getDownloadURL(archivoRef);
}

// Borra la foto anterior a partir de su URL de descarga guardada. No lanza si ya no existe.
export async function borrarFotoSobreNosotrosPorUrl(url) {
  if (!url) return;
  try {
    await deleteObject(ref(storage, url));
  } catch (e) {
    if (e?.code !== 'storage/object-not-found') throw e;
  }
}
