import { describe, expect, it } from 'vitest';
import { MAX_RENGLONES_ARCHIVO, idEquivalencia, parsearArchivo } from './equivalencias';

describe('subir archivo de equivalencias', () => {
  it('lee tipo | nota | números y cuenta lo que se guarda, lo repetido y lo que tiene problema', () => {
    const texto = [
      '# comentario',
      'tcm | GM Silverado 2010 | 24256525, 24254911',
      '',
      'cluster | Nissan Altima 2013 - 2015 | 24810-9HM1A, 24810-3TM0B',
      'bcm | Repetido dentro del archivo | 24254911, 24256525',
      'tcm | Repetido del mismo tipo | 24256525, 24254911',
      'frenos | Tipo que ya no existe | AAA111, BBB222',
      'suspension | Quitado del menú | AAA111, BBB222',
      'motor | Un solo número | 12345678',
      'sin separadores',
    ].join('\n');
    const { renglones } = parsearArchivo(texto, { existentes: [{ tipoPieza: 'cluster', partes: ['248109HM1A', '248103TM0B'] }] });
    expect(renglones.map((r) => [r.numero, r.estado])).toEqual([
      [2, 'ok'], [4, 'repetido'], [5, 'ok'], [6, 'repetido'], [7, 'error'], [8, 'error'], [9, 'error'], [10, 'error'],
    ]);
    expect(renglones[0].datos).toEqual({ clase: 'equivalencia', tipoPieza: 'tcm', partes: ['24256525', '24254911'], nota: 'GM Silverado 2010' });
    expect(renglones[4].mensaje).toMatch(/Tipo desconocido/);
  });

  it(`más de ${MAX_RENGLONES_ARCHIVO} renglones: pide partirlo`, () => {
    const t = Array.from({ length: MAX_RENGLONES_ARCHIVO + 1 }, (_, i) => `motor | M | ${10000 + i}A, ${20000 + i}B`).join('\n');
    expect(parsearArchivo(t).demasiados).toBe(true);
  });

  it('ID fijo: mismo tipo y mismos números (en cualquier orden) dan el mismo ID', () => {
    expect(idEquivalencia('tcm', ['B2', 'A1'])).toBe(idEquivalencia('tcm', ['A1', 'B2']));
    expect(idEquivalencia('tcm', ['A1', 'B2'])).not.toBe(idEquivalencia('bcm', ['A1', 'B2']));
    expect(idEquivalencia('tcm', ['A1', 'B2'])).toMatch(/^tcm_[0-9a-f]{14}$/);
  });
});
