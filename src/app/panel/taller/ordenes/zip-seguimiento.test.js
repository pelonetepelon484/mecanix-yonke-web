import { describe, expect, it, vi } from 'vitest';
import { DescargaCancelada, ENLACES_EN_PARALELO, prepararDocumentos } from './descargaDocumentos';

const TOKEN = (i) => `T${String(i).padStart(3, '0')}`.padEnd(43, 'x');
// n órdenes: las pares v3 con token, las impares v3 sin token; más 3 de la versión anterior con token.
function ordenes(n) {
  const lista = Array.from({ length: n }, (_, i) => ({
    folio: `O${i}`, avisoVersion: 'aviso-orden-3', ...(i % 2 === 0 ? { seguimientoToken: TOKEN(i) } : {}),
  }));
  for (let i = 0; i < 3; i++) lista.push({ folio: `V${i}`, avisoVersion: 'aviso-orden-2', seguimientoToken: TOKEN(900 + i) });
  return lista;
}
function fuentes(lista, extra = {}) {
  return {
    listarOrdenes: async () => ({ items: lista, hayMas: false, cursor: null }),
    listarCotizaciones: async () => ({ items: [], hayMas: false, cursor: null }),
    leerRenglones: async () => [],
    pdfOrden: vi.fn(async () => new Uint8Array([1])),
    pdfCotizacion: async () => new Uint8Array([1]),
    pausa: async () => {},
    ...extra,
  };
}

describe('.zip: enlaces de seguimiento para el bloque del PDF', () => {
  it('lee SOLO las órdenes v3 con token (1 lectura cada una) y le pasa a cada PDF su estado', async () => {
    const lista = ordenes(24); // 12 con token v3, 12 sin token, 3 de versión anterior
    const leerEnlace = vi.fn(async (o) => ({ expiraAt: o.folio }));
    const f = fuentes(lista, { leerEnlace });
    await prepararDocumentos({ fuentes: f });
    expect(leerEnlace).toHaveBeenCalledTimes(12);
    expect(leerEnlace.mock.calls.every(([o]) => o.avisoVersion === 'aviso-orden-3' && o.seguimientoToken)).toBe(true);
    const porFolio = Object.fromEntries(f.pdfOrden.mock.calls.map(([o, e]) => [o.folio, e]));
    expect(porFolio.O0).toEqual({ datos: { expiraAt: 'O0' } });
    expect(porFolio.O1).toBeUndefined();
    expect(porFolio.V0).toBeUndefined();
  });
  it(`de ${ENLACES_EN_PARALELO} en ${ENLACES_EN_PARALELO} en paralelo, nunca más a la vez`, async () => {
    let enCurso = 0;
    let maximo = 0;
    const leerEnlace = vi.fn(async () => {
      enCurso += 1; maximo = Math.max(maximo, enCurso);
      await new Promise((r) => { setTimeout(r, 1); });
      enCurso -= 1;
      return null;
    });
    await prepararDocumentos({ fuentes: fuentes(ordenes(50), { leerEnlace }) });
    expect(leerEnlace).toHaveBeenCalledTimes(25);
    expect(maximo).toBe(ENLACES_EN_PARALELO);
  });
  it('una lectura que falla queda como { error: true } (ese PDF sale sin el bloque) y la descarga sigue', async () => {
    const leerEnlace = vi.fn(async (o) => { if (o.folio === 'O2') throw new Error('sin red'); return { ok: 1 }; });
    const f = fuentes(ordenes(4), { leerEnlace });
    const r = await prepararDocumentos({ fuentes: f });
    expect(r.total).toBe(7);
    const porFolio = Object.fromEntries(f.pdfOrden.mock.calls.map(([o, e]) => [o.folio, e]));
    expect(porFolio.O2).toEqual({ error: true });
    expect(porFolio.O0).toEqual({ datos: { ok: 1 } });
  });
  it('sin leerEnlace (banderas apagadas): CERO lecturas, igual que hoy', async () => {
    const f = fuentes(ordenes(10));
    await prepararDocumentos({ fuentes: f });
    expect(f.pdfOrden.mock.calls.every(([, e]) => e === undefined)).toBe(true);
  });
  it('cancelar entre tandas: se detiene sin leer más ni armar PDF', async () => {
    let cancelar = false;
    const leerEnlace = vi.fn(async () => { cancelar = true; return null; });
    const f = fuentes(ordenes(40), { leerEnlace });
    await expect(prepararDocumentos({ fuentes: f, cancelado: () => cancelar })).rejects.toBeInstanceOf(DescargaCancelada);
    expect(leerEnlace).toHaveBeenCalledTimes(ENLACES_EN_PARALELO);
    expect(f.pdfOrden).not.toHaveBeenCalled();
  });
});
