import { describe, expect, it, vi } from 'vitest';
import { camposDesdeRest, leerComoUsuario, uidDeToken } from './identidadUsuario';

const PASE = 'pase-de-sesion-de-prueba-largo';
const respuesta = (status, cuerpo) => ({ ok: status >= 200 && status < 300, status, json: async () => cuerpo });

describe('uidDeToken: Google confirma de quién es el pase', () => {
  it('pase válido: devuelve el uid', async () => {
    const fetchFn = vi.fn(async () => respuesta(200, { users: [{ localId: 'uid123' }] }));
    expect(await uidDeToken(PASE, fetchFn)).toBe('uid123');
    const [url, opciones] = fetchFn.mock.calls[0];
    expect(url).toMatch(/^https:\/\/identitytoolkit\.googleapis\.com\/v1\/accounts:lookup\?key=/);
    expect(JSON.parse(opciones.body)).toEqual({ idToken: PASE });
  });
  it('pase rechazado, vacío, enorme o sin red: null', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await uidDeToken(PASE, async () => respuesta(400, { error: { message: 'INVALID_ID_TOKEN' } }))).toBeNull();
    expect(await uidDeToken(PASE, async () => respuesta(200, { users: [] }))).toBeNull();
    expect(await uidDeToken('', vi.fn())).toBeNull();
    expect(await uidDeToken('x'.repeat(5000), vi.fn())).toBeNull();
    expect(await uidDeToken(PASE, async () => { throw new Error('sin red'); })).toBeNull();
    vi.restoreAllMocks();
  });
});

describe('leerComoUsuario: Firestore con el pase del usuario (las reglas deciden)', () => {
  it('manda el pase y convierte los campos', async () => {
    const fetchFn = vi.fn(async () => respuesta(200, {
      fields: {
        tallerId: { stringValue: 'T1' }, activo: { booleanValue: true }, vehiculo: { mapValue: { fields: { anio: { integerValue: '2010' }, marca: { stringValue: 'Nissan' } } } },
        yonkeElegido: { nullValue: null }, lista: { arrayValue: { values: [{ stringValue: 'a' }] } }, creadoAt: { timestampValue: '2026-10-11T18:00:00Z' },
      },
    }));
    const d = await leerComoUsuario(PASE, 'solicitudesPiezas/S1', fetchFn);
    expect(d).toEqual({ tallerId: 'T1', activo: true, vehiculo: { anio: 2010, marca: 'Nissan' }, yonkeElegido: null, lista: ['a'], creadoAt: new Date('2026-10-11T18:00:00Z') });
    const [url, opciones] = fetchFn.mock.calls[0];
    expect(url).toMatch(/\/databases\/\(default\)\/documents\/solicitudesPiezas\/S1$/);
    expect(opciones.headers.Authorization).toBe(`Bearer ${PASE}`);
  });
  it('sin permiso (403), no existe (404) o sin red: null', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await leerComoUsuario(PASE, 'talleres/T2', async () => respuesta(403, {}))).toBeNull();
    expect(await leerComoUsuario(PASE, 'talleres/NO', async () => respuesta(404, {}))).toBeNull();
    expect(await leerComoUsuario(PASE, 'talleres/T1', async () => { throw new Error('sin red'); })).toBeNull();
    vi.restoreAllMocks();
  });
  it('rutas raras no se piden', async () => {
    const fetchFn = vi.fn();
    for (const ruta of ['talleres', 'talleres/../usuarios/x', 'talleres/T1/ordenes', 'a b/c']) {
      expect(await leerComoUsuario(PASE, ruta, fetchFn)).toBeNull();
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });
  it('documento sin campos: objeto vacío', () => {
    expect(camposDesdeRest(undefined)).toEqual({});
  });
});
