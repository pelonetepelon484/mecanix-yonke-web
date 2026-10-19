import { describe, expect, it } from 'vitest';
import { estadoDelVisitante, repartoPorIp, sinEstadoYonke } from './otrosEstadosPorIp';

const ESTADOS = [{ id: 'baja-california', nombre: 'Baja California' }, { id: 'sonora', nombre: 'Sonora' }, { id: 'jalisco', nombre: 'Jalisco' }];
const tarjeta = (yonkeId, vehiculoId, estadoYonke, enviosNacionales = true) => ({ yonkeId, vehiculoId, estadoYonke, enviosNacionales });

describe('estado del visitante por IP', () => {
  it('traduce el código de Vercel al id de los yonkes; desconocido o sin traducción = null', () => {
    expect(estadoDelVisitante({ estado: 'bcn' })).toBe('baja-california');
    expect(estadoDelVisitante({ estado: 'son' })).toBe('sonora');
    expect(estadoDelVisitante({ estado: 'desconocido' })).toBeNull();
    expect(estadoDelVisitante({ estado: 'zzz' })).toBeNull();
    expect(estadoDelVisitante(null)).toBeNull();
  });
});

describe('reparto por IP', () => {
  it('estado por IP desconocido: no aplica', () => {
    expect(repartoPorIp({ resultados: [tarjeta('A', '1', 'sonora')] }, null, ESTADOS)).toBeNull();
  });

  it('un resultado del estado del visitante (en cualquier lista): no aplica', () => {
    expect(repartoPorIp({ resultados: [tarjeta('A', '1', 'sonora')], resultadosMotores: [{ yonkeId: 'B', motorId: 'm', estadoYonke: 'jalisco' }] }, 'jalisco', ESTADOS)).toBeNull();
  });

  it('un resultado CERCANO (año ±1) del estado del visitante cuenta como suyo: no aplica', () => {
    const respuesta = { resultados: [tarjeta('A', '2016', 'sonora')], resultadosCercanos: [tarjeta('B', '2017', 'jalisco')] };
    expect(repartoPorIp(respuesta, 'jalisco', ESTADOS)).toBeNull();
  });

  it('visitante de Baja California con un yonke sin estado guardado (cuenta como BC): no aplica', () => {
    // estadoYonke ya viene como 'baja-california' para un yonke sin estado (estadoDeYonke).
    expect(repartoPorIp({ resultados: [tarjeta('SIN-ESTADO', '1', 'baja-california')] }, 'baja-california', ESTADOS)).toBeNull();
  });

  it('ninguno del estado del visitante: agrupa por estado, sin tope y sin repetidos', () => {
    const respuesta = {
      resultados: Array.from({ length: 8 }, (_, i) => tarjeta(`S${i}`, `${i}`, 'sonora')),
      resultadosCercanos: [tarjeta('B', 'b', 'baja-california'), tarjeta('S0', '0', 'sonora')],
    };
    const r = repartoPorIp(respuesta, 'jalisco', ESTADOS);
    expect(r.sinResultadosEnTuEstado).toEqual({ estado: 'jalisco', estadoNombre: 'Jalisco' });
    expect(r.resultadosOtrosEstados.map((g) => [g.estado, g.estadoNombre, g.resultados.length])).toEqual([['sonora', 'Sonora', 8], ['baja-california', 'Baja California', 1]]);
  });

  it('los yonkes sin envíos nacionales no se ocultan: van al final de su grupo, en su orden', () => {
    const respuesta = {
      resultados: [tarjeta('A', '1', 'sonora', false), tarjeta('B', '2', 'sonora', true), tarjeta('C', '3', 'sonora', false), tarjeta('D', '4', 'sonora', true)],
      resultadosMotores: [{ yonkeId: 'E', motorId: 'm', estadoYonke: 'sonora', enviosNacionales: true }],
    };
    const [grupo] = repartoPorIp(respuesta, 'jalisco', ESTADOS).resultadosOtrosEstados;
    expect(grupo.resultados.map((x) => [x.yonkeId, x.enviosNacionales])).toEqual([['B', true], ['D', true], ['E', true], ['A', false], ['C', false]]);
  });

  it('sin ningún resultado: no aplica', () => {
    expect(repartoPorIp({ resultados: [] }, 'jalisco', ESTADOS)).toBeNull();
  });
});

describe('sinEstadoYonke', () => {
  it('quita estadoYonke de todas las listas y deja lo demás igual', () => {
    const respuesta = { estado: 'resultados', resultados: [tarjeta('A', '1', 'sonora')], resultadosMotores: [{ yonkeId: 'B', motorId: 'm', estadoYonke: 'sonora' }], marca: 'Honda' };
    expect(sinEstadoYonke(respuesta)).toEqual({
      estado: 'resultados', resultados: [{ yonkeId: 'A', vehiculoId: '1', enviosNacionales: true }], resultadosMotores: [{ yonkeId: 'B', motorId: 'm' }], marca: 'Honda',
    });
  });
});
