// Solo servidor. Envío de avisos con Firebase Cloud Messaging (API HTTP v1) SIN firebase-admin:
// la cuenta de servicio firma un JWT con la criptografía de Node (RS256) y lo cambia por un
// permiso de acceso de Google (dura 1 hora, se reutiliza mientras no venza).
//
// Credenciales SOLO de variables de entorno del servidor: FCM_PROJECT_ID, FCM_CLIENT_EMAIL y
// FCM_PRIVATE_KEY. Si falta alguna (o la llave no se ve como llave), el envío queda apagado en
// silencio. Nunca se escriben en los logs ni se mandan al navegador (este archivo no se importa
// desde ningún componente de cliente).
import { createSign } from 'node:crypto';

const URL_TOKEN = 'https://oauth2.googleapis.com/token';
const ALCANCE = 'https://www.googleapis.com/auth/firebase.messaging';

// Vercel guarda la llave a veces con saltos de línea reales y a veces con "\n" escapados (y a
// veces entre comillas, si se pegó tal cual del JSON): las tres formas terminan iguales.
export function normalizarLlave(valor) {
  let llave = String(valor ?? '').trim();
  if (llave.length >= 2 && llave.startsWith('"') && llave.endsWith('"')) llave = llave.slice(1, -1);
  return llave.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
}

export function leerCredenciales(env = process.env) {
  const projectId = String(env.FCM_PROJECT_ID ?? '').trim();
  const clientEmail = String(env.FCM_CLIENT_EMAIL ?? '').trim();
  const privateKey = normalizarLlave(env.FCM_PRIVATE_KEY);
  if (!projectId || !clientEmail || !privateKey.includes('-----BEGIN PRIVATE KEY-----')) return null;
  return { projectId, clientEmail, privateKey };
}

const base64url = (texto) => Buffer.from(texto).toString('base64url');

// JWT de la cuenta de servicio para pedir el permiso de acceso (vale 1 hora).
export function firmarJwt({ clientEmail, privateKey }, ahoraMs) {
  const iat = Math.floor(ahoraMs / 1000);
  const encabezado = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const datos = base64url(JSON.stringify({ iss: clientEmail, scope: ALCANCE, aud: URL_TOKEN, iat, exp: iat + 3600 }));
  const firma = createSign('RSA-SHA256').update(`${encabezado}.${datos}`).sign(privateKey).toString('base64url');
  return `${encabezado}.${datos}.${firma}`;
}

// ¿Firebase dice que este token ya no sirve (desinstalado, borrado o caducado)? Solo entonces se
// borra. Otros errores (red, cuota, permisos, un error nuestro) NO borran nada.
export function tokenInvalido(status, cuerpo) {
  const error = cuerpo?.error ?? {};
  const codigos = (error.details ?? []).map((d) => d?.errorCode).filter(Boolean);
  if (status === 404 || codigos.includes('UNREGISTERED')) return true;
  return status === 400 && /registration token/i.test(String(error.message ?? ''));
}

export function crearClienteFcm({ credenciales, fetchFn = fetch, ahora = () => Date.now() }) {
  let permiso = null; // { token, vence }

  async function permisoDeAcceso() {
    if (permiso && permiso.vence > ahora() + 60 * 1000) return permiso.token;
    const res = await fetchFn(URL_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: firmarJwt(credenciales, ahora()) }).toString(),
    });
    if (!res.ok) throw new Error(`No se obtuvo el permiso de Google (HTTP ${res.status})`);
    const cuerpo = await res.json();
    permiso = { token: cuerpo.access_token, vence: ahora() + (Number(cuerpo.expires_in) || 3600) * 1000 };
    return permiso.token;
  }

  // Un mensaje de solo datos: el service worker del panel (public/panel/avisos-sw.js) lo muestra.
  // Devuelve 'ok', 'invalido' (borrar el token) o 'error' (no borrar).
  async function enviar(tokenDispositivo, datos) {
    try {
      const acceso = await permisoDeAcceso();
      const res = await fetchFn(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(credenciales.projectId)}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${acceso}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { token: tokenDispositivo, data: datos, webpush: { headers: { Urgency: 'high', TTL: '86400' } } } }),
      });
      if (res.ok) return 'ok';
      if (res.status === 401) permiso = null; // se pide uno nuevo la próxima vez
      let cuerpo = null;
      try { cuerpo = await res.json(); } catch { /* sin cuerpo */ }
      if (tokenInvalido(res.status, cuerpo)) return 'invalido';
      console.error('[avisosPush] FCM rechazó un aviso', { status: res.status });
      return 'error';
    } catch (error) {
      console.error('[avisosPush] No se pudo enviar un aviso', { message: error?.message });
      return 'error';
    }
  }

  return { enviar };
}
