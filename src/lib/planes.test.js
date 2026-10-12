import { describe, expect, it } from 'vitest';
import {
  esPremiumVigente, estadoPlan, limitesEncendidos, casosPremiumVigente, tarjetaPlanSinCosto, FUNCIONES_PLAN_BASICO, PRECIO_PREMIUM_TEXTO,
} from './planes';

const AHORA = new Date('2026-10-12T12:00:00');

describe('esPremiumVigente: la misma tabla de casos que usan las pruebas de reglas', () => {
  for (const caso of casosPremiumVigente) {
    it(`${caso.nombre} → ${caso.esperado}`, () => {
      const yonke = { plan: caso.plan };
      if (caso.hastaRelativoMs !== null) yonke.premiumHasta = new Date(AHORA.getTime() + caso.hastaRelativoMs);
      expect(esPremiumVigente(yonke, AHORA)).toBe(caso.esperado);
    });
  }
  it('acepta un Timestamp de Firestore (toDate) y { seconds }', () => {
    const futuro = new Date(AHORA.getTime() + 86400000);
    expect(esPremiumVigente({ plan: 'premium', premiumHasta: { toDate: () => futuro } }, AHORA)).toBe(true);
    expect(esPremiumVigente({ plan: 'premium', premiumHasta: { seconds: (AHORA.getTime() - 1000) / 1000 } }, AHORA)).toBe(false);
  });
  it('vence justo en el instante: ya no es vigente', () => {
    expect(esPremiumVigente({ plan: 'premium', premiumHasta: AHORA }, AHORA)).toBe(false);
  });
  it('sin yonke: no es Premium', () => {
    expect(esPremiumVigente(null, AHORA)).toBe(false);
  });
});

describe('estadoPlan (admin)', () => {
  it('Premium vigente, Premium vencido y Básico', () => {
    expect(estadoPlan({ plan: 'premium' }, AHORA)).toBe('premium-vigente');
    expect(estadoPlan({ plan: 'premium', premiumHasta: new Date('2026-10-01') }, AHORA)).toBe('premium-vencido');
    expect(estadoPlan({ plan: 'freemium' }, AHORA)).toBe('basico');
    expect(estadoPlan({ plan: 'basico' }, AHORA)).toBe('basico');
    expect(estadoPlan({}, AHORA)).toBe('basico');
  });
});

describe('interruptor config/planes', () => {
  it('solo true exacto lo enciende', () => {
    expect(limitesEncendidos({ limitesActivos: true })).toBe(true);
    for (const valor of [false, 'true', 1, null, undefined]) expect(limitesEncendidos({ limitesActivos: valor })).toBe(false);
    expect(limitesEncendidos(null)).toBe(false);
  });
});

describe('textos públicos de la tarjeta del plan sin costo', () => {
  it('apagado: "Plan Gratuito" con la lista de siempre (regresión)', () => {
    const t = tarjetaPlanSinCosto(false);
    expect(t.nombre).toBe('Plan Gratuito');
    expect(t.funciones).toEqual(expect.arrayContaining(['Demanda: qué buscan los clientes en tu estado', 'Registro de compras de reciclaje', 'Notas de garantía en PDF para tus ventas']));
  });
  it('encendido: "Plan Básico" sin Demanda, Reciclaje ni notas de garantía', () => {
    const t = tarjetaPlanSinCosto(true);
    expect(t.nombre).toBe('Plan Básico');
    expect(t.funciones).toBe(FUNCIONES_PLAN_BASICO);
    const todo = t.funciones.join(' ');
    for (const premium of ['Demanda', 'eciclaje', 'Notas de garantía', 'Venta manual', 'subdominio']) expect(todo).not.toContain(premium);
    expect(todo).toContain('Calificaciones');
  });
  it('precio de Premium', () => {
    expect(PRECIO_PREMIUM_TEXTO).toBe('$398.00 MXN al mes más IVA');
  });
});
