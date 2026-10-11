import { describe, expect, it } from 'vitest';
import {
  MENSAJES_CONVERSION, MENSAJES_ORDEN, cotizacionTieneDatosCliente, mensajeConfirmarConversion, ordenDesdeCotizacion, totalOrdenCentavos,
  validarConversion,
} from './ordenes';

const cot = (extra = {}) => ({
  cliente: {},
  vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001, kilometraje: 150000 },
  observaciones: 'Golpe en la defensa',
  renglones: [
    { numero: 0, tipo: 'pieza', descripcion: 'Balatas', cantidad: 2, precioUnitario: 350.5, expiraAt: 'X' },
    { numero: 1, tipo: 'manoObra', descripcion: 'Cambio de balatas', cantidad: 1, precioUnitario: 500 },
    { numero: 2, tipo: 'pieza', descripcion: 'Disco', cantidad: 1, precioUnitario: 1200 },
  ],
  ...extra,
});

describe('convertir una cotización en orden', () => {
  it('copia vehículo y observaciones; piezas a "piezas" y mano de obra a "trabajos"; nace "recibido"', () => {
    expect(ordenDesdeCotizacion(cot())).toEqual({
      vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001, kilometraje: 150000 },
      fallaReportada: '', observaciones: 'Golpe en la defensa', estadoRecepcion: '', pertenencias: '',
      trabajos: [{ descripcion: 'Cambio de balatas', cantidad: 1, precioUnitario: 500 }],
      piezas: [{ descripcion: 'Balatas', cantidad: 2, precioUnitario: 350.5 }, { descripcion: 'Disco', cantidad: 1, precioUnitario: 1200 }],
      estado: 'recibido',
    });
  });
  it('total en centavos igual al de la cotización (sin IVA)', () => {
    expect(totalOrdenCentavos(ordenDesdeCotizacion(cot()))).toBe(70100 + 50000 + 120000);
  });
  it('NO copia nombre, teléfono ni placas; tampoco ningún dato que apunte a la cotización', () => {
    const datos = ordenDesdeCotizacion(cot({
      cliente: { nombre: 'Juan Pérez', telefono: '6641112233' },
      vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001, placas: 'ABC123' },
      folio: 'C251011-AAAA',
    }));
    const texto = JSON.stringify(datos);
    for (const prohibido of ['Juan', '6641112233', 'ABC123', 'C251011', 'placas', 'cliente', 'folio', 'cotizacion']) expect(texto).not.toContain(prohibido);
    expect('kilometraje' in datos.vehiculo).toBe(false);
  });
  it('se puede convertir una cotización válida', () => {
    expect(validarConversion(cot())).toBeNull();
  });
  it('más de 20 piezas o de 20 trabajos: se rechaza con mensaje claro', () => {
    const muchas = Array.from({ length: 21 }, (_, i) => ({ numero: i, tipo: 'pieza', descripcion: 'x', cantidad: 1, precioUnitario: 1 }));
    expect(validarConversion(cot({ renglones: muchas }))).toBe(MENSAJES_CONVERSION.demasiados);
    const muchos = muchas.map((r) => ({ ...r, tipo: 'manoObra' }));
    expect(validarConversion(cot({ renglones: muchos }))).toBe(MENSAJES_CONVERSION.demasiados);
  });
  it('si algún dato no cuadra con una orden válida, lo dice', () => {
    expect(validarConversion(cot({ vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 1900 } }))).toBe(MENSAJES_ORDEN.anio);
    expect(validarConversion(cot({ renglones: [{ tipo: 'pieza', descripcion: '', cantidad: 1, precioUnitario: 1 }] }))).toBe(MENSAJES_ORDEN.descripcion);
  });
});

describe('texto de la confirmación', () => {
  it('sin datos del cliente: exactamente la frase de siempre', () => {
    expect(cotizacionTieneDatosCliente(cot())).toBe(false);
    expect(mensajeConfirmarConversion(cot())).toBe('Se creará una orden de servicio y esta cotización se eliminará. ¿Continuar?');
    expect(mensajeConfirmarConversion(cot({ cliente: { nombre: '   ' } }))).toBe(MENSAJES_CONVERSION.confirmar);
  });
  it('con nombre, teléfono o placas: agrega la segunda línea', () => {
    const dos = 'Se creará una orden de servicio y esta cotización se eliminará. ¿Continuar?\n'
      + 'Los datos del cliente (nombre, teléfono y placas) no pasan a la orden y se perderán al eliminar la cotización. Si los necesitas, anótalos antes.';
    expect(mensajeConfirmarConversion(cot({ cliente: { nombre: 'Juan' } }))).toBe(dos);
    expect(mensajeConfirmarConversion(cot({ cliente: { telefono: '6641112233' } }))).toBe(dos);
    expect(mensajeConfirmarConversion(cot({ vehiculo: { marca: 'N', modelo: 'S', anio: 2001, placas: 'ABC123' } }))).toBe(dos);
  });
});
