import { describe, expect, it } from 'vitest';
import { deleteField, Timestamp } from 'firebase/firestore';
import { cambiosPlan, fechaParaCampo } from './planTaller';
import { ordenesRequierenPremium, premiumOrdenesOk } from '../../../lib/planes';

describe('admin/talleres: lo que se guarda', () => {
  it('Premium con fecha guarda el Timestamp de ese día; sin fecha o Básico borra la fecha', () => {
    const c = cambiosPlan('premium', '2026-12-31');
    expect(c.plan).toBe('premium');
    expect(c.premiumHasta).toBeInstanceOf(Timestamp);
    expect(fechaParaCampo(c.premiumHasta)).toBe('2026-12-31');
    expect(cambiosPlan('premium', '').premiumHasta).toEqual(deleteField());
    expect(cambiosPlan('freemium', '2026-12-31')).toEqual({ plan: 'freemium', premiumHasta: deleteField() });
  });
  it('fecha para el campo: vacía si no hay', () => {
    expect(fechaParaCampo(null)).toBe('');
    expect(fechaParaCampo(undefined)).toBe('');
  });
});

describe('candado de órdenes (config/ordenes.requierePremium)', () => {
  const ahora = new Date('2026-10-21T12:00:00Z');
  it('solo true exacto lo enciende', () => {
    expect(ordenesRequierenPremium(null)).toBe(false);
    expect(ordenesRequierenPremium({})).toBe(false);
    expect(ordenesRequierenPremium({ requierePremium: 'true' })).toBe(false);
    expect(ordenesRequierenPremium({ requierePremium: true })).toBe(true);
  });
  it('apagado: siempre se puede; encendido: solo Premium vigente', () => {
    expect(premiumOrdenesOk({}, {}, ahora)).toBe(true);
    const on = { requierePremium: true };
    expect(premiumOrdenesOk(on, {}, ahora)).toBe(false);
    expect(premiumOrdenesOk(on, { plan: 'premium' }, ahora)).toBe(true);
    expect(premiumOrdenesOk(on, { plan: 'premium', premiumHasta: new Date('2026-11-01') }, ahora)).toBe(true);
    expect(premiumOrdenesOk(on, { plan: 'premium', premiumHasta: new Date('2026-10-01') }, ahora)).toBe(false);
  });
});
