import { describe, expect, it, vi } from 'vitest';

vi.mock('./firebase-server', () => ({ dbServer: {} }));
vi.mock('firebase/firestore', () => ({}));
const {
  conCache, refaccionariaParaPagina, refaccionariaParaBuscador, visibleAhora, CACHE_PAGINA_REFACCIONARIA_MS, CACHE_BUSCADOR_MS,
} = await import('./refaccionariaPublica.js');

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

describe('buscador: datos de cada refaccionaria y vigencia', () => {
  it('la lista y los índices del buscador se guardan 15 minutos', () => {
    expect(CACHE_BUSCADOR_MS).toBe(15 * 60 * 1000);
  });
  it('agrega slug, estado y Verificado; nada privado', () => {
    const r = refaccionariaParaBuscador('R1', { nombre: 'El Pistón', slug: 'el-piston', estado: 'sonora', verificado: true, ownerUid: 'secreto', activo: true });
    expect(r).toMatchObject({ id: 'R1', slug: 'el-piston', estado: 'sonora', verificado: true, activo: true });
    expect(r).not.toHaveProperty('ownerUid');
  });
  it('visible solo activa y con prueba o pago vigente, revisado en el momento', () => {
    const ahora = new Date('2026-10-28T12:00:00');
    const manana = new Date('2026-10-29T00:00:00').getTime();
    const ayer = new Date('2026-10-27T00:00:00').getTime();
    expect(visibleAhora({ activo: true, pruebaHastaMs: manana }, ahora)).toBe(true);
    expect(visibleAhora({ activo: true, pruebaHastaMs: ayer }, ahora)).toBe(false);
    expect(visibleAhora({ activo: true, pruebaHastaMs: ayer, premiumHastaMs: manana }, ahora)).toBe(true);
    expect(visibleAhora({ activo: false, pruebaHastaMs: manana }, ahora)).toBe(false);
    expect(visibleAhora({ activo: true }, ahora)).toBe(false);
  });
});
