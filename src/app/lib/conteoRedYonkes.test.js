import { describe, expect, it } from 'vitest';
import { textoConteoRedYonkes } from './conteoRedYonkes';

describe('línea "yonkes registrados en N estados y creciendo"', () => {
  it('plural y singular', () => {
    expect(textoConteoRedYonkes({ yonkes: 31, estados: 7 })).toBe('31 yonkes registrados en 7 estados y creciendo');
    expect(textoConteoRedYonkes({ yonkes: 1, estados: 1 })).toBe('1 yonke registrado en 1 estado y creciendo');
    expect(textoConteoRedYonkes({ yonkes: 5, estados: 1 })).toBe('5 yonkes registrados en 1 estado y creciendo');
  });
  it('sin conteo (la lectura falló) o en cero: no hay línea', () => {
    for (const c of [null, undefined, {}, { yonkes: 0, estados: 0 }, { yonkes: 3 }, { yonkes: '31', estados: 7 }]) {
      expect(textoConteoRedYonkes(c)).toBe('');
    }
  });
});
