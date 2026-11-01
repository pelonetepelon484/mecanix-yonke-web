import { generateKeyPairSync, createVerify } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { LARGO_TEMPORAL, borrarCuenta, cambiarPassword, generarContrasenaTemporal, leerCredencialesAuth } from './authAdmin';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const credenciales = { clientEmail: 'restablecer@proyecto.iam.gserviceaccount.com', privateKey };
const respuesta = (ok, status, cuerpo = {}) => ({ ok, status, json: async () => cuerpo });

describe('credenciales', () => {
  it('sin correo o sin llave válida: apagado', () => {
    expect(leerCredencialesAuth({})).toBeNull();
    expect(leerCredencialesAuth({ AUTH_ADMIN_CLIENT_EMAIL: 'a@b' })).toBeNull();
    expect(leerCredencialesAuth({ AUTH_ADMIN_CLIENT_EMAIL: 'a@b', AUTH_ADMIN_PRIVATE_KEY: 'no es llave' })).toBeNull();
  });
  it('acepta la llave con "\\n" escapados y entre comillas, como la guarda Vercel', () => {
    const escapada = `"${privateKey.replace(/\n/g, '\\n')}"`;
    expect(leerCredencialesAuth({ AUTH_ADMIN_CLIENT_EMAIL: ' a@b ', AUTH_ADMIN_PRIVATE_KEY: escapada })?.clientEmail).toBe('a@b');
  });
});

describe('contraseña temporal', () => {
  it('12 caracteres, sin los que se confunden, y distinta cada vez', () => {
    const vistas = new Set();
    for (let i = 0; i < 200; i++) {
      const t = generarContrasenaTemporal();
      expect(t).toHaveLength(LARGO_TEMPORAL);
      expect(t).not.toMatch(/[0O1lI]/);
      vistas.add(t);
    }
    expect(vistas.size).toBe(200);
  });
});

describe('cambiarPassword', () => {
  it('firma con el alcance de Auth, pide permiso y actualiza esa cuenta', async () => {
    const fetchFn = vi.fn(async (url) => (String(url).includes('oauth2') ? respuesta(true, 200, { access_token: 'permiso' }) : respuesta(true, 200)));
    await cambiarPassword(credenciales, 'uidL', 'nueva-clave', { fetchFn, ahora: () => 1000000, proyecto: 'mi-proyecto' });

    const assertion = new URLSearchParams(fetchFn.mock.calls[0][1].body).get('assertion');
    const [encabezado, datos, firma] = assertion.split('.');
    const verificador = createVerify('RSA-SHA256').update(`${encabezado}.${datos}`);
    expect(verificador.verify(publicKey, firma, 'base64url')).toBe(true);
    expect(JSON.parse(Buffer.from(datos, 'base64url').toString())).toMatchObject({
      iss: credenciales.clientEmail, scope: 'https://www.googleapis.com/auth/identitytoolkit',
    });

    const [url, opciones] = fetchFn.mock.calls[1];
    expect(url).toBe('https://identitytoolkit.googleapis.com/v1/projects/mi-proyecto/accounts:update');
    expect(opciones.headers.Authorization).toBe('Bearer permiso');
    expect(JSON.parse(opciones.body)).toEqual({ localId: 'uidL', password: 'nueva-clave' });
  });
  it('lanza si Google no da permiso o rechaza el cambio, sin decir la contraseña', async () => {
    const sinPermiso = vi.fn(async () => respuesta(false, 403));
    await expect(cambiarPassword(credenciales, 'u', 'clave-x', { fetchFn: sinPermiso, proyecto: 'p' })).rejects.toThrow('403');
    const rechazo = vi.fn(async (url) => (String(url).includes('oauth2') ? respuesta(true, 200, { access_token: 'p' }) : respuesta(false, 400)));
    const error = await cambiarPassword(credenciales, 'u', 'clave-x', { fetchFn: rechazo, proyecto: 'p' }).catch((e) => e);
    expect(error.message).toContain('400');
    expect(error.message).not.toContain('clave-x');
  });
});

describe('borrarCuenta', () => {
  const conGoogle = (final) => vi.fn(async (url) => (String(url).includes('oauth2') ? respuesta(true, 200, { access_token: 'permiso' }) : final));
  it('borra esa cuenta', async () => {
    const fetchFn = conGoogle(respuesta(true, 200));
    await borrarCuenta(credenciales, 'uidL', { fetchFn, proyecto: 'mi-proyecto' });
    const [url, opciones] = fetchFn.mock.calls[1];
    expect(url).toBe('https://identitytoolkit.googleapis.com/v1/projects/mi-proyecto/accounts:delete');
    expect(JSON.parse(opciones.body)).toEqual({ localId: 'uidL' });
  });
  it('si ya no existe no es error; otro rechazo sí', async () => {
    await expect(borrarCuenta(credenciales, 'u', { fetchFn: conGoogle(respuesta(false, 400, { error: { message: 'USER_NOT_FOUND' } })), proyecto: 'p' })).resolves.toBeUndefined();
    await expect(borrarCuenta(credenciales, 'u', { fetchFn: conGoogle(respuesta(false, 403, {})), proyecto: 'p' })).rejects.toThrow('403');
  });
});
