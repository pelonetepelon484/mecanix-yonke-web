import { describe, expect, it } from 'vitest';
import {
  esPremiumVigente, estadoPlan, limitesEncendidos, casosPremiumVigente, tarjetaPlanSinCosto, FUNCIONES_PLAN_BASICO, PRECIO_PREMIUM_TEXTO,
  FUNCIONES_PLAN_PREMIUM, FUNCIONES_TALLER_BASICO, FUNCIONES_TALLER_PREMIUM, LIMITE_RESPUESTAS_DIARIAS_BASICO, URL_QUIERO_PREMIUM,
  URL_QUIERO_PREMIUM_TALLER, tarjetasTalleresEncendidas,
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

describe('textos nuevos de las tarjetas', () => {
  it('Básico de yonkes: pedidos y alertas por separado, con el límite diario, vehículo completo y avisos', () => {
    expect(LIMITE_RESPUESTAS_DIARIAS_BASICO).toBe(50);
    expect(FUNCIONES_PLAN_BASICO).toEqual([
      'Tu yonke visible en el buscador público de Mecanix',
      'Inventario sin límite con fotos: vehículos, motores y piezas sueltas',
      'Pedidos: reservaciones de clientes y pedidos de talleres',
      'Alertas de búsqueda en tiempo real: responde hasta 50 al día',
      'Si tienes el vehículo completo, queda disponible 30 días sin capturarlo',
      'Avisos en tu celular cuando llega una alerta o un pedido (Android)',
      'Contacto directo por WhatsApp',
      'Datos de tu negocio: logo, información, horario, métodos de pago y garantía',
      'Calificaciones de tus clientes',
    ]);
  });
  it('Premium de yonkes: las funciones de pago, sin el año gratis', () => {
    expect(FUNCIONES_PLAN_PREMIUM[0]).toBe('Todo lo del Plan Básico');
    const todo = FUNCIONES_PLAN_PREMIUM.join(' ');
    for (const f of ['sin límite', 'Sigo manteniendo mis vehículos', 'Venta manual', 'notas de garantía', 'Demanda', 'Reciclaje', 'subdominio', '⭐ Premium', 'Las demás funciones']) {
      expect(todo).toContain(f);
    }
    expect(todo).not.toMatch(/gratis|sin costo|noviembre|año/i);
    expect(URL_QUIERO_PREMIUM).toBe('https://wa.me/5216611034260?text=Hola%2C%20me%20interesa%20el%20Plan%20Premium%20de%20Mecanix%20Yonke%20Virtual');
  });
  it('talleres: Básico y Premium, sin decir que las órdenes de servicio no tienen costo', () => {
    expect(FUNCIONES_TALLER_BASICO).toEqual([
      'Cotizaciones para tus clientes, con PDF',
      'Pide piezas a los yonkes y compara sus respuestas',
      'Aviso de privacidad para tus clientes incluido',
    ]);
    expect(FUNCIONES_TALLER_PREMIUM).toEqual(['Todo lo del Plan Básico', 'Órdenes de servicio con PDF', 'Descarga de todos tus documentos', 'Historial de servicios y recordatorios de mantenimiento', 'Enlace de seguimiento de órdenes para tu cliente', 'Las demás funciones que se incorporen']);
    expect([...FUNCIONES_TALLER_BASICO, ...FUNCIONES_TALLER_PREMIUM].join(' ')).not.toMatch(/sin costo|gratis/i);
    expect(decodeURIComponent(URL_QUIERO_PREMIUM_TALLER)).toBe('https://wa.me/5216611034260?text=Hola, me interesa el Plan Premium de Mecanix para talleres');
  });
  it('interruptor tarjetasTalleres: solo true exacto', () => {
    expect(tarjetasTalleresEncendidas({ tarjetasTalleres: true })).toBe(true);
    for (const c of [null, undefined, {}, { tarjetasTalleres: false }, { tarjetasTalleres: 'true' }, { tarjetasTalleres: 1 }]) {
      expect(tarjetasTalleresEncendidas(c)).toBe(false);
    }
  });
});
