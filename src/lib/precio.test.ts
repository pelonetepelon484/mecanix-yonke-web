import { describe, expect, it } from 'vitest';
import { PRECIO_MAX, elegirPiezaParaPrecio, esPrecioValido, formatPrecio, parsePrecio } from './precio';

function valor(input: unknown) {
  const r = parsePrecio(input);
  if (!r.ok) throw new Error(`esperaba ok, error: ${r.error}`);
  return r.value;
}
function error(input: unknown) {
  const r = parsePrecio(input);
  if (r.ok) throw new Error(`esperaba error, value: ${r.value}`);
  return r.error;
}

describe('parsePrecio', () => {
  it('vacío, espacios, null y undefined -> null (no se guarda nada)', () => {
    expect(valor('')).toBeNull();
    expect(valor('   ')).toBeNull();
    expect(valor(null)).toBeNull();
    expect(valor(undefined)).toBeNull();
  });

  it('números enteros y con decimales', () => {
    expect(valor('1500')).toBe(1500);
    expect(valor('  1500  ')).toBe(1500);
    expect(valor('1500.5')).toBe(1500.5);
    expect(valor('1500.50')).toBe(1500.5);
    expect(valor('0.5')).toBe(0.5);
    expect(valor(1500)).toBe(1500);
  });

  it('coma decimal', () => {
    expect(valor('12,5')).toBe(12.5);
    expect(valor('1234,56')).toBe(1234.56);
  });

  it('coma con exactamente 3 dígitos es separador de miles', () => {
    expect(valor('1,234')).toBe(1234);
    expect(valor('1,234,567')).toBe(1234567);
    expect(valor('10,123')).toBe(10123);
    expect(valor('1,234.50')).toBe(1234.5);
  });

  it('acepta "$" inicial', () => {
    expect(valor('$1500')).toBe(1500);
    expect(valor('$ 1,500')).toBe(1500);
  });

  it('negativo -> error', () => {
    expect(error('-100')).toMatch(/mayor a 0/);
    expect(error(-5)).toMatch(/mayor a 0/);
  });

  it('cero -> error (nunca se guarda 0)', () => {
    expect(error('0')).toMatch(/mayor a 0/);
    expect(error('0.00')).toMatch(/mayor a 0/);
    expect(error(0)).toMatch(/mayor a 0/);
  });

  it('texto -> error', () => {
    expect(error('abc')).toMatch(/solo números/);
    expect(error('12abc')).toMatch(/solo números/);
    expect(error('1.2.3')).toMatch(/solo números/);
    expect(error('1e5')).toMatch(/solo números/);
    expect(error('.')).toMatch(/solo números/);
    expect(error({})).toMatch(/solo números/);
    expect(error(NaN)).toMatch(/solo números/);
  });

  it('máximo 9,999,999 (inclusive)', () => {
    expect(valor('9999999')).toBe(PRECIO_MAX);
    expect(valor('9999999.00')).toBe(PRECIO_MAX);
    expect(error('10000000')).toMatch(/máximo/);
    expect(error('9999999.01')).toMatch(/máximo/);
  });

  it('más de 2 decimales -> error', () => {
    expect(error('10.123')).toMatch(/2 decimales/);
    expect(error('1.500')).toMatch(/2 decimales/);
    expect(error('12,345678')).toMatch(/2 decimales/);
  });
});

describe('esPrecioValido', () => {
  it('solo number finito, > 0 y <= máximo', () => {
    expect(esPrecioValido(1)).toBe(true);
    expect(esPrecioValido(PRECIO_MAX)).toBe(true);
    expect(esPrecioValido(0)).toBe(false);
    expect(esPrecioValido(-1)).toBe(false);
    expect(esPrecioValido('100')).toBe(false);
    expect(esPrecioValido(null)).toBe(false);
    expect(esPrecioValido(undefined)).toBe(false);
    expect(esPrecioValido(NaN)).toBe(false);
    expect(esPrecioValido(PRECIO_MAX + 1)).toBe(false);
  });
});

describe('formatPrecio', () => {
  it('formatea con miles y sufijo MXN', () => {
    expect(formatPrecio(1234)).toBe('$1,234 MXN');
    expect(formatPrecio(500)).toBe('$500 MXN');
    expect(formatPrecio(9999999)).toBe('$9,999,999 MXN');
  });
  it('muestra centavos solo cuando existen', () => {
    expect(formatPrecio(1234.5)).toBe('$1,234.50 MXN');
    expect(formatPrecio(0.5)).toBe('$0.50 MXN');
  });
});

describe('elegirPiezaParaPrecio', () => {
  it('sin coincidencias -> null', () => {
    expect(elegirPiezaParaPrecio([])).toBeNull();
  });
  it('una con precio', () => {
    expect(elegirPiezaParaPrecio([{ nombre: 'Cofre', precio: 800 }])).toEqual({ nombre: 'Cofre', precio: 800 });
  });
  it('una sin precio -> precio null', () => {
    expect(elegirPiezaParaPrecio([{ nombre: 'Cofre' }])).toEqual({ nombre: 'Cofre', precio: null });
  });
  it('varias: gana la de menor precio entre las que tienen', () => {
    const r = elegirPiezaParaPrecio([
      { nombre: 'Parachoques trasero', precio: 900 },
      { nombre: 'Parachoques delantero' },
      { nombre: 'Parachoques lateral', precio: 500 },
    ]);
    expect(r).toEqual({ nombre: 'Parachoques lateral', precio: 500 });
  });
  it('varias sin ningún precio válido -> la primera, precio null', () => {
    const r = elegirPiezaParaPrecio([{ nombre: 'A', precio: 0 }, { nombre: 'B', precio: '100' }]);
    expect(r).toEqual({ nombre: 'A', precio: null });
  });
});
