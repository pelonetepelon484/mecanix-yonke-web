import { describe, expect, it } from 'vitest';
import {
  MAX_RENGLONES, MENSAJES_COTIZACION, aCentavos, formatearPesos, generarFolio, quitarDatosCliente,
  redondearCentavos, subtotalCentavos, totalCentavos, validarCotizacion, validarRenglon, type DatosCotizacion,
} from './cotizaciones';

const renglon = (extra = {}) => ({ tipo: 'manoObra' as const, descripcion: 'Cambio de balatas', cantidad: 1, precioUnitario: 500, ...extra });
const datosBase = (extra: Partial<DatosCotizacion> = {}): DatosCotizacion => ({
  cliente: { nombre: 'Juan', telefono: '6641234567' },
  vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001, placas: 'ABC123', kilometraje: 150000 },
  renglones: [renglon()],
  observaciones: '',
  vigenciaDias: 15,
  ...extra,
});

describe('montos en centavos', () => {
  it('0.1 + 0.2 da exactamente 0.30 (sin error de punto flotante)', () => {
    const total = totalCentavos([
      { cantidad: 1, precioUnitario: 0.1 },
      { cantidad: 1, precioUnitario: 0.2 },
    ]);
    expect(total).toBe(30);
    expect(formatearPesos(total)).toBe('$0.30');
  });
  it('multiplica por cantidad sin perder centavos', () => {
    expect(subtotalCentavos({ cantidad: 3, precioUnitario: 0.1 })).toBe(30);
    expect(subtotalCentavos({ cantidad: 7, precioUnitario: 19.99 })).toBe(13993);
  });
  it('redondea precios con más de dos decimales a centavos', () => {
    expect(aCentavos(19.999)).toBe(2000); // 19.999 -> 20.00
    expect(redondearCentavos(33.333)).toBe(33.33);
    expect(redondearCentavos(0.1 + 0.2)).toBe(0.3);
  });
  it('formatea con comas y dos decimales', () => {
    expect(formatearPesos(123450)).toBe('$1,234.50');
    expect(formatearPesos(0)).toBe('$0.00');
    expect(formatearPesos(5)).toBe('$0.05');
  });
  it('total de una cotización mixta (piezas y mano de obra)', () => {
    expect(totalCentavos([
      { cantidad: 2, precioUnitario: 350.5 },
      { cantidad: 1, precioUnitario: 500 },
      { cantidad: 4, precioUnitario: 0.25 },
    ])).toBe(70100 + 50000 + 100);
  });
  it('lista vacía suma cero', () => {
    expect(totalCentavos([])).toBe(0);
  });
});

describe('folio', () => {
  it('tiene formato C + AAMMDD + guion + 4 caracteres, válido para la regla', () => {
    const f = generarFolio(new Date(2026, 9, 6), () => 0);
    expect(f).toMatch(/^C\d{6}-[A-Z0-9]{4}$/);
    expect(f).toBe('C261006-AAAA');
  });
  it('usa solo caracteres que no se confunden', () => {
    const f = generarFolio(new Date(2026, 0, 1), () => 0.999);
    expect(f.slice(-4)).not.toMatch(/[IL01O]/);
  });
  it('genera folios distintos con azar distinto', () => {
    const a = generarFolio(new Date(2026, 9, 6), () => 0.1);
    const b = generarFolio(new Date(2026, 9, 6), () => 0.9);
    expect(a).not.toBe(b);
  });
});

describe('validar renglones', () => {
  it('acepta un renglón válido', () => {
    expect(validarRenglon(renglon())).toBeNull();
  });
  it('rechaza precio negativo', () => {
    expect(validarRenglon(renglon({ precioUnitario: -1 }))).toBe(MENSAJES_COTIZACION.precio);
  });
  it('rechaza precio por encima del tope', () => {
    expect(validarRenglon(renglon({ precioUnitario: 1000001 }))).toBe(MENSAJES_COTIZACION.precio);
  });
  it('rechaza cantidad cero y con decimales', () => {
    expect(validarRenglon(renglon({ cantidad: 0 }))).toBe(MENSAJES_COTIZACION.cantidad);
    expect(validarRenglon(renglon({ cantidad: 1.5 }))).toBe(MENSAJES_COTIZACION.cantidad);
  });
  it('rechaza descripción vacía o de 201 letras', () => {
    expect(validarRenglon(renglon({ descripcion: '   ' }))).toBe(MENSAJES_COTIZACION.descripcion);
    expect(validarRenglon(renglon({ descripcion: 'a'.repeat(201) }))).toBe(MENSAJES_COTIZACION.descripcion);
  });
});

describe('validar cotización completa', () => {
  it('acepta datos válidos', () => {
    expect(validarCotizacion(datosBase())).toBeNull();
  });
  it('acepta exactamente 20 renglones y rechaza 21', () => {
    expect(validarCotizacion(datosBase({ renglones: Array.from({ length: MAX_RENGLONES }, () => renglon()) }))).toBeNull();
    expect(validarCotizacion(datosBase({ renglones: Array.from({ length: MAX_RENGLONES + 1 }, () => renglon()) })))
      .toBe(MENSAJES_COTIZACION.demasiadosRenglones);
  });
  it('exige al menos un renglón', () => {
    expect(validarCotizacion(datosBase({ renglones: [] }))).toBe(MENSAJES_COTIZACION.sinRenglones);
  });
  it('acepta cliente vacío (nombre y teléfono son opcionales)', () => {
    expect(validarCotizacion(datosBase({ cliente: {} }))).toBeNull();
  });
  it('rechaza teléfono con letras y nombre demasiado largo', () => {
    expect(validarCotizacion(datosBase({ cliente: { telefono: 'abc' } }))).toBe(MENSAJES_COTIZACION.telefono);
    expect(validarCotizacion(datosBase({ cliente: { nombre: 'a'.repeat(101) } }))).toBe(MENSAJES_COTIZACION.nombreCliente);
  });
  it('rechaza año fuera de rango y vigencia fuera de 1 a 90', () => {
    expect(validarCotizacion(datosBase({ vehiculo: { marca: 'N', modelo: 'S', anio: 1800 } }))).toBe(MENSAJES_COTIZACION.anio);
    expect(validarCotizacion(datosBase({ vigenciaDias: 91 }))).toBe(MENSAJES_COTIZACION.vigencia);
    expect(validarCotizacion(datosBase({ vigenciaDias: 0 }))).toBe(MENSAJES_COTIZACION.vigencia);
  });
  it('rechaza placas de más de 12 caracteres y kilometraje fuera de rango', () => {
    expect(validarCotizacion(datosBase({ vehiculo: { marca: 'N', modelo: 'S', anio: 2000, placas: 'ABCDEFGHIJKLM' } }))).toBe(MENSAJES_COTIZACION.placas);
    expect(validarCotizacion(datosBase({ vehiculo: { marca: 'N', modelo: 'S', anio: 2000, kilometraje: -1 } }))).toBe(MENSAJES_COTIZACION.kilometraje);
    expect(validarCotizacion(datosBase({ vehiculo: { marca: 'N', modelo: 'S', anio: 2000, kilometraje: 1.5 } }))).toBe(MENSAJES_COTIZACION.kilometraje);
  });
  it('un precio vacío (NaN) no pasa como cero', () => {
    expect(validarRenglon(renglon({ precioUnitario: Number.NaN }))).toBe(MENSAJES_COTIZACION.precio);
  });
  it('rechaza observaciones de más de 1000 letras', () => {
    expect(validarCotizacion(datosBase({ observaciones: 'a'.repeat(1001) }))).toBe(MENSAJES_COTIZACION.observaciones);
  });
});

describe('quitar datos del cliente', () => {
  it('deja en blanco nombre, teléfono y placas, y conserva el resto', () => {
    const c = quitarDatosCliente({
      cliente: { nombre: 'Juan', telefono: '6641234567' },
      vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001, placas: 'ABC123', kilometraje: 150000 },
      renglones: [renglon()],
    });
    expect(c.cliente).toEqual({});
    expect(c.vehiculo).toEqual({ marca: 'Nissan', modelo: 'Sentra', anio: 2001, kilometraje: 150000 });
    expect(c.renglones).toHaveLength(1);
  });
  it('no modifica el objeto original', () => {
    const original = { cliente: { nombre: 'Ana' }, vehiculo: { marca: 'X', modelo: 'Y', anio: 2000, placas: 'P1' } };
    quitarDatosCliente(original);
    expect(original.cliente).toEqual({ nombre: 'Ana' });
    expect(original.vehiculo).toHaveProperty('placas', 'P1');
  });
});
