import { describe, expect, it } from 'vitest';
import {
  accionVehiculoCompleto, agregarPieza, calcularVenceEn, despuesDeLaTengo, diaTijuana, diasRestantes, disponibleParaPieza, estaVigente,
  idVehiculoAlerta, inventarioVehiculosActivo, limiteRespuestasDiarias, llegoAlLimite, normalizarPieza, piezaVendida, piezasDisponibles,
} from './vehiculosAlerta';

const DIA = 24 * 60 * 60 * 1000;
const AHORA = new Date('2026-10-12T18:00:00Z');
const vigente = (extra = {}) => ({ estado: 'activo', venceEn: new Date(AHORA.getTime() + 10 * DIA), piezasAlerta: ['Alternador'], piezasVendidas: [], ...extra });
const vencido = (extra = {}) => vigente({ venceEn: new Date(AHORA.getTime() - DIA), ...extra });

describe('vigencia de 30 días', () => {
  it('vence 30 días después de hoy', () => {
    expect(calcularVenceEn(AHORA).getTime() - AHORA.getTime()).toBe(30 * DIA);
  });
  it('vigente solo si está activo y venceEn es futuro (acepta Timestamp de Firestore)', () => {
    expect(estaVigente(vigente(), AHORA)).toBe(true);
    expect(estaVigente(vencido(), AHORA)).toBe(false);
    expect(estaVigente(vigente({ estado: 'vencido' }), AHORA)).toBe(false);
    expect(estaVigente(vigente({ venceEn: { toDate: () => new Date(AHORA.getTime() + DIA) } }), AHORA)).toBe(true);
    expect(estaVigente(null, AHORA)).toBe(false);
  });
  it('días restantes redondeados hacia arriba, nunca negativos', () => {
    expect(diasRestantes(vigente(), AHORA)).toBe(10);
    expect(diasRestantes(vencido(), AHORA)).toBe(0);
  });
});

describe('piezas vendidas (nombre normalizado)', () => {
  it('normaliza mayúsculas, acentos y espacios', () => {
    expect(normalizarPieza('  Batería   Nueva ')).toBe('bateria nueva');
  });
  it('una pieza vendida oculta solo esa pieza, no otras parecidas', () => {
    const v = vigente({ piezasVendidas: ['Faro derecho', 'ALTERNADOR'] });
    expect(piezaVendida(v, 'alternador')).toBe(true);
    expect(piezaVendida(v, 'Faro derecho')).toBe(true);
    expect(piezaVendida(v, 'Faro izquierdo')).toBe(false);
    expect(piezaVendida(v, 'Faro')).toBe(false);
  });
  it('el comprador lo ve solo si está vigente y la pieza no se vendió', () => {
    expect(disponibleParaPieza(vigente(), 'Marcha', AHORA)).toBe(true);
    expect(disponibleParaPieza(vigente({ piezasVendidas: ['Marcha'] }), 'marcha', AHORA)).toBe(false);
    expect(disponibleParaPieza(vencido(), 'Marcha', AHORA)).toBe(false);
  });
  it('agregarPieza no repite y piezasDisponibles quita las vendidas', () => {
    expect(agregarPieza(['Alternador'], 'alternador')).toEqual(['Alternador']);
    expect(agregarPieza(['Alternador'], ' Faro ')).toEqual(['Alternador', 'Faro']);
    expect(agregarPieza(undefined, '')).toEqual([]);
    expect(piezasDisponibles(vigente({ piezasAlerta: ['Alternador', 'Faro'], piezasVendidas: ['alternador'] }))).toEqual(['Faro']);
  });
});

describe('qué pasa cuando el yonke contesta', () => {
  it('"La tengo" con el vehículo vigente: se descuenta la pieza sin preguntar', () => {
    expect(despuesDeLaTengo(vigente(), AHORA)).toBe('descontarPieza');
  });
  it('"La tengo" sin el vehículo o vencido: se pregunta si tiene el vehículo completo', () => {
    expect(despuesDeLaTengo(null, AHORA)).toBe('preguntarVehiculo');
    expect(despuesDeLaTengo(vencido(), AHORA)).toBe('preguntarVehiculo');
  });
  it('"Sí, vehículo completo": crea si no existe, renueva si venció', () => {
    expect(accionVehiculoCompleto(null, AHORA)).toBe('crear');
    expect(accionVehiculoCompleto(vencido(), AHORA)).toBe('renovar');
    expect(accionVehiculoCompleto(vigente(), AHORA)).toBe('descontarPieza');
  });
  it('un documento por vehículo: el id usa el mismo "compacto" del buscador', () => {
    expect(idVehiculoAlerta('Honda', 'CR-V', 2020)).toBe('honda_crv_2020');
    expect(idVehiculoAlerta('HONDA', 'cr v', 2020)).toBe('honda_crv_2020');
  });
});

describe('límite diario (plan Básico)', () => {
  it('el día se cuenta con la hora de Tijuana, no UTC', () => {
    // 2026-10-13 05:00 UTC = 2026-10-12 22:00 en Tijuana (horario de verano, UTC-7).
    expect(diaTijuana(new Date('2026-10-13T05:00:00Z'))).toBe('20261012');
    // 07:30 UTC = 00:30 en Tijuana: ya es el día siguiente.
    expect(diaTijuana(new Date('2026-10-13T07:30:00Z'))).toBe('20261013');
    // Invierno (UTC-8): 2026-12-01 07:30 UTC = 23:30 del 30 de noviembre.
    expect(diaTijuana(new Date('2026-12-01T07:30:00Z'))).toBe('20261130');
  });
  it('sin limiteRespuestasDiarias (o con algo que no es un entero >= 1) no hay límite', () => {
    expect(limiteRespuestasDiarias(null)).toBeNull();
    expect(limiteRespuestasDiarias({})).toBeNull();
    expect(limiteRespuestasDiarias({ limiteRespuestasDiarias: '50' })).toBeNull();
    expect(limiteRespuestasDiarias({ limiteRespuestasDiarias: 0 })).toBeNull();
    expect(limiteRespuestasDiarias({ limiteRespuestasDiarias: 50 })).toBe(50);
  });
  it('al llegar a 50 el Básico ya no responde; Premium nunca llega', () => {
    expect(llegoAlLimite(49, 50, false)).toBe(false);
    expect(llegoAlLimite(50, 50, false)).toBe(true);
    expect(llegoAlLimite(500, 50, true)).toBe(false);
    expect(llegoAlLimite(500, null, false)).toBe(false);
  });
  it('el inventario de vehículos exige las dos banderas', () => {
    expect(inventarioVehiculosActivo({ habilitado: true, inventarioVehiculos: true })).toBe(true);
    expect(inventarioVehiculosActivo({ habilitado: true })).toBe(false);
    expect(inventarioVehiculosActivo({ inventarioVehiculos: true })).toBe(false);
    expect(inventarioVehiculosActivo(null)).toBe(false);
  });
});
