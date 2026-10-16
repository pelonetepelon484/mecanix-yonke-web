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
