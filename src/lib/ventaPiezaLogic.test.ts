import { describe, expect, it } from 'vitest';
import {
  PIEZA_CUSTOM_MAX_LEN,
  piezasDisponibles,
  resolverVentaDeInventario,
  resolverVentaCustom,
  calcularMontoPrecargado,
  type PiezaInventarioConId,
} from './ventaPiezaLogic';

describe('piezasDisponibles', () => {
  it('excluye piezas con disponible === false', () => {
    const piezas: PiezaInventarioConId[] = [
      { id: '1', nombre: 'Puerta izquierda', disponible: true },
      { id: '2', nombre: 'Puerta derecha', disponible: false },
    ];
    expect(piezasDisponibles(piezas).map((p) => p.id)).toEqual(['1']);
  });

  it('trata disponible ausente como disponible (esquema real actual)', () => {
    const piezas: PiezaInventarioConId[] = [{ id: '1', nombre: 'Espejo' }];
    expect(piezasDisponibles(piezas)).toHaveLength(1);
  });

  it('excluye piezas con cantidad <= 0 aunque disponible no se haya marcado false', () => {
    const piezas: PiezaInventarioConId[] = [
      { id: '1', nombre: 'Birlos', cantidad: 0 },
      { id: '2', nombre: 'Tapones', cantidad: 3 },
    ];
    expect(piezasDisponibles(piezas).map((p) => p.id)).toEqual(['2']);
  });
});

describe('resolverVentaDeInventario — pieza disponible (esquema real, sin cantidad)', () => {
  it('marca disponible:false y arma la venta con partSource inventory', () => {
    const resultado = resolverVentaDeInventario({ nombre: 'Faro delantero', disponible: true }, 'pieza-1');
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) throw new Error('esperaba ok');
    expect(resultado.piezaUpdate).toEqual({ disponible: false });
    expect(resultado.ventaExtra).toEqual({
      partSource: 'inventory',
      piezaId: 'pieza-1',
      piezaVendida: 'Faro delantero',
    });
  });

  it('trata disponible ausente como disponible (default true)', () => {
    const resultado = resolverVentaDeInventario({ nombre: 'Espejo' }, 'pieza-2');
    expect(resultado.ok).toBe(true);
  });
});

describe('resolverVentaDeInventario — pieza ya vendida', () => {
  it('aborta con mensaje claro si disponible === false', () => {
    const resultado = resolverVentaDeInventario({ nombre: 'Faro delantero', disponible: false }, 'pieza-1');
    expect(resultado.ok).toBe(false);
    if (resultado.ok) throw new Error('esperaba error');
    expect(resultado.error).toContain('Faro delantero');
    expect(resultado.error).toMatch(/ya se vendió/i);
  });

  it('aborta si la pieza ya no existe (releída dentro de la transacción)', () => {
    const resultado = resolverVentaDeInventario(null, 'pieza-1');
    expect(resultado.ok).toBe(false);
    if (resultado.ok) throw new Error('esperaba error');
    expect(resultado.error).toMatch(/ya no existe/i);
  });
});

describe('resolverVentaDeInventario — cantidad (soporte a futuro, hoy sin datos reales)', () => {
  it('decrementa cantidad y NO desactiva si queda > 0', () => {
    const resultado = resolverVentaDeInventario({ nombre: 'Birlos', disponible: true, cantidad: 3 }, 'pieza-3');
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) throw new Error('esperaba ok');
    expect(resultado.piezaUpdate).toEqual({ cantidad: 2 });
  });

  it('cantidad que llega a 0 desactiva la pieza (disponible:false)', () => {
    const resultado = resolverVentaDeInventario({ nombre: 'Birlos', disponible: true, cantidad: 1 }, 'pieza-3');
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) throw new Error('esperaba ok');
    expect(resultado.piezaUpdate).toEqual({ cantidad: 0, disponible: false });
  });

  it('aborta si cantidad ya es 0', () => {
    const resultado = resolverVentaDeInventario({ nombre: 'Birlos', disponible: true, cantidad: 0 }, 'pieza-3');
    expect(resultado.ok).toBe(false);
    if (resultado.ok) throw new Error('esperaba error');
    expect(resultado.error).toMatch(/sin existencias|no tiene existencias/i);
  });
});

describe('resolverVentaCustom', () => {
  it('arma la venta con partSource custom y no toca inventario', () => {
    const resultado = resolverVentaCustom('  Rin de magnesio 17"  ');
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) throw new Error('esperaba ok');
    expect(resultado.piezaUpdate).toEqual({});
    expect(resultado.ventaExtra).toEqual({ partSource: 'custom', piezaVendida: 'Rin de magnesio 17"' });
  });

  it('rechaza texto vacío o solo espacios', () => {
    expect(resolverVentaCustom('   ').ok).toBe(false);
    expect(resolverVentaCustom('').ok).toBe(false);
  });

  it('recorta a PIEZA_CUSTOM_MAX_LEN caracteres', () => {
    const largo = 'a'.repeat(PIEZA_CUSTOM_MAX_LEN + 50);
    const resultado = resolverVentaCustom(largo);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) throw new Error('esperaba ok');
    expect(resultado.ventaExtra.piezaVendida).toHaveLength(PIEZA_CUSTOM_MAX_LEN);
  });
});

describe('calcularMontoPrecargado', () => {
  it('pieza con precio y monto vacío -> precarga el precio', () => {
    expect(calcularMontoPrecargado({ precioPieza: 1500, montoActual: '', montoPrecargadoPrevio: null }))
      .toEqual({ monto: '1500', montoPrecargado: '1500' });
  });

  it('precio con centavos', () => {
    expect(calcularMontoPrecargado({ precioPieza: 1500.5, montoActual: '', montoPrecargadoPrevio: null }).monto).toBe('1500.5');
  });

  it('pieza sin precio y monto vacío -> queda vacío como hoy', () => {
    expect(calcularMontoPrecargado({ precioPieza: undefined, montoActual: '', montoPrecargadoPrevio: null }))
      .toEqual({ monto: '', montoPrecargado: null });
  });

  it('precio inválido (0, string) se trata como sin precio', () => {
    expect(calcularMontoPrecargado({ precioPieza: 0, montoActual: '', montoPrecargadoPrevio: null }).monto).toBe('');
    expect(calcularMontoPrecargado({ precioPieza: '500', montoActual: '', montoPrecargadoPrevio: null }).monto).toBe('');
  });

  it('monto escrito a mano no se sobrescribe', () => {
    expect(calcularMontoPrecargado({ precioPieza: 1500, montoActual: '999', montoPrecargadoPrevio: null }))
      .toEqual({ monto: '999', montoPrecargado: null });
  });

  it('monto precargado sin editar se reemplaza al cambiar de pieza con precio', () => {
    expect(calcularMontoPrecargado({ precioPieza: 800, montoActual: '1500', montoPrecargadoPrevio: '1500' }))
      .toEqual({ monto: '800', montoPrecargado: '800' });
  });

  it('monto precargado sin editar se limpia al cambiar a pieza sin precio / "Otra..."', () => {
    expect(calcularMontoPrecargado({ precioPieza: null, montoActual: '1500', montoPrecargadoPrevio: '1500' }))
      .toEqual({ monto: '', montoPrecargado: null });
  });

  it('monto precargado que el usuario editó no se toca al cambiar de pieza', () => {
    expect(calcularMontoPrecargado({ precioPieza: 800, montoActual: '1400', montoPrecargadoPrevio: '1500' }))
      .toEqual({ monto: '1400', montoPrecargado: '1500' });
  });
});
