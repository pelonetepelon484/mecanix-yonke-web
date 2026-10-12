import { firebaseConfig } from '../firebaseConfig';

// Solo servidor. Lee Firestore "como el usuario" que llama, con su pase de sesión (ID token de
// Firebase Auth), usando la API REST de Firestore: así las MISMAS reglas de firestore.rules
// deciden qué puede ver, sin credenciales de administrador y sin cambiar reglas.
// - uidDeToken: Google confirma que el pase es válido y vigente y dice de quién es (null si no).
// - leerComoUsuario: el documento si las reglas lo dejan leer a ese usuario; null si no existe o
//   no tiene permiso (para quien llama, las dos cosas son "no es tuyo").

const TIEMPO_MAXIMO_MS = 8000;

export async function uidDeToken(idToken, fetchFn = fetch) {
  if (typeof idToken !== 'string' || idToken.length < 20 || idToken.length > 4096) return null;
  try {
    const r = await fetchFn(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    });
    if (!r.ok) return null;
    const datos = await r.json();
    const uid = datos?.users?.[0]?.localId;
    return typeof uid === 'string' && uid ? uid : null;
  } catch (error) {
    console.error('[avisosAdmin] No se pudo verificar el pase de sesión', { message: error?.message });
    return null;
  }
}

// Valor de la API REST ({ stringValue: 'x' }, { mapValue: { fields } }, ...) a valor normal.
export function desdeRest(valor) {
  if (!valor || typeof valor !== 'object') return null;
  if ('stringValue' in valor) return valor.stringValue;
  if ('booleanValue' in valor) return valor.booleanValue;
  if ('integerValue' in valor) return Number(valor.integerValue);
  if ('doubleValue' in valor) return valor.doubleValue;
  if ('timestampValue' in valor) return new Date(valor.timestampValue);
  if ('nullValue' in valor) return null;
  if ('mapValue' in valor) return camposDesdeRest(valor.mapValue?.fields);
  if ('arrayValue' in valor) return (valor.arrayValue?.values ?? []).map(desdeRest);
  return null;
}
export function camposDesdeRest(campos) {
  return Object.fromEntries(Object.entries(campos ?? {}).map(([k, v]) => [k, desdeRest(v)]));
}

// ruta: 'coleccion/id' (o más segmentos). Cada segmento se valida para no armar rutas raras.
export async function leerComoUsuario(idToken, ruta, fetchFn = fetch) {
  const segmentos = String(ruta).split('/');
  if (segmentos.length % 2 !== 0 || !segmentos.every((s) => /^[A-Za-z0-9_-]{1,128}$/.test(s))) return null;
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebaseConfig.projectId)}/databases/(default)/documents/${segmentos.join('/')}`;
    const r = await fetchFn(url, { headers: { Authorization: `Bearer ${idToken}` }, signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS) });
    if (!r.ok) return null;
    const doc = await r.json();
    return camposDesdeRest(doc?.fields);
  } catch (error) {
    console.error('[avisosAdmin] No se pudo leer como el usuario', { message: error?.message });
    return null;
  }
}
