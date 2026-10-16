import { describe, expect, it } from 'vitest';
import { MAX_RESUMEN_ALERTAS, alertasDeEstado, armarResumen } from './alertasRecientes';

const AHORA = new Date('2026-10-15T18:00:00Z');
const H = 60 * 60 * 1000;
const ts = (ms) => ({ toDate: () => new Date(ms) });
const pedido = (id, horasAtras, extra = {}) => ({
  id, pieza: 'Alternador', vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2005 }, estado: 'baja-california',
  estadoPedido: 'abierta', creadoAt: ts(AHORA.getTime() - horasAtras * H), expiraAt: ts(AHORA.getTime() + 24 * H), ...extra,
});

describe('resumen público de alertas', () => {
  it('solo abiertas y no vencidas, la más reciente primero, máximo 30', () => {
    const lista = [
      pedido('A', 3), pedido('B', 1), pedido('C', 2, { estadoPedido: 'cerrada' }),
      pedido('D', 4, { expiraAt: ts(AHORA.getTime() - 1) }), pedido('E', 5, { estadoPedido: 'cancelada' }),
      ...Array.from({ length: 40 }, (_, i) => pedido(`X${i}`, 10 + i)),
    ];
    const r = armarResumen(lista, AHORA);
    expect(r).toHaveLength(MAX_RESUMEN_ALERTAS);
    expect(r.slice(0, 3).map((a) => a.id)).toEqual(['B', 'A', 'X0']);
  });

  it('guarda SOLO id, pieza, vehículo, estado y fechas (nada del cliente ni campos de más)', () => {
    const [a] = armarResumen([pedido('A', 1, { whatsapp: '6641234567', aceptaOtrosEstados: true, nota: 'x' })], AHORA);
    expect(Object.keys(a).sort()).toEqual(['creadoMs', 'estado', 'expiraMs', 'id', 'pieza', 'vehiculo']);
    expect(a.vehiculo).toEqual({ marca: 'Nissan', modelo: 'Sentra', anio: 2005 });
  });

  it('por estado: solo ese estado (aunque otras acepten otros estados) y vigentes, en el formato público', () => {
    const resumen = armarResumen([pedido('A', 1), pedido('B', 2, { estado: 'sonora', aceptaOtrosEstados: true }), pedido('C', 3)], AHORA);
    const bc = alertasDeEstado(resumen, 'baja-california', AHORA);
    expect(bc.map((a) => a.id)).toEqual(['A', 'C']);
    expect(bc[0]).toEqual({ id: 'A', vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2005 }, pieza: 'Alternador', estado: 'baja-california', creadoAt: new Date(AHORA.getTime() - H).toISOString() });
    expect(alertasDeEstado(resumen, 'baja-california', new Date(AHORA.getTime() + 48 * H))).toEqual([]);
    expect(alertasDeEstado(resumen, null, AHORA)).toEqual([]);
    expect(alertasDeEstado(resumen, 'baja-california', AHORA, 1)).toHaveLength(1);
  });
});

import { haceCuanto, rotacionInicial, rotarUnPaso } from './alertasRecientes';

describe('"hace X minutos" con la hora del servidor', () => {
  const creado = '2026-10-16T18:00:00.000Z';
  const t = (min) => Date.parse(creado) + min * 60000;
  it('menos de 1 minuto: "hace un momento"; luego minutos, horas y días', () => {
    expect(haceCuanto(creado, t(0.5))).toBe('hace un momento');
    expect(haceCuanto(creado, t(-3))).toBe('hace un momento');
    expect(haceCuanto(creado, t(1))).toBe('hace 1 minuto');
    expect(haceCuanto(creado, t(42))).toBe('hace 42 minutos');
    expect(haceCuanto(creado, t(60))).toBe('hace 1 hora');
    expect(haceCuanto(creado, t(185))).toBe('hace 3 horas');
    expect(haceCuanto(creado, t(60 * 24))).toBe('hace 1 día');
    expect(haceCuanto(creado, t(60 * 50))).toBe('hace 2 días');
    expect(haceCuanto('no-fecha', t(5))).toBe('');
  });
});

describe('rotación de la ventana', () => {
  const lista = (n) => Array.from({ length: n }, (_, i) => ({ id: `A${i}` }));
  it('con 5 o menos: fijas, sin rotar', () => {
    const l = lista(5);
    const r = rotacionInicial(l);
    expect(r.mostradas).toEqual(['A0', 'A1', 'A2', 'A3', 'A4']);
    expect(rotarUnPaso(r, l)).toBe(r);
    expect(rotacionInicial(lista(3)).mostradas).toEqual(['A0', 'A1', 'A2']);
  });
  it('con más de 5: la siguiente entra arriba, sale la de abajo y da la vuelta', () => {
    const l = lista(7);
    let r = rotacionInicial(l);
    r = rotarUnPaso(r, l);
    expect(r.mostradas).toEqual(['A5', 'A0', 'A1', 'A2', 'A3']);
    r = rotarUnPaso(r, l);
    expect(r.mostradas).toEqual(['A6', 'A5', 'A0', 'A1', 'A2']);
    r = rotarUnPaso(r, l);
    expect(r.mostradas).toEqual(['A0', 'A6', 'A5', 'A1', 'A2']);
    expect(new Set(r.mostradas).size).toBe(5);
  });
});
