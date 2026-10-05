import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';
import { comprimirImagen } from './comprimirImagen';

const TIPOS_PERMITIDOS = ['image/png', 'image/jpeg', 'image/webp'];
const PESO_ORIGINAL_MAX_BYTES = 10 * 1024 * 1024; // antes de comprimir; evita cargar fotos enormes en el navegador
const ANCHO_MAX_PX = 1200;
const PESO_COMPRIMIDO_MAX_BYTES = 250 * 1024;

// 4 fotos fijas por vehículo -- nunca más, nunca menos slots que estos.
export const SLOTS_FOTO_VEHICULO = ['frontal', 'trasera', 'derecha', 'izquierda'];

export function validarArchivoFotoVehiculo(file) {
  if (!file) return 'Elige una imagen.';
  if (!TIPOS_PERMITIDOS.includes(file.type)) return 'Formato no permitido. Usa una imagen PNG, JPEG o WEBP.';
  if (file.size > PESO_ORIGINAL_MAX_BYTES) return 'La imagen pesa más de 10 MB. Elige una más ligera.';
  return null;
}

// Sube la foto de un slot (frontal/trasera/derecha/izquierda) a
// yonkes/{yonkeId}/vehiculos/{vehiculoId}/{slot}-{timestamp}.{ext} -- nombre único por subida
// (nunca fijo): reemplazar una foto sube el archivo nuevo y el llamador borra el anterior DESPUÉS
// de guardar la URL nueva en Firestore (con borrarFotoVehiculo), nunca antes -- mismo orden que
// promosStorage.js, para no quedarse sin foto visible si falla el guardado a medio camino.
// Devuelve { url, path }: el path se guarda aparte (no se reconstruye a mano) para poder borrar
// exactamente ese archivo más adelante sin tener que parsear la URL de descarga.
// Comprime a ancho máx. 1200px / WebP (JPEG si el navegador no soporta WebP, ver
// comprimirImagen.js) / tope 250 KB.
export async function subirFotoVehiculo(yonkeId, vehiculoId, slot, file) {
  if (!SLOTS_FOTO_VEHICULO.includes(slot)) {
    throw new Error(`Slot de foto inválido: "${slot}". Debe ser uno de ${SLOTS_FOTO_VEHICULO.join(', ')}.`);
  }
  const errorValidacion = validarArchivoFotoVehiculo(file);
  if (errorValidacion) throw new Error(errorValidacion);

  const blob = await comprimirImagen(file, {
    maxAncho: ANCHO_MAX_PX, tipo: 'image/webp', calidad: 0.85, maxBytes: PESO_COMPRIMIDO_MAX_BYTES,
  });
  const extension = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/jpeg' ? 'jpg' : 'png';
  const path = `yonkes/${yonkeId}/vehiculos/${vehiculoId}/${slot}-${Date.now()}.${extension}`;

  let url;
  try {
    const archivoRef = ref(storage, path);
    await uploadBytes(archivoRef, blob, {
      contentType: blob.type,
      cacheControl: 'public, max-age=31536000',
    });
    url = await getDownloadURL(archivoRef);
  } catch (error) {
    // Mensaje claro y distinto de los de validación, para que la UI pueda ofrecer "Reintentar"
    // sin confundirlo con un archivo inválido -- el guardado del registro en Firestore no debe
    // depender de que esto funcione.
    throw new Error(`No se pudo subir la foto. Revisa tu conexión e intenta de nuevo. (${error?.code || error?.message || 'error desconocido'})`);
  }

  return { url, path };
}

// Borra una foto de vehículo por su ruta exacta (la que devolvió subirFotoVehiculo). No lanza si
// ya no existe (ej. doble clic, o ya se había borrado).
export async function borrarFotoVehiculo(path) {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch (e) {
    if (e?.code !== 'storage/object-not-found') throw e;
  }
}
