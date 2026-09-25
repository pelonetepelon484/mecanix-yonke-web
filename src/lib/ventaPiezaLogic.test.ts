import { describe, expect, it } from 'vitest';
import {
  PIEZA_CUSTOM_MAX_LEN,
  piezasDisponibles,
  resolverVentaDeInventario,
  resolverVentaCustom,
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
