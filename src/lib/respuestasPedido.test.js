import { describe, expect, it } from 'vitest';
import { TEXTO_PRECIO_A_TRATAR, formatoPesos, precioValido, textoPrecioRespuesta } from './respuestasPedido';

describe('precio de una respuesta', () => {
  it('solo un número finito mayor que 0 es precio válido', () => {
    expect(precioValido(1500)).toBe(true);
    expect(precioValido(0.5)).toBe(true);
    for (const malo of [0, -1, null, undefined, NaN, Infinity, '1500', {}]) expect(precioValido(malo)).toBe(false);
  });

  it('formato en pesos con separador de miles y hasta 2 decimales', () => {
    expect(formatoPesos(1500)).toBe('$1,500');
    expect(formatoPesos(1234.5)).toBe('$1,234.5');
    expect(formatoPesos(99.999)).toBe('$100');
  });

  it('la tiene con precio: el precio; precio a tratar o sin precio válido: "Precio a tratar" (nunca $0 ni $NaN)', () => {
    expect(textoPrecioRespuesta({ tieneLaPieza: true, precio: 2500 })).toBe('$2,500');
    expect(textoPrecioRespuesta({ tieneLaPieza: true, precioATratar: true })).toBe(TEXTO_PRECIO_A_TRATAR);
    for (const precio of [undefined, null, 0, NaN, '']) {
      const texto = textoPrecioRespuesta({ tieneLaPieza: true, precio });
      expect(texto).toBe(TEXTO_PRECIO_A_TRATAR);
      expect(texto).not.toMatch(/\$0|NaN/);
    }
  });

  it('no la tiene: nada', () => {
    expect(textoPrecioRespuesta({ tieneLaPieza: false })).toBe('');
    expect(textoPrecioRespuesta(null)).toBe('');
  });
});
