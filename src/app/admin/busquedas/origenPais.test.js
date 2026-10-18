import { describe, expect, it } from 'vitest';
import { origenPorPais } from './origenPais';

describe('Origen por país', () => {
  it('el caso del panel: 341 de México y 3 de fuera sin búsquedas sin país -> 99% y 1%, nunca 131%', () => {
    const o = origenPorPais({ totalHistorico: 344, totalMx: 341, totalFueraDeMexico: 3 });
    expect(o.base).toBe(344);
    expect(o.mexico).toEqual({ valor: 341, pct: 99 });
    expect(o.fuera).toEqual({ valor: 3, pct: 1 });
    expect(o.desconocido).toEqual({ valor: 0, pct: 0 });
  });
  it('con búsquedas sin país (histórico), las tres suman la base y ninguna pasa de 100%', () => {
    const o = origenPorPais({ totalHistorico: 900, totalMx: 341, totalFueraDeMexico: 3 });
    expect(o.desconocido.valor).toBe(556);
    expect(o.mexico.valor + o.fuera.valor + o.desconocido.valor).toBe(o.base);
    for (const k of ['mexico', 'fuera', 'desconocido']) expect(o[k].pct).toBeLessThanOrEqual(100);
    expect(o.mexico.pct).toBe(38);
  });
  it('sin datos: todo en 0', () => {
    expect(origenPorPais({ totalHistorico: 0, totalMx: 0, totalFueraDeMexico: 0 }).mexico).toEqual({ valor: 0, pct: 0 });
  });
});
