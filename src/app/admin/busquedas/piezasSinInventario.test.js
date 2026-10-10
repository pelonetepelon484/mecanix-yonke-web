import { describe, expect, it } from 'vitest';
import { SIN_UBICACION, TODOS_LOS_ESTADOS, filasSinInventario, opcionesEstado, piezaVehiculo, textoEstados } from './piezasSinInventario';

const fecha = (iso) => ({ toDate: () => new Date(iso) });
const b = (estadoGeografico, extra = {}) => ({ pieza: 'Alternador', marca: 'Nissan', modelo: 'Sentra', estadoGeografico, fecha: fecha('2026-10-01T20:00:00Z'), ...extra });

describe('piezas sin inventario: estados, filtro y "Cualquier pieza"', () => {
  it('"Cualquier pieza" cuando solo se buscó el vehículo; sin marca se queda "?"', () => {
    expect(piezaVehiculo({ pieza: null, marca: 'Nissan', modelo: 'Sentra' })).toBe('Cualquier pieza — Nissan Sentra');
    expect(piezaVehiculo({ pieza: 'Faro', marca: null, modelo: null })).toBe('Faro — ?');
    expect(piezaVehiculo({ pieza: 'Faro', marca: 'Ford', modelo: 'Focus' })).toBe('Faro — Ford Focus');
  });

  it('columna Estados: más buscado primero, máximo 3 y "+N más"', () => {
    expect(textoEstados(new Map([['son', 2], ['bcn', 4]]))).toBe('Baja California (4), Sonora (2)');
    expect(textoEstados(new Map([['son', 2], ['bcn', 4], ['jal', 1], ['cmx', 1], [SIN_UBICACION, 3]])))
      .toBe('Baja California (4), Sin ubicación (3), Sonora (2) +2 más');
  });

  it('sin estadoGeografico o "desconocido" cuenta como "Sin ubicación"', () => {
    const filas = filasSinInventario([b('bcn'), b(null), b('desconocido'), b(undefined)]);
    expect(filas).toHaveLength(1);
    expect(filas[0].conteo).toBe(4);
    expect(filas[0].textoEstados).toBe('Sin ubicación (3), Baja California (1)');
  });

  it('filtro por estado: recalcula veces buscado, última vez y el orden solo con ese estado', () => {
    const docs = [
      b('bcn', { fecha: fecha('2026-10-05T20:00:00Z') }),
      b('bcn', { fecha: fecha('2026-10-01T20:00:00Z') }),
      b('son', { fecha: fecha('2026-10-08T20:00:00Z') }),
      b('son', { pieza: 'Faro', fecha: fecha('2026-10-02T20:00:00Z') }),
      b('son', { pieza: 'Faro', fecha: fecha('2026-10-03T20:00:00Z') }),
    ];
    const todos = filasSinInventario(docs, TODOS_LOS_ESTADOS);
    expect(todos.map((f) => [f.clave, f.conteo])).toEqual([['Alternador — Nissan Sentra', 3], ['Faro — Nissan Sentra', 2]]);
    expect(todos[0].ultima.toISOString()).toBe('2026-10-08T20:00:00.000Z');
    expect(todos[0].textoEstados).toBe('Baja California (2), Sonora (1)');

    const sonora = filasSinInventario(docs, 'son');
    expect(sonora.map((f) => [f.clave, f.conteo])).toEqual([['Faro — Nissan Sentra', 2], ['Alternador — Nissan Sentra', 1]]);
    expect(sonora[1].ultima.toISOString()).toBe('2026-10-08T20:00:00.000Z');
    expect(sonora[1].textoEstados).toBe('Sonora (1)');

    const bc = filasSinInventario(docs, 'bcn');
    expect(bc).toHaveLength(1);
    expect(bc[0].ultima.toISOString()).toBe('2026-10-05T20:00:00.000Z');
    expect(filasSinInventario(docs, SIN_UBICACION)).toEqual([]);
  });

  it('muestra solo las 10 más buscadas', () => {
    const docs = Array.from({ length: 12 }, (_, i) => b('bcn', { pieza: `Pieza ${i}` }));
    expect(filasSinInventario(docs)).toHaveLength(10);
  });

  it('opciones del filtro: estados presentes con su conteo; el elegido se conserva aunque ya no tenga búsquedas', () => {
    expect(opcionesEstado([b('son'), b('bcn'), b('bcn'), b(null)])).toEqual([
      { clave: 'bcn', nombre: 'Baja California', conteo: 2 },
      { clave: SIN_UBICACION, nombre: 'Sin ubicación', conteo: 1 },
      { clave: 'son', nombre: 'Sonora', conteo: 1 },
    ]);
    expect(opcionesEstado([b('bcn')], 'son')).toEqual([
      { clave: 'bcn', nombre: 'Baja California', conteo: 1 },
      { clave: 'son', nombre: 'Sonora', conteo: 0 },
    ]);
  });
});
