import { describe, expect, it } from 'vitest';
import {
  DIAS_RETENCION_HISTORIAL, descripcionDeTrabajos, enlaceWhatsappHistorial, expiraHistorial, mensajeWhatsappHistorial,
  mismoVehiculo, normalizarPlacas, piezasDeOrden, servicioDesdeOrden,
} from './historialTaller';

describe('placas', () => {
  it('mayúsculas y sin espacios; máximo 12; letras, números y guiones', () => {
    expect(normalizarPlacas(' abc 123 ')).toBe('ABC123');
    expect(normalizarPlacas('abc-12-3')).toBe('ABC-12-3');
    expect(normalizarPlacas('')).toBeNull();
    expect(normalizarPlacas('   ')).toBeNull();
    expect(normalizarPlacas('ABCDEFGHIJKLM')).toBeNull();
    expect(normalizarPlacas('ABC.123')).toBeNull();
    expect(normalizarPlacas(undefined)).toBeNull();
  });
});

describe('servicio desde la orden', () => {
  const orden = {
    estado: 'entregado', fechaEntrega: 'FECHA',
    cliente: { nombre: 'Juan', telefono: '6641112233' },
    vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001, kilometraje: 150000, placas: 'ABC123' },
    trabajos: [{ descripcion: 'Cambio de balatas', cantidad: 1, precioUnitario: 500 }, { descripcion: ' Alineación ' }],
    piezas: [{ descripcion: 'Balatas', precioUnitario: 400 }, { descripcion: '' }],
  };
  it('folio, fecha de entrega, kilometraje, descripción de los trabajos y solo nombres de piezas', () => {
    expect(servicioDesdeOrden(orden, 'O251011-AAAA')).toEqual({
      folio: 'O251011-AAAA', fecha: 'FECHA', kilometraje: 150000, descripcion: 'Cambio de balatas; Alineación', piezas: ['Balatas'],
    });
  });
  it('NUNCA lleva nombre, teléfono ni precios', () => {
    const texto = JSON.stringify(servicioDesdeOrden(orden, 'O251011-AAAA'));
    expect(texto).not.toContain('Juan');
    expect(texto).not.toContain('6641112233');
    expect(texto).not.toContain('precio');
    expect(texto).not.toContain('cantidad');
  });
  it('sin kilometraje no lleva el campo; topes de 1000 letras y 20 piezas', () => {
    const s = servicioDesdeOrden({ ...orden, vehiculo: { ...orden.vehiculo, kilometraje: undefined } }, 'F');
    expect('kilometraje' in s).toBe(false);
    expect(descripcionDeTrabajos(Array(20).fill({ descripcion: 'x'.repeat(200) })).length).toBe(1000);
    expect(piezasDeOrden(Array(25).fill({ descripcion: 'p' }))).toHaveLength(20);
  });
});

describe('mismo vehículo, borrado y WhatsApp', () => {
  it('marca y modelo sin importar mayúsculas, mismo año', () => {
    const v = { marca: 'Nissan', modelo: 'Sentra', anio: 2001 };
    expect(mismoVehiculo({ vehiculo: { marca: 'NISSAN', modelo: 'sentra ', anio: 2001 } }, v)).toBe(true);
    expect(mismoVehiculo({ vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2002 } }, v)).toBe(false);
  });
  it('se borra 548 días después', () => {
    expect(expiraHistorial(0).getTime()).toBe(DIAS_RETENCION_HISTORIAL * 86400000);
  });
  it('con teléfono: wa.me con el número; sin él: wa.me sin número; siempre con el mensaje', () => {
    const m = mensajeWhatsappHistorial('Taller Pérez', { marca: 'Nissan', modelo: 'Sentra', anio: 2001, placas: 'ABC123' });
    expect(m).toBe('Hola, le escribimos de Taller Pérez sobre su Nissan Sentra 2001 (placas ABC123).');
    expect(enlaceWhatsappHistorial('664 111 2233', m)).toBe(`https://wa.me/526641112233?text=${encodeURIComponent(m)}`);
    expect(enlaceWhatsappHistorial(null, m)).toBe(`https://wa.me/?text=${encodeURIComponent(m)}`);
  });
});

import {
  MAX_RECORDATORIOS, calcularProximoAviso, cambiarRecordatorio, mensajeWhatsappRecordatorio, pasosParaAgregar,
  pendientesPorAvisar, sumarMeses, ultimoServicio, type Recordatorio,
} from './historialTaller';

const DIA = 86400000;
const BASE = new Date(2026, 0, 31, 12).getTime();
const r = (n: number, extra: Partial<Recordatorio> = {}): Recordatorio => ({
  id: `r${n}`, tipo: `Servicio ${n}`, fecha: BASE + n * DIA, avisarDiasAntes: 15, folio: 'O1', estado: 'pendiente', creadoAt: BASE, ...extra,
});

describe('recordatorios: fechas y proximoAviso', () => {
  it('sumar meses (31 de enero + 1 = último día de febrero)', () => {
    const f = new Date(sumarMeses(BASE, 1));
    expect([f.getMonth(), f.getDate()]).toEqual([1, 28]);
    expect(new Date(sumarMeses(BASE, 6)).getMonth()).toBe(6);
  });
  it('proximoAviso = el menor (fecha - días) de los pendientes; null sin pendientes', () => {
    expect(calcularProximoAviso([r(10), r(5, { avisarDiasAntes: 0 }), r(1, { estado: 'atendido' })])).toBe(BASE - 5 * DIA);
    expect(calcularProximoAviso([r(10, { avisarDiasAntes: 30 }), r(15)])).toBe(BASE - 20 * DIA);
    expect(calcularProximoAviso([r(1, { estado: 'atendido' })])).toBeNull();
    expect(calcularProximoAviso([])).toBeNull();
  });
});

describe('recordatorios: agregar en pasos chicos (límite de las reglas)', () => {
  const ctx = { fechaEntrega: BASE, folio: 'O2', ahora: BASE, id: () => 'nuevo123' };
  it('agrega al final con fecha = entrega + meses y aviso 15 días antes', () => {
    const pasos = pasosParaAgregar([r(1)], { tipo: ' Cambio de aceite ', meses: 6 }, ctx);
    expect(pasos).toHaveLength(1);
    expect(pasos[0][1]).toEqual({ id: 'nuevo123', tipo: 'Cambio de aceite', fecha: sumarMeses(BASE, 6), avisarDiasAntes: 15, folio: 'O2', estado: 'pendiente', creadoAt: BASE });
  });
  it('el pendiente del mismo tipo (sin importar mayúsculas) queda atendido', () => {
    const [lista] = pasosParaAgregar([r(1, { tipo: 'cambio de aceite' })], { tipo: 'Cambio de aceite', meses: 6 }, ctx);
    expect(lista.map((x) => x.estado)).toEqual(['atendido', 'pendiente']);
  });
  it(`lleno (${MAX_RECORDATORIOS}): primero quita el atendido más viejo (un guardado) y luego agrega (otro)`, () => {
    const llenos = Array.from({ length: MAX_RECORDATORIOS }, (_, i) => r(i + 1, { estado: i === 2 ? 'atendido' : 'pendiente' }));
    const pasos = pasosParaAgregar(llenos, { tipo: 'Frenos', meses: 12 }, ctx);
    expect(pasos).toHaveLength(2);
    expect(pasos[0]).toHaveLength(MAX_RECORDATORIOS - 1);
    expect(pasos[0].some((x) => x.id === 'r3')).toBe(false);
    expect(pasos[1]).toHaveLength(MAX_RECORDATORIOS);
  });
  it('lleno sin atendidos, tipo vacío o meses fuera de rango: error en español', () => {
    const llenos = Array.from({ length: MAX_RECORDATORIOS }, (_, i) => r(i + 1));
    expect(() => pasosParaAgregar(llenos, { tipo: 'Frenos', meses: 12 }, ctx)).toThrow('ya tiene 10 recordatorios');
    expect(() => pasosParaAgregar([], { tipo: ' ', meses: 12 }, ctx)).toThrow('Escribe el servicio');
    expect(() => pasosParaAgregar([], { tipo: 'Frenos', meses: 0 }, ctx)).toThrow('1 a 120 meses');
  });
  it('cambiar: días de aviso de 0 a 60', () => {
    expect(cambiarRecordatorio([r(1)], 'r1', { avisarDiasAntes: 30 })[0].avisarDiasAntes).toBe(30);
    expect(() => cambiarRecordatorio([r(1)], 'r1', { avisarDiasAntes: 61 })).toThrow('0 a 60');
  });
  it('pendientes por avisar: solo los que ya tocan, del más próximo al más lejano', () => {
    const lista = [r(30), r(10), r(100), r(5, { estado: 'atendido' })];
    expect(pendientesPorAvisar(lista, BASE + 20 * DIA).map((x) => x.id)).toEqual(['r10', 'r30']);
  });
  it('mensaje de WhatsApp: placas, servicio pendiente y el aviso de los 5 mil km; sin datos del cliente', () => {
    const m = mensajeWhatsappRecordatorio('Taller Pérez', { marca: 'Nissan', modelo: 'Sentra', anio: 2001, placas: 'ABC123' }, ['Cambio de aceite'], '15 de abril de 2026');
    expect(m).toContain('placas ABC123');
    expect(m).toContain('Cambio de aceite');
    expect(m).toContain('5 mil km');
    expect(m).toContain('Taller Pérez');
  });
});

describe('agregar recordatorio a un vehículo existente', () => {
  const ctx = { fechaEntrega: BASE, folio: 'O2', ahora: BASE, id: () => 'nuevo123' };
  it('con fecha elegida a mano (sin meses)', () => {
    const fecha = BASE + 40 * DIA;
    const [lista] = pasosParaAgregar([], { tipo: 'Clima', fecha }, ctx);
    expect(lista[0].fecha).toBe(fecha);
    expect(() => pasosParaAgregar([], { tipo: 'Clima', fecha: Number.NaN }, ctx)).toThrow('Elige la fecha');
  });
  it('el último servicio es el de fecha más reciente (no el último de la lista)', () => {
    const s = [{ folio: 'A', fecha: 300 }, { folio: 'B', fecha: 900 }, { folio: 'C', fecha: 500 }];
    expect(ultimoServicio(s, Number)?.folio).toBe('B');
    expect(ultimoServicio([], Number)).toBeNull();
  });
});
