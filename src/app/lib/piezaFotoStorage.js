import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';
import { comprimirImagen } from './comprimirImagen';

const TIPOS_PERMITIDOS = ['image/png', 'image/jpeg', 'image/webp'];
const PESO_ORIGINAL_MAX_BYTES = 10 * 1024 * 1024; // antes de comprimir; evita cargar fotos enormes en el navegador
const ANCHO_MAX_PX = 800;
const PESO_COMPRIMIDO_MAX_BYTES = 100 * 1024;

export function validarArchivoFotoPieza(file) {
  if (!file) return 'Elige una imagen.';
  if (!TIPOS_PERMITIDOS.includes(file.type)) return 'Formato no permitido. Usa una imagen PNG, JPEG o WEBP.';
  if (file.size > PESO_ORIGINAL_MAX_BYTES) return 'La imagen pesa más de 10 MB. Elige una más ligera.';
  return null;
}

// 1 foto para pieza de vehículo, motor suelto o transmisión suelta, o pieza suelta -- mismo shape
// para las tres, el llamador arma `carpeta` según el tipo:
//   pieza de vehículo:  yonkes/{yonkeId}/vehiculos/{vehiculoId}/piezas
//   motor/transmisión:  yonkes/{yonkeId}/motores
//   pieza suelta:       yonkes/{yonkeId}/piezasSueltas
// Sube a {carpeta}/{id}-{timestamp}.{ext} -- nombre único por subida (nunca fijo): reemplazar una
// foto sube el archivo nuevo y el llamador borra el anterior DESPUÉS de guardar la URL nueva en
// Firestore (con borrarFotoPieza), nunca antes -- mismo orden que promosStorage.js.
// Devuelve { url, path }: el path se guarda aparte para poder borrar exactamente ese archivo
// después sin tener que parsear la URL de descarga.
// Comprime a ancho máx. 800px / WebP (JPEG si el navegador no soporta WebP, ver
// comprimirImagen.js) / tope 100 KB.
export async function subirFotoPieza(carpeta, id, file) {
  if (!carpeta || !id) throw new Error('Falta la carpeta o el id para subir la foto.');
  const errorValidacion = validarArchivoFotoPieza(file);
  if (errorValidacion) throw new Error(errorValidacion);

  const blob = await comprimirImagen(file, {
    maxAncho: ANCHO_MAX_PX, tipo: 'image/webp', calidad: 0.85, maxBytes: PESO_COMPRIMIDO_MAX_BYTES,
  });
  const extension = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/jpeg' ? 'jpg' : 'png';
  const path = `${carpeta}/${id}-${Date.now()}.${extension}`;

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

// Borra una foto por su ruta exacta (la que devolvió subirFotoPieza). No lanza si ya no existe.
export async function borrarFotoPieza(path) {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch (e) {
    if (e?.code !== 'storage/object-not-found') throw e;
  }
}
