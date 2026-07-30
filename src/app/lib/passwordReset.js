import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from './firebase';

// Mismo comportamiento y textos que src/utils/passwordReset.js en la app (mecanix-yonke-virtual2)
// — mantener ambos en sync si cambia la lógica de errores.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function enviarRecuperacionPassword(email) {
  const correo = (email || '').trim();

  if (!correo) {
    return { ok: false, tipo: 'vacio' };
  }
  if (!EMAIL_REGEX.test(correo)) {
    return { ok: false, tipo: 'invalido' };
  }

  try {
    await sendPasswordResetEmail(auth, correo);
    return { ok: true };
  } catch (error) {
    if (error.code === 'auth/network-request-failed') {
      return { ok: false, tipo: 'sin-conexion' };
    }
    if (error.code === 'auth/invalid-email') {
      return { ok: false, tipo: 'invalido' };
    }
    if (error.code === 'auth/user-not-found') {
      // Por seguridad no se revela si el correo existe o no: se trata igual que éxito.
      return { ok: true };
    }
    return { ok: false, tipo: 'otro' };
  }
}
