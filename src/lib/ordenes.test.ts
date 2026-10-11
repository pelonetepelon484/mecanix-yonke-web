import { describe, expect, it } from 'vitest';
import {
  ADVERTENCIA_VEHICULO, DIAS_RETENCION_ORDEN, ESTADOS_ORDEN, MENSAJES_ORDEN, NOMBRE_ESTADO_ORDEN, expiraEntregada, expiraSinEntregar,
  fechaBorradoPrevista, generarFolioOrden, leerItems, planBorrado, textoPlano, totalOrdenCentavos, validarItem, validarOrden,
  type DatosOrden,
} from './ordenes';

const DIA = 86400000;
const base = (extra: Partial<DatosOrden> = {}): DatosOrden => ({
  vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001, kilometraje: 150000 },
  fallaReportada: 'Ruido al frenar', observaciones: '', estadoRecepcion: '', pertenencias: '',
  trabajos: [{ descripcion: 'Cambio de balatas', cantidad: 1, precioUnitario: 500 }],
  piezas: [{ descripcion: 'Balatas', cantidad: 2, precioUnitario: 350.5 }],
  estado: 'recibido',
  ...extra,
});

describe('folio', () => {
  it('"O" + AAMMDD + "-" + 4 caracteres', () => {
    expect(generarFolioOrden(new Date(2025, 9, 11), () => 0)).toBe('O251011-AAAA');
    expect(generarFolioOrden(new Date())).toMatch(/^O[0-9]{6}-[A-Z0-9]{4}$/);
  });
});

describe('estados', () => {
  it('seis estados con nombre en español', () => {
    expect(ESTADOS_ORDEN).toEqual(['recibido', 'diagnostico', 'esperandoPiezas', 'reparacion', 'listo', 'entregado']);
    expect(Object.values(NOMBRE_ESTADO_ORDEN)).toEqual(['Recibido', 'En diagnóstico', 'Esperando piezas', 'En reparación', 'Listo', 'Entregado']);
  });
});

describe('validación de cada renglón (la hace la app; las reglas no la repiten)', () => {
  it('descripción 1-200, cantidad entera 1-999, precio 0-1,000,000', () => {
    expect(validarItem({ descripcion: 'x', cantidad: 1, precioUnitario: 0 })).toBeNull();
    expect(validarItem({ descripcion: 'x'.repeat(200), cantidad: 999, precioUnitario: 1000000 })).toBeNull();
    expect(validarItem({ descripcion: '', cantidad: 1, precioUnitario: 1 })).toBe(MENSAJES_ORDEN.descripcion);
    expect(validarItem({ descripcion: '   ', cantidad: 1, precioUnitario: 1 })).toBe(MENSAJES_ORDEN.descripcion);
    expect(validarItem({ descripcion: 'x'.repeat(201), cantidad: 1, precioUnitario: 1 })).toBe(MENSAJES_ORDEN.descripcion);
    expect(validarItem({ descripcion: 'x', cantidad: 0, precioUnitario: 1 })).toBe(MENSAJES_ORDEN.cantidad);
    expect(validarItem({ descripcion: 'x', cantidad: 1000, precioUnitario: 1 })).toBe(MENSAJES_ORDEN.cantidad);
    expect(validarItem({ descripcion: 'x', cantidad: 1.5, precioUnitario: 1 })).toBe(MENSAJES_ORDEN.cantidad);
    expect(validarItem({ descripcion: 'x', cantidad: 1, precioUnitario: -1 })).toBe(MENSAJES_ORDEN.precio);
    expect(validarItem({ descripcion: 'x', cantidad: 1, precioUnitario: 1000001 })).toBe(MENSAJES_ORDEN.precio);
    expect(validarItem({ descripcion: 'x', cantidad: 1, precioUnitario: Number.NaN })).toBe(MENSAJES_ORDEN.precio);
  });
  it('validarOrden revisa cada trabajo y cada pieza, y el máximo de 20', () => {
    expect(validarOrden(base())).toBeNull();
    expect(validarOrden(base({ trabajos: [], piezas: [] }))).toBeNull();
    expect(validarOrden(base({ piezas: [{ descripcion: 'x', cantidad: 0, precioUnitario: 1 }] }))).toBe(MENSAJES_ORDEN.cantidad);
    const veintiuno = Array.from({ length: 21 }, () => ({ descripcion: 'x', cantidad: 1, precioUnitario: 1 }));
    expect(validarOrden(base({ trabajos: veintiuno }))).toBe(MENSAJES_ORDEN.demasiadosTrabajos);
    expect(validarOrden(base({ piezas: veintiuno }))).toBe(MENSAJES_ORDEN.demasiadasPiezas);
  });
});

describe('validación de la orden', () => {
  it('vehículo, año y kilometraje', () => {
    expect(validarOrden(base({ vehiculo: { marca: '', modelo: 'Sentra', anio: 2001 } }))).toBe(MENSAJES_ORDEN.vehiculo);
    expect(validarOrden(base({ vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 1949 } }))).toBe(MENSAJES_ORDEN.anio);
    expect(validarOrden(base({ vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001, kilometraje: -1 } }))).toBe(MENSAJES_ORDEN.kilometraje);
  });
  it('textos: falla y observaciones 1000; estado al recibirlo y pertenencias 500', () => {
    expect(validarOrden(base({ fallaReportada: 'x'.repeat(1000), observaciones: 'x'.repeat(1000), estadoRecepcion: 'x'.repeat(500), pertenencias: 'x'.repeat(500) }))).toBeNull();
    expect(validarOrden(base({ fallaReportada: 'x'.repeat(1001) }))).toBe(MENSAJES_ORDEN.falla);
    expect(validarOrden(base({ observaciones: 'x'.repeat(1001) }))).toBe(MENSAJES_ORDEN.observaciones);
    expect(validarOrden(base({ estadoRecepcion: 'x'.repeat(501) }))).toBe(MENSAJES_ORDEN.estadoRecepcion);
    expect(validarOrden(base({ pertenencias: 'x'.repeat(501) }))).toBe(MENSAJES_ORDEN.pertenencias);
  });
  it('entregada exige garantía entera de 0 a 365', () => {
    expect(validarOrden(base({ estado: 'entregado' }))).toBe(MENSAJES_ORDEN.garantia);
    expect(validarOrden(base({ estado: 'entregado', garantiaDias: -1 }))).toBe(MENSAJES_ORDEN.garantia);
    expect(validarOrden(base({ estado: 'entregado', garantiaDias: 366 }))).toBe(MENSAJES_ORDEN.garantia);
    expect(validarOrden(base({ estado: 'entregado', garantiaDias: 1.5 }))).toBe(MENSAJES_ORDEN.garantia);
    expect(validarOrden(base({ estado: 'entregado', garantiaDias: 0 }))).toBeNull();
    expect(validarOrden(base({ estado: 'entregado', garantiaDias: 365 }))).toBeNull();
  });
  it('la advertencia de los campos de texto libre', () => {
    expect(ADVERTENCIA_VEHICULO).toBe('Solo información del vehículo. No escribas nombres, teléfonos ni datos personales.');
  });
});

describe('dinero', () => {
  it('subtotal en centavos sin IVA: trabajos + piezas', () => {
    expect(totalOrdenCentavos(base())).toBe(50000 + 70100);
    expect(totalOrdenCentavos({ trabajos: [], piezas: [] })).toBe(0);
  });
});

describe('fecha de borrado', () => {
  const ahora = new Date('2026-10-11T18:00:00Z');
  const entrega = new Date('2026-10-01T18:00:00Z');
  it('sin entregar: hoy + 88 días, siempre (también al regresar de entregada)', () => {
    expect(DIAS_RETENCION_ORDEN).toBe(88);
    expect(planBorrado(null, 'recibido', undefined, ahora)).toEqual({ fechaEntrega: null, expiraAt: expiraSinEntregar(ahora) });
    const entregada = { estado: 'entregado', garantiaDias: 30, fechaEntrega: entrega, expiraAt: expiraEntregada(entrega, 30) };
    expect(planBorrado(entregada, 'reparacion', undefined, ahora)).toEqual({ fechaEntrega: null, expiraAt: new Date(ahora.getTime() + 88 * DIA) });
  });
  it('se entrega ahora: fecha de entrega del servidor y borrado = hoy + garantía + 8', () => {
    expect(planBorrado({ estado: 'listo' }, 'entregado', 30, ahora)).toEqual({ fechaEntrega: 'servidor', expiraAt: new Date(ahora.getTime() + 38 * DIA) });
    expect(planBorrado(null, 'entregado', 0, ahora).expiraAt).toEqual(new Date(ahora.getTime() + 8 * DIA));
  });
  it('ya entregada: sin cambiar la garantía no se mueve nada', () => {
    const exp = expiraEntregada(entrega, 30);
    expect(planBorrado({ estado: 'entregado', garantiaDias: 30, fechaEntrega: entrega, expiraAt: exp }, 'entregado', 30, ahora)).toEqual({ fechaEntrega: entrega, expiraAt: exp });
  });
  it('ya entregada: con otra garantía, se recalcula desde la MISMA fecha de entrega', () => {
    const ts = { toDate: () => entrega };
    const r = planBorrado({ estado: 'entregado', garantiaDias: 30, fechaEntrega: ts, expiraAt: expiraEntregada(entrega, 30) }, 'entregado', 60, ahora);
    expect(r.fechaEntrega).toBe(ts);
    expect(r.expiraAt).toEqual(new Date(entrega.getTime() + 68 * DIA));
  });
  it('fecha prevista para mostrar antes de guardar (null si falta la garantía)', () => {
    expect(fechaBorradoPrevista(null, 'recibido', undefined, ahora)).toEqual(new Date(ahora.getTime() + 88 * DIA));
    expect(fechaBorradoPrevista(null, 'entregado', undefined, ahora)).toBeNull();
    expect(fechaBorradoPrevista(null, 'entregado', 15, ahora)).toEqual(new Date(ahora.getTime() + 23 * DIA));
  });
});

describe('lectura tolerante (texto plano)', () => {
  it('renglones mal formados no rompen nada', () => {
    expect(leerItems(undefined)).toEqual([]);
    expect(leerItems('basura')).toEqual([]);
    expect(leerItems([null, 5, { descripcion: { html: '<b>' }, cantidad: 'x', precioUnitario: null }])).toEqual([
      { descripcion: '', cantidad: 1, precioUnitario: 0 },
      { descripcion: '', cantidad: 1, precioUnitario: 0 },
      { descripcion: '', cantidad: 1, precioUnitario: 0 },
    ]);
    expect(leerItems(Array.from({ length: 30 }, () => ({ descripcion: 'x', cantidad: 1, precioUnitario: 1 })))).toHaveLength(20);
  });
  it('el texto se queda como texto (el HTML no se interpreta) y sin caracteres de control', () => {
    expect(textoPlano('<img src=x onerror=alert(1)>')).toBe('<img src=x onerror=alert(1)>');
    expect(textoPlano('a\u0000b\u0007c\nd')).toBe('abc\nd');
    expect(textoPlano('x'.repeat(300), 200)).toHaveLength(200);
    expect(textoPlano(null)).toBe('');
  });
});
