import { describe, expect, it } from 'vitest';
import { datosVentaPublica, idVentaPublica } from './ventasPublicas';

describe('idVentaPublica', () => {
  it('normaliza igual que /calificar: trim + mayúsculas', () => {
    expect(idVentaPublica('  vm-0925-1234 ')).toBe('VM-0925-1234');
  });
  it('sin folio usable -> null', () => {
    expect(idVentaPublica('')).toBeNull();
    expect(idVentaPublica('   ')).toBeNull();
    expect(idVentaPublica(undefined)).toBeNull();
    expect(idVentaPublica(123)).toBeNull();
  });
  it('no deja "/" (rompería la ruta del documento)', () => {
    expect(idVentaPublica('A/B')).toBe('A-B');
  });
});

describe('datosVentaPublica', () => {
  const ventaCompleta = {
    numeroPedido: 'VM-0925-1234', yonkeId: 'y1', origen: 'manual',
    piezaVendida: 'Faro delantero', vehiculo: { marca: 'Honda', modelo: 'Civic', ano: 1999, transmision: 'Manual' },
    monto: 1500, nombreCliente: 'Juan Pérez', telefonoCliente: '6641234567', fecha: new Date(),
  };

  it('copia solo los campos no personales necesarios', () => {
    expect(datosVentaPublica('v1', ventaCompleta)).toEqual({
      ventaId: 'v1', yonkeId: 'y1', piezaVendida: 'Faro delantero',
      vehiculo: { marca: 'Honda', modelo: 'Civic', ano: 1999 },
    });
  });

  it('NUNCA incluye nombre, teléfono ni monto', () => {
    const texto = JSON.stringify(datosVentaPublica('v1', ventaCompleta));
    expect(texto).not.toContain('Juan');
    expect(texto).not.toContain('6641234567');
    expect(texto).not.toContain('1500');
    expect(texto).not.toContain('nombreCliente');
    expect(texto).not.toContain('telefonoCliente');
    expect(texto).not.toContain('monto');
  });

  it('venta de motor (sin vehículo) -> vehiculo null', () => {
    expect(datosVentaPublica('v2', { yonkeId: 'y1', piezaVendida: 'Motor X', vehiculo: null })?.vehiculo).toBeNull();
  });

  it('sin yonkeId o sin id -> null (no se publica)', () => {
    expect(datosVentaPublica('v3', { piezaVendida: 'X' })).toBeNull();
    expect(datosVentaPublica('', { yonkeId: 'y1' })).toBeNull();
  });
});
