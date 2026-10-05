import { ref, listAll, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

// Borra TODOS los archivos bajo un prefijo de Storage, recursivamente -- usado para borrar en
// bloque las fotos de un vehículo completo (sus 4 fotos + las de todas sus piezas, que viven en
// la subcarpeta piezas/) o de un yonke completo (branding/{id}/** + yonkes/{id}/** -- esta última
// ya cubre vehiculos, motores y piezasSueltas de un jalón porque todas comparten ese prefijo).
//
// Usa listAll()+deleteObject() del SDK de CLIENTE a propósito, no Admin SDK: admin/page.js ya
// borra en cascada 100% client-side (un admin autenticado en el navegador), y evitamos
// reintroducir firebase-admin después de la saga de ERR_REQUIRE_ESM en Vercel con el panel
// Demanda. No lanza si el prefijo no existe o ya está vacío. Devuelve cuántos archivos borró.
export async function borrarCarpetaStorage(prefijo) {
  const carpetaRef = ref(storage, prefijo);
  let resultado;
  try {
    resultado = await listAll(carpetaRef);
  } catch (error) {
    if (error?.code === 'storage/object-not-found') return 0;
    throw error;
  }

  let borrados = 0;
  await Promise.all(resultado.items.map(async (itemRef) => {
    try {
      await deleteObject(itemRef);
      borrados += 1;
    } catch (error) {
      if (error?.code !== 'storage/object-not-found') throw error;
    }
  }));

  for (const subcarpetaRef of resultado.prefixes) {
    borrados += await borrarCarpetaStorage(subcarpetaRef.fullPath);
  }

  return borrados;
}
