import { describe, expect, it } from 'vitest';
import { deleteField, Timestamp } from 'firebase/firestore';
import { cambiosPlan, fechaParaCampo, origenPremium, planSinCambios } from './planTaller';
import { ordenesRequierenPremium, premiumOrdenesOk } from '../../../lib/planes';

describe('admin/talleres: lo que se guarda', () => {
  it('Premium con fecha guarda el Timestamp de ese día; sin fecha o Básico borra la fecha', () => {
    const c = cambiosPlan('premium', '2026-12-31');
    expect(c.plan).toBe('premium');
    expect(c.premiumHasta).toBeInstanceOf(Timestamp);
    expect(fechaParaCampo(c.premiumHasta)).toBe('2026-12-31');
    expect(cambiosPlan('premium', '').premiumHasta).toEqual(deleteField());
    expect(cambiosPlan('freemium', '2026-12-31')).toEqual({ plan: 'freemium', premiumHasta: deleteField(), premiumOrigen: deleteField() });
    expect(c.premiumOrigen).toBe('admin');
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

describe('admin/talleres: origen y vencimiento del Premium', () => {
  it('promoción: lo dice, con fecha y hora exactas de Tijuana', () => {
    const o = origenPremium({ plan: 'premium', premiumOrigen: 'promo', premiumHasta: Timestamp.fromDate(new Date('2027-01-29T17:58:00Z')) });
    expect(o.texto).toBe('🎁 Premium por promoción (registro)');
    expect(o.vence).toBe('Vence el 29 de enero de 2027 a las 09:58 (hora de Tijuana)');
  });
  it('Premium sin premiumOrigen (los de antes) o del admin: "asignado por ti"; Básico: nada', () => {
    expect(origenPremium({ plan: 'premium' })).toEqual({ texto: '👤 Premium asignado por ti', vence: 'Sin vencimiento' });
    expect(origenPremium({ plan: 'premium', premiumOrigen: 'admin', premiumHasta: new Date('2027-05-01T07:00:00Z') }).texto).toBe('👤 Premium asignado por ti');
    expect(origenPremium({ plan: 'freemium' })).toBeNull();
    expect(origenPremium({})).toBeNull();
  });
  it('"Guardar plan" sin cambios no escribe (la promoción no pasa a "por ti")', () => {
    const promo = { plan: 'premium', premiumOrigen: 'promo', premiumHasta: Timestamp.fromDate(new Date('2027-01-29T20:00:00')) };
    expect(planSinCambios(promo, 'premium', fechaParaCampo(promo.premiumHasta))).toBe(true);
    expect(planSinCambios(promo, 'premium', '2027-02-15')).toBe(false);
    expect(planSinCambios(promo, 'freemium', '')).toBe(false);
    expect(planSinCambios({}, 'freemium', '')).toBe(true);
    expect(planSinCambios({}, 'premium', '')).toBe(false);
  });
});
