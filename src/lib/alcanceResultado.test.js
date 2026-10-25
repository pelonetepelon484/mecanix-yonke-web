import { describe, expect, it } from 'vitest';
import { ALCANCES_RESULTADO, ETIQUETAS_ALCANCE, alcanceResultado, calcularAlcanceResultado } from './alcanceResultado';

describe('alcance del resultado: los 3 valores al guardar', () => {
  it('con resultado: ok sin soloOtrosEstados', () => {
    expect(calcularAlcanceResultado({ estado: 'ok' })).toBe('con_resultado');
  });
  it('solo en otros estados: ok por IP sin nada del estado del visitante, o sin_inventario con tarjetas de otros estados', () => {
    expect(calcularAlcanceResultado({ estado: 'ok', soloOtrosEstados: true })).toBe('solo_otros_estados');
    expect(calcularAlcanceResultado({ estado: 'sin_inventario', otrosEstados: { mostrados: 3, yonkeIds: ['A'] } })).toBe('solo_otros_estados');
  });
  it('sin resultado: nada en ningún estado (también si se buscó en otros estados y no hubo)', () => {
    expect(calcularAlcanceResultado({ estado: 'sin_inventario' })).toBe('sin_resultado');
    expect(calcularAlcanceResultado({ estado: 'sin_inventario', otrosEstados: { mostrados: 0, yonkeIds: [] } })).toBe('sin_resultado');
    for (const estado of ['fuera_de_catalogo', 'no_interpretada', 'numero_de_parte', 'pieza_sin_vehiculo']) {
      expect(calcularAlcanceResultado({ estado })).toBe('sin_resultado');
    }
  });
  it('solo esos 3 valores, cada uno con su etiqueta', () => {
    expect(ALCANCES_RESULTADO).toEqual(['con_resultado', 'solo_otros_estados', 'sin_resultado']);
    expect(ETIQUETAS_ALCANCE.solo_otros_estados.texto).toBe('↗ Solo en otros estados');
  });
});

describe('alcance del resultado: al leer (registros nuevos y viejos, sin reescribir)', () => {
  it('con el campo: se usa tal cual', () => {
    for (const a of ALCANCES_RESULTADO) expect(alcanceResultado({ alcanceResultado: a, conResultado: true })).toBe(a);
  });
  it('busquedas viejas sin el campo: soloOtrosEstados → otrosEstados.mostrados > 0 → conResultado → estado ok', () => {
    expect(alcanceResultado({ estado: 'ok', conResultado: true, soloOtrosEstados: true })).toBe('solo_otros_estados');
    expect(alcanceResultado({ estado: 'sin_inventario', conResultado: false, otrosEstados: { mostrados: 2 } })).toBe('solo_otros_estados');
    expect(alcanceResultado({ estado: 'sin_inventario', conResultado: false, otrosEstados: { mostrados: 0 } })).toBe('sin_resultado');
    expect(alcanceResultado({ estado: 'ok', conResultado: true })).toBe('con_resultado');
    expect(alcanceResultado({ estado: 'sin_inventario', conResultado: false })).toBe('sin_resultado');
    // Los más viejos, sin conResultado: por estado.
    expect(alcanceResultado({ estado: 'ok' })).toBe('con_resultado');
    expect(alcanceResultado({ estado: 'fuera_de_catalogo' })).toBe('sin_resultado');
  });
  it('busquedasResumen viejos (solo conResultado): con o sin resultado, como antes', () => {
    expect(alcanceResultado({ estado: 'ok', conResultado: true, estadoGeografico: 'son' })).toBe('con_resultado');
    expect(alcanceResultado({ estado: 'sin_inventario', conResultado: false, estadoGeografico: 'son' })).toBe('sin_resultado');
  });
  it('un valor raro en el campo no se cree: se deduce', () => {
    expect(alcanceResultado({ alcanceResultado: 'otra cosa', conResultado: true })).toBe('con_resultado');
  });
});
