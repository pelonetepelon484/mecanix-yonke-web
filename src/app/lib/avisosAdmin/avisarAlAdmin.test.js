import { describe, expect, it, vi } from 'vitest';
import { avisarAlAdmin } from './avisarAlAdmin';

const respuesta = (status, cuerpo) => ({ ok: status >= 200 && status < 300, status, json: async () => cuerpo });

describe('avisarAlAdmin (navegador): nunca hace fallar la acción del usuario', () => {
  it('manda el pase en el encabezado y el cuerpo; true si el servidor avisó', async () => {
    const fetchFn = vi.fn(async () => respuesta(200, { ok: true, avisado: true }));
    expect(await avisarAlAdmin('/api/x', { cuerpo: { solicitudId: 'S1' }, obtenerToken: async () => 'pase', fetchFn })).toBe(true);
    const [ruta, opciones] = fetchFn.mock.calls[0];
    expect(ruta).toBe('/api/x');
    expect(opciones.headers.Authorization).toBe('Bearer pase');
    expect(JSON.parse(opciones.body)).toEqual({ solicitudId: 'S1' });
  });
  it('sin pase de sesión: no llama al servidor y no lanza', async () => {
    const fetchFn = vi.fn();
    expect(await avisarAlAdmin('/api/x', { obtenerToken: async () => undefined, fetchFn })).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });
  it('límite alcanzado, repetido, error del servidor, sin red o fallo al pedir el pase: false, sin lanzar', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await avisarAlAdmin('/api/x', { fetchFn: async () => respuesta(429, { ok: false, avisado: false, motivo: 'limite' }) })).toBe(false);
    expect(await avisarAlAdmin('/api/x', { fetchFn: async () => respuesta(200, { ok: true, avisado: false, motivo: 'repetido' }) })).toBe(false);
    expect(await avisarAlAdmin('/api/x', { fetchFn: async () => respuesta(500, null) })).toBe(false);
    expect(await avisarAlAdmin('/api/x', { fetchFn: async () => { throw new TypeError('Failed to fetch'); } })).toBe(false);
    expect(await avisarAlAdmin('/api/x', { obtenerToken: async () => { throw new Error('auth/network'); }, fetchFn: vi.fn() })).toBe(false);
    expect(await avisarAlAdmin('/api/x', { fetchFn: async () => ({ ok: true, json: async () => { throw new Error('no json'); } }) })).toBe(false);
    vi.restoreAllMocks();
  });
});
