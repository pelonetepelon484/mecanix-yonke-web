import { describe, expect, it, vi, afterEach } from 'vitest';
import { createVerify, generateKeyPairSync } from 'node:crypto';
import { crearClienteFcm, firmarJwt, leerCredenciales, normalizarLlave, tokenInvalido } from './fcm';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const credenciales = { projectId: 'mecanix-prueba', clientEmail: 'avisos@mecanix-prueba.iam.gserviceaccount.com', privateKey };
const jsonDe = (parte) => JSON.parse(Buffer.from(parte, 'base64url').toString());

afterEach(() => vi.restoreAllMocks());

describe('credenciales de FCM (solo variables de entorno del servidor)', () => {
  it('la llave funciona con saltos de línea reales, con \\n escapados y entre comillas', () => {
    const escapada = privateKey.replace(/\n/g, '\\n');
    for (const forma of [privateKey, escapada, `"${escapada}"`, `${privateKey}\r\n`.replace(/\n/g, '\r\n')]) {
      expect(normalizarLlave(forma).trim()).toBe(privateKey.trim());
    }
    const env = { FCM_PROJECT_ID: 'p', FCM_CLIENT_EMAIL: 'c@x', FCM_PRIVATE_KEY: escapada };
    expect(leerCredenciales(env)?.privateKey.trim()).toBe(privateKey.trim());
  });
  it('si falta alguna variable o la llave no parece llave: null (envío apagado en silencio)', () => {
    const completo = { FCM_PROJECT_ID: 'p', FCM_CLIENT_EMAIL: 'c@x', FCM_PRIVATE_KEY: privateKey };
    expect(leerCredenciales(completo)).not.toBeNull();
    for (const falta of ['FCM_PROJECT_ID', 'FCM_CLIENT_EMAIL', 'FCM_PRIVATE_KEY']) {
      expect(leerCredenciales({ ...completo, [falta]: '' })).toBeNull();
    }
    expect(leerCredenciales({ ...completo, FCM_PRIVATE_KEY: 'no-es-una-llave' })).toBeNull();
    expect(leerCredenciales({})).toBeNull();
  });
});

describe('firma del JWT (RS256, sin librerías)', () => {
  it('lleva emisor, alcance de FCM, audiencia de Google, 1 hora de vida y una firma válida', () => {
    const ahora = Date.UTC(2026, 9, 12, 18, 0, 0);
    const jwt = firmarJwt(credenciales, ahora);
    const [h, d, f] = jwt.split('.');
    expect(jsonDe(h)).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(jsonDe(d)).toEqual({
      iss: credenciales.clientEmail, scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token', iat: ahora / 1000, exp: ahora / 1000 + 3600,
    });
    expect(createVerify('RSA-SHA256').update(`${h}.${d}`).verify(publicKey, Buffer.from(f, 'base64url'))).toBe(true);
  });
});

describe('¿token inválido? (solo entonces se borra)', () => {
  it('404 / UNREGISTERED / 400 de token: sí; otros errores: no', () => {
    expect(tokenInvalido(404, null)).toBe(true);
    expect(tokenInvalido(400, { error: { details: [{ errorCode: 'UNREGISTERED' }] } })).toBe(true);
    expect(tokenInvalido(400, { error: { message: 'The registration token is not a valid FCM registration token' } })).toBe(true);
    expect(tokenInvalido(400, { error: { message: 'Invalid JSON payload' } })).toBe(false);
    for (const s of [401, 403, 429, 500, 503]) expect(tokenInvalido(s, { error: { details: [{ errorCode: 'QUOTA_EXCEEDED' }] } })).toBe(false);
  });
});

describe('cliente de FCM', () => {
  function google({ envio = () => ({ ok: true, status: 200, json: async () => ({ name: 'm/1' }) }) } = {}) {
    return vi.fn(async (url) => (url.startsWith('https://oauth2.googleapis.com/')
      ? { ok: true, status: 200, json: async () => ({ access_token: 'permiso-1', expires_in: 3600 }) }
      : envio()));
  }
  it('pide el permiso una vez, lo reutiliza y manda un mensaje de solo datos con prioridad alta', async () => {
    let ahora = 0;
    const fetchFn = google();
    const c = crearClienteFcm({ credenciales, fetchFn, ahora: () => ahora });
    expect(await c.enviar('tok-1', { titulo: 'T', cuerpo: 'C', url: '/panel/reservaciones', etiqueta: 'e' })).toBe('ok');
    ahora += 30 * 60 * 1000;
    expect(await c.enviar('tok-2', { titulo: 'T', cuerpo: 'C', url: '/panel/reservaciones', etiqueta: 'e' })).toBe('ok');
    const oauth = fetchFn.mock.calls.filter(([u]) => u.startsWith('https://oauth2'));
    expect(oauth).toHaveLength(1);
    const [url, opciones] = fetchFn.mock.calls.find(([u]) => u.startsWith('https://fcm'));
    expect(url).toBe('https://fcm.googleapis.com/v1/projects/mecanix-prueba/messages:send');
    expect(opciones.headers.Authorization).toBe('Bearer permiso-1');
    expect(JSON.parse(opciones.body)).toEqual({
      message: { token: 'tok-1', data: { titulo: 'T', cuerpo: 'C', url: '/panel/reservaciones', etiqueta: 'e' }, webpush: { headers: { Urgency: 'high', TTL: '86400' } } },
    });
    ahora += 31 * 60 * 1000; // ya casi vence: se pide otro
    await c.enviar('tok-3', {});
    expect(fetchFn.mock.calls.filter(([u]) => u.startsWith('https://oauth2'))).toHaveLength(2);
  });
  it('token rechazado: "invalido"; error temporal: "error" (sin borrar); nunca lanza', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const invalido = crearClienteFcm({ credenciales, fetchFn: google({ envio: () => ({ ok: false, status: 404, json: async () => ({ error: { details: [{ errorCode: 'UNREGISTERED' }] } }) }) }) });
    expect(await invalido.enviar('t', {})).toBe('invalido');
    const temporal = crearClienteFcm({ credenciales, fetchFn: google({ envio: () => ({ ok: false, status: 503, json: async () => ({}) }) }) });
    expect(await temporal.enviar('t', {})).toBe('error');
    const sinRed = crearClienteFcm({ credenciales, fetchFn: vi.fn(async () => { throw new Error('sin red'); }) });
    expect(await sinRed.enviar('t', {})).toBe('error');
  });
  it('la llave y el permiso nunca aparecen en los registros', async () => {
    const errores = vi.spyOn(console, 'error').mockImplementation(() => {});
    const c = crearClienteFcm({ credenciales, fetchFn: google({ envio: () => ({ ok: false, status: 500, json: async () => ({}) }) }) });
    await c.enviar('t', {});
    const registrado = JSON.stringify(errores.mock.calls);
    expect(registrado).not.toContain('PRIVATE KEY');
    expect(registrado).not.toContain('permiso-1');
    expect(registrado).not.toContain(privateKey.split('\n')[1]);
  });
});
