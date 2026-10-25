import { beforeEach, describe, expect, it, vi } from 'vitest';

const guardados = [];
vi.mock('../firebase-server', () => ({ dbServer: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db, nombre) => nombre,
  addDoc: vi.fn(async (coleccion, datos) => { guardados.push({ coleccion, datos }); }),
  Timestamp: { now: () => 'AHORA' },
}));

const { registrarBusqueda } = await import('./registrarBusqueda');
const de = (coleccion) => guardados.find((g) => g.coleccion === coleccion)?.datos;
const base = { texto: 'alternador civic 2016', marca: 'Honda', modelo: 'Civic', anio: 2016, estadoGeografico: 'son' };

beforeEach(() => { guardados.length = 0; });

describe('registrarBusqueda: alcanceResultado y estado elegido', () => {
  it('con resultado: alcance en busquedas y en el resumen; conResultado igual que siempre', async () => {
    await registrarBusqueda({ ...base, estado: 'ok', totalResultados: 3, estadoBusqueda: 'sonora' });
    expect(de('busquedas')).toMatchObject({ conResultado: true, alcanceResultado: 'con_resultado', estadoBusqueda: 'sonora' });
    expect(de('busquedasResumen')).toMatchObject({ conResultado: true, alcanceResultado: 'con_resultado' });
  });
  it('solo en otros estados (caso a y caso b)', async () => {
    await registrarBusqueda({ ...base, estado: 'sin_inventario', otrosEstados: { mostrados: 2, yonkeIds: ['A'] }, estadoBusqueda: 'jalisco' });
    expect(de('busquedas')).toMatchObject({ conResultado: false, alcanceResultado: 'solo_otros_estados' });
    expect(de('busquedasResumen').alcanceResultado).toBe('solo_otros_estados');
    guardados.length = 0;
    await registrarBusqueda({ ...base, estado: 'ok', totalResultados: 1, soloOtrosEstados: true, estadoBusqueda: 'todos' });
    expect(de('busquedas')).toMatchObject({ conResultado: true, alcanceResultado: 'solo_otros_estados', estadoBusqueda: 'todos' });
    expect(de('busquedasResumen').alcanceResultado).toBe('solo_otros_estados');
  });
  it('sin resultado', async () => {
    await registrarBusqueda({ ...base, estado: 'sin_inventario' });
    expect(de('busquedas').alcanceResultado).toBe('sin_resultado');
    expect(de('busquedasResumen').alcanceResultado).toBe('sin_resultado');
  });
  it('el estado elegido va SOLO en busquedas; el resumen lleva exactamente los campos que permiten las reglas', async () => {
    await registrarBusqueda({ ...base, estado: 'ok', estadoBusqueda: 'sonora' });
    expect(Object.keys(de('busquedasResumen')).sort()).toEqual(
      ['alcanceResultado', 'anio', 'conResultado', 'estado', 'estadoGeografico', 'fecha', 'marca', 'modelo', 'pieza', 'sinVehiculo'],
    );
    guardados.length = 0;
    await registrarBusqueda({ ...base, estado: 'ok' });
    expect(de('busquedas')).not.toHaveProperty('estadoBusqueda');
  });
});
