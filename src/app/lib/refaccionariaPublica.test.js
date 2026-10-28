import { describe, expect, it, vi } from 'vitest';

vi.mock('./firebase-server', () => ({ dbServer: {} }));
vi.mock('firebase/firestore', () => ({}));
const { conCache, refaccionariaParaPagina, CACHE_PAGINA_REFACCIONARIA_MS } = await import('./refaccionariaPublica.js');

describe('caché de la página pública de refaccionarias', () => {
  it('5 minutos: dentro del plazo no vuelve a leer; después sí; por clave', async () => {
    let ahora = 0;
    const leer = vi.fn(async (clave) => `valor-${clave}`);
    const leerCache = conCache(leer, CACHE_PAGINA_REFACCIONARIA_MS, () => ahora);
    expect(CACHE_PAGINA_REFACCIONARIA_MS).toBe(5 * 60 * 1000);
    expect(await leerCache('a')).toBe('valor-a');
    ahora = CACHE_PAGINA_REFACCIONARIA_MS - 1;
    await leerCache('a');
    expect(leer).toHaveBeenCalledTimes(1);
    await leerCache('b');
    expect(leer).toHaveBeenCalledTimes(2);
    ahora = CACHE_PAGINA_REFACCIONARIA_MS + 1;
    await leerCache('a');
    expect(leer).toHaveBeenCalledTimes(3);
  });
  it('si la lectura falla no guarda nada (la siguiente visita reintenta)', async () => {
    const leer = vi.fn().mockRejectedValueOnce(new Error('red')).mockResolvedValueOnce('ok');
    const leerCache = conCache(leer);
    await expect(leerCache('a')).rejects.toThrow('red');
    expect(await leerCache('a')).toBe('ok');
  });
});

describe('refaccionariaParaPagina', () => {
  it('solo los datos públicos, serializables (sin ownerUid ni aceptaciones)', () => {
    const ts = (ms) => ({ toMillis: () => ms });
    const r = refaccionariaParaPagina('R1', {
      nombre: 'El Pistón', ciudad: 'Tijuana', whatsapp: '6641234567', logoUrl: '', ownerUid: 'secreto', aceptacionVersion: 'r1',
      totalPiezas: 20, inventarioActualizadoAt: ts(5), activo: true, pruebaHasta: ts(10), verificado: true,
    });
    expect(r).toEqual({
      id: 'R1', nombre: 'El Pistón', ciudad: 'Tijuana', whatsapp: '6641234567', logoUrl: '', horario: null, zonaEntrega: null,
      totalPiezas: 20, inventarioActualizadoMs: 5, activo: true, pruebaHastaMs: 10, premiumHastaMs: null,
    });
  });
});
