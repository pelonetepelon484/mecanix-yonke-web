import { describe, expect, it, vi } from 'vitest';
import { TIEMPO_POR_INTENTO_MS, pedirPremiumGratis } from './pedirPremiumGratis';

const respuesta = (status, cuerpo) => ({ ok: status >= 200 && status < 300, status, json: async () => cuerpo });
const obtenerToken = async () => 'pase';

describe('pedirPremiumGratis (navegador)', () => {
  it('primer intento bien: no reintenta', async () => {
    const fetchFn = vi.fn(async () => respuesta(200, { ok: true, otorgada: true, premiumHasta: '2027-01-29T00:00:00.000Z' }));
    expect(await pedirPremiumGratis({ obtenerToken, fetchFn })).toEqual({ otorgada: true, motivo: undefined, premiumHasta: '2027-01-29T00:00:00.000Z' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0][0]).toBe('/api/talleres/premium-gratis');
    expect(fetchFn.mock.calls[0][1].headers.Authorization).toBe('Bearer pase');
    expect(fetchFn.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('respuesta definitiva sin promoción (apagada, ya usada): no reintenta', async () => {
    const fetchFn = vi.fn(async () => respuesta(200, { ok: true, otorgada: false, motivo: 'yaUsada' }));
    expect(await pedirPremiumGratis({ obtenerToken, fetchFn })).toMatchObject({ otorgada: false, motivo: 'yaUsada' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('falla la red o se pasa del tiempo: reintenta UNA vez', async () => {
    const tiempo = Object.assign(new Error('timeout'), { name: 'TimeoutError' });
    const fetchFn = vi.fn()
      .mockRejectedValueOnce(tiempo)
      .mockResolvedValueOnce(respuesta(200, { ok: true, otorgada: true, premiumHasta: 'x' }));
    expect((await pedirPremiumGratis({ obtenerToken, fetchFn })).otorgada).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('error del servidor dos veces: sigue como Básico, sin lanzar y sin un tercer intento', async () => {
    const fetchFn = vi.fn(async () => respuesta(503, { ok: false, otorgada: false, motivo: 'noDisponible' }));
    expect(await pedirPremiumGratis({ obtenerToken, fetchFn })).toEqual({ otorgada: false, motivo: 'noDisponible' });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('dos fallas de red: motivo "red"; respuesta que no es JSON cuenta como falla', async () => {
    const a = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    expect(await pedirPremiumGratis({ obtenerToken, fetchFn: a })).toEqual({ otorgada: false, motivo: 'red' });
    expect(a).toHaveBeenCalledTimes(2);
    const b = vi.fn(async () => ({ ok: true, status: 200, json: async () => { throw new Error('html'); } }));
    expect((await pedirPremiumGratis({ obtenerToken, fetchFn: b })).otorgada).toBe(false);
    expect(b).toHaveBeenCalledTimes(2);
  });

  it('una respuesta que no llega se corta por tiempo y se reintenta (corte real, con 50 ms)', async () => {
    const fetchFn = vi.fn((_ruta, { signal }) => new Promise((_, rechazar) => {
      signal.addEventListener('abort', () => rechazar(signal.reason));
    }));
    expect(await pedirPremiumGratis({ obtenerToken, fetchFn, tiempoMs: 50 })).toEqual({ otorgada: false, motivo: 'tiempo' });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('cada intento espera 10 segundos por defecto', () => {
    expect(TIEMPO_POR_INTENTO_MS).toBe(10_000);
  });

  it('sin sesión: no llama al servidor', async () => {
    const fetchFn = vi.fn();
    expect(await pedirPremiumGratis({ obtenerToken: async () => null, fetchFn })).toEqual({ otorgada: false, motivo: 'sinSesion' });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
