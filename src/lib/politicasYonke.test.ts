import { describe, expect, it } from 'vitest';
import { politicasDesdeGarantia } from './politicasYonke';

describe('politicasDesdeGarantia', () => {
  it('sin garantía -> null (la página /politicas debe ocultarse)', () => {
    expect(politicasDesdeGarantia(undefined)).toBeNull();
    expect(politicasDesdeGarantia(null)).toBeNull();
    expect(politicasDesdeGarantia({})).toBeNull();
  });

  it('diasDefault guardado sin ningún texto real -> null (no cuenta como políticas capturadas)', () => {
    expect(politicasDesdeGarantia({ diasDefault: 15 })).toBeNull();
    expect(politicasDesdeGarantia({ diasDefault: 15, queCubre: '   ', queNoCubre: '' })).toBeNull();
  });

  it('con queCubre o queNoCubre -> objeto completo', () => {
    expect(politicasDesdeGarantia({ diasDefault: 15, queCubre: 'Cubre X', queNoCubre: 'No cubre Y' }))
      .toEqual({ diasDefault: 15, queCubre: 'Cubre X', queNoCubre: 'No cubre Y', actualizadoAtMs: null });
    expect(politicasDesdeGarantia({ queCubre: 'Solo esto' })?.queCubre).toBe('Solo esto');
    expect(politicasDesdeGarantia({ queNoCubre: 'Solo esto' })?.queNoCubre).toBe('Solo esto');
  });

  it('convierte actualizadoAt (Timestamp-like) a milisegundos', () => {
    const r = politicasDesdeGarantia({ queCubre: 'x', actualizadoAt: { toMillis: () => 12345 } });
    expect(r?.actualizadoAtMs).toBe(12345);
  });

  it('sin actualizadoAt -> null (no muestra fecha inventada)', () => {
    expect(politicasDesdeGarantia({ queCubre: 'x' })?.actualizadoAtMs).toBeNull();
  });

  it('diasDefault inválido -> null, sin romper', () => {
    expect(politicasDesdeGarantia({ queCubre: 'x', diasDefault: 'quince' })?.diasDefault).toBeNull();
  });
});
