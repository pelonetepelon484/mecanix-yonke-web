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
