import { doc, getDoc } from 'firebase/firestore';

// Correo de contacto de un yonke: vive en yonkes/{id}/privado/contacto (solo dueño y admin),
// NO en el documento público yonkes/{id}, que se lee sin login para el buscador y los
// subdominios. El correo de acceso del dueño está además en usuarios/{uid}.
export function refContactoPrivado(db, yonkeId) {
  return doc(db, 'yonkes', yonkeId, 'privado', 'contacto');
}

// Lee el correo del subdocumento privado; cae al campo `email` del documento público solo para
// yonkes que todavía no fueron migrados (el botón de respaldo de /admin lo mueve y lo borra).
export async function leerEmailContacto(db, yonkeId, datosYonkeLegacy) {
  try {
    const snap = await getDoc(refContactoPrivado(db, yonkeId));
    if (snap.exists() && typeof snap.data().email === 'string') return snap.data().email;
  } catch (error) {
    console.error('[contactoPrivado] No se pudo leer yonkes/{id}/privado/contacto', error?.code);
  }
  return datosYonkeLegacy?.email || '';
}
