import { randomInt } from 'node:crypto';
import { firebaseConfig } from '../firebaseConfig';
import { firmarJwt, normalizarLlave } from '../avisosPush/fcm';

// Solo servidor. Cambia la contraseña de una cuenta de Firebase Auth SIN firebase-admin: una cuenta
// de servicio exclusiva firma un JWT (igual que los avisos push) y lo cambia por un permiso de
// acceso de Google. Credenciales SOLO de variables de entorno del servidor: AUTH_ADMIN_CLIENT_EMAIL
// y AUTH_ADMIN_PRIVATE_KEY. Si falta alguna, la función queda apagada. Nunca se escriben en los
// registros ni se mandan al navegador.
const URL_TOKEN = 'https://oauth2.googleapis.com/token';
const ALCANCE = 'https://www.googleapis.com/auth/identitytoolkit';
const TIEMPO_MAXIMO_MS = 8000;

export function leerCredencialesAuth(env = process.env) {
  const clientEmail = String(env.AUTH_ADMIN_CLIENT_EMAIL ?? '').trim();
  const privateKey = normalizarLlave(env.AUTH_ADMIN_PRIVATE_KEY);
  if (!clientEmail || !privateKey.includes('-----BEGIN PRIVATE KEY-----')) return null;
  return { clientEmail, privateKey };
}

// Sin letras ni números que se confundan al copiarlos a mano (0/O, 1/l/I).
const ALFABETO = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const LARGO_TEMPORAL = 12;
export function generarContrasenaTemporal(elegir = randomInt) {
  return Array.from({ length: LARGO_TEMPORAL }, () => ALFABETO[elegir(ALFABETO.length)]).join('');
}

async function permisoDeAcceso(credenciales, fetchFn, ahora) {
  const permiso = await fetchFn(URL_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: firmarJwt(credenciales, ahora(), ALCANCE) }).toString(),
    signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
  });
  if (!permiso.ok) throw new Error(`No se obtuvo el permiso de Google (HTTP ${permiso.status})`);
  return (await permiso.json()).access_token;
}

// Lanza si Google no confirma el cambio: quien llama nunca muestra una contraseña que no sirve.
export async function cambiarPassword(credenciales, uid, password, { fetchFn = fetch, ahora = () => Date.now(), proyecto = firebaseConfig.projectId } = {}) {
  const acceso = await permisoDeAcceso(credenciales, fetchFn, ahora);
  const res = await fetchFn(`https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(proyecto)}/accounts:update`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${acceso}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ localId: uid, password }),
    signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
  });
  if (!res.ok) throw new Error(`Google rechazó el cambio de contraseña (HTTP ${res.status})`);
}

// Borra la cuenta. Si ya no existe, no es error. Lanza si Google no lo confirma.
export async function borrarCuenta(credenciales, uid, { fetchFn = fetch, ahora = () => Date.now(), proyecto = firebaseConfig.projectId } = {}) {
  const acceso = await permisoDeAcceso(credenciales, fetchFn, ahora);
  const res = await fetchFn(`https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(proyecto)}/accounts:delete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${acceso}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ localId: uid }),
    signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
  });
  if (res.ok) return;
  const cuerpo = await res.json().catch(() => null);
  if (cuerpo?.error?.message === 'USER_NOT_FOUND') return;
  throw new Error(`Google rechazó borrar la cuenta (HTTP ${res.status})`);
}
