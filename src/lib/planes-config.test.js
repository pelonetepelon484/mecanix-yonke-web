import { afterEach, describe, expect, it, vi } from 'vitest';

let respuesta = null; // datos de config/planes, null = no existe, Error = falla la lectura
vi.mock('firebase/firestore', () => ({
  doc: (...ruta) => ruta.slice(1).join('/'),
  getDoc: async (ruta) => {
    if (respuesta instanceof Error) throw respuesta;
    return { exists: () => respuesta !== null, data: () => respuesta, ruta };
  },
}));

const { leerConfigPlanes } = await import('./planes');

afterEach(() => { respuesta = null; vi.restoreAllMocks(); });

describe('leerConfigPlanes (una sola lectura de config/planes para la página principal)', () => {
  it('sin documento: todo apagado', async () => {
    expect(await leerConfigPlanes('db')).toEqual({ limitesActivos: false, tarjetasTalleres: false });
  });
  it('sin el campo tarjetasTalleres o en false: tarjetas de talleres apagadas', async () => {
    respuesta = { limitesActivos: true };
    expect(await leerConfigPlanes('db')).toEqual({ limitesActivos: true, tarjetasTalleres: false });
    respuesta = { limitesActivos: true, tarjetasTalleres: false };
    expect(await leerConfigPlanes('db')).toEqual({ limitesActivos: true, tarjetasTalleres: false });
  });
  it('cada interruptor es independiente', async () => {
    respuesta = { tarjetasTalleres: true };
    expect(await leerConfigPlanes('db')).toEqual({ limitesActivos: false, tarjetasTalleres: true });
  });
  it('si la lectura falla, todo queda apagado (la página se ve como hoy)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    respuesta = new Error('permission-denied');
    expect(await leerConfigPlanes('db')).toEqual({ limitesActivos: false, tarjetasTalleres: false });
  });
});
