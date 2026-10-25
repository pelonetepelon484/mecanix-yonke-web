import { describe, expect, it, vi } from 'vitest';

let respuesta = null; // null = sin documento; 'error' = falla la lectura; objeto = datos
vi.mock('../firebase-server', () => ({ dbServer: {} }));
vi.mock('firebase/firestore', () => ({
  doc: () => 'config/buscador',
  getDoc: async () => {
    if (respuesta === 'error') throw new Error('sin red');
    return { exists: () => respuesta !== null, data: () => respuesta };
  },
}));

// Cada caso con el módulo nuevo (la caché de 1 minuto vive en el módulo).
async function leer(config) {
  respuesta = config;
  vi.resetModules();
  const m = await import('./configBuscadorServer');
  return { respaldo: await m.respaldoVehiculoServer(), ip: await m.otrosEstadosPorIpServer(), scroll: await m.scrollOtrosEstadosServer() };
}

describe('config/buscador.respaldoVehiculo (encendida por omisión)', () => {
  it('encendida sin documento, sin el campo, o si la lectura falla', async () => {
    expect((await leer(null)).respaldo).toBe(true);
    expect((await leer({ rangoAniosCorto: true })).respaldo).toBe(true);
    expect((await leer('error')).respaldo).toBe(true);
    expect((await leer({ respaldoVehiculo: true })).respaldo).toBe(true);
  });
  it('apagada solo con false exacto', async () => {
    expect((await leer({ respaldoVehiculo: false })).respaldo).toBe(false);
    expect((await leer({ respaldoVehiculo: 'false' })).respaldo).toBe(true);
  });
  it('las otras banderas siguen apagadas por omisión', async () => {
    expect((await leer(null)).ip).toBe(false);
  });
});

describe('config/buscador.scrollOtrosEstados (apagada por omisión)', () => {
  it('solo con true exacto; sin documento, sin el campo, otro valor o si falla la lectura: apagada', async () => {
    expect((await leer({ scrollOtrosEstados: true })).scroll).toBe(true);
    for (const config of [null, {}, { scrollOtrosEstados: false }, { scrollOtrosEstados: 'true' }, 'error']) {
      expect((await leer(config)).scroll).toBe(false);
    }
  });
});
