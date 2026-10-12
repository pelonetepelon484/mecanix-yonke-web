import { describe, expect, it, vi } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import {
  DescargaCancelada, DescargaExcedeTope, MENSAJES_DESCARGA, TOPE_DOCUMENTOS, nombreArchivo, nombreZip, prepararDocumentos, textoAvisoCotizaciones, textoProgreso,
} from './descargaDocumentos';

// Listas falsas paginadas de 20 en 20 (como las de verdad) que cuentan cuántas páginas se pidieron.
function paginada(items) {
  const fn = vi.fn(async ({ cursor }) => {
    const desde = cursor ?? 0;
    const pagina = items.slice(desde, desde + 20);
    return { items: pagina, cursor: desde + pagina.length, hayMas: pagina.length === 20 };
  });
  return fn;
}
const ordenes = (n) => Array.from({ length: n }, (_, i) => ({ folio: `O261011-${String(i).padStart(4, '0')}` }));
const cotizaciones = (n, pre = 'A') => Array.from({ length: n }, (_, i) => ({ folio: `C261011-${pre}${String(i).padStart(3, '0')}` }));

function fuentes({ nOrdenes = 3, nActivas = 2, nArchivadas = 1 } = {}) {
  const activas = cotizaciones(nActivas, 'A');
  const archivadas = cotizaciones(nArchivadas, 'Z');
  const listarActivas = paginada(activas);
  const listarArchivadas = paginada(archivadas);
  return {
    listarOrdenes: paginada(ordenes(nOrdenes)),
    listarCotizaciones: vi.fn((o) => (o.archivada ? listarArchivadas(o) : listarActivas(o))),
    leerRenglones: vi.fn(async (folio) => [{ numero: 0, tipo: 'pieza', descripcion: `renglón de ${folio}`, cantidad: 1, precioUnitario: 1 }]),
    pdfOrden: vi.fn(async (o) => new TextEncoder().encode(`PDF ${o.folio}`)),
    pdfCotizacion: vi.fn(async (c) => new TextEncoder().encode(`PDF ${c.folio} ${c.renglones.length}`)),
    pausa: async () => {},
  };
}

describe('Descargar mis documentos (.zip)', () => {
  it('un solo .zip con órdenes, cotizaciones activas y archivadas, con nombres claros', async () => {
    const f = fuentes();
    const r = await prepararDocumentos({ fuentes: f });
    expect(r.total).toBe(6);
    const contenido = unzipSync(r.bytes);
    expect(Object.keys(contenido).sort()).toEqual([
      'cotizacion-C261011-A000.pdf', 'cotizacion-C261011-A001.pdf', 'cotizacion-C261011-Z000.pdf',
      'orden-O261011-0000.pdf', 'orden-O261011-0001.pdf', 'orden-O261011-0002.pdf',
    ]);
    expect(strFromU8(contenido['cotizacion-C261011-A000.pdf'])).toBe('PDF C261011-A000 1');
    expect(f.listarCotizaciones).toHaveBeenCalledWith(expect.objectContaining({ archivada: true }));
    expect(r.nombre).toMatch(/^documentos-mecanix-\d{4}-\d{2}-\d{2}\.zip$/);
  });
  it('lee en tandas de 20: 45 órdenes = 3 páginas', async () => {
    const f = fuentes({ nOrdenes: 45, nActivas: 0, nArchivadas: 0 });
    await prepararDocumentos({ fuentes: f });
    expect(f.listarOrdenes).toHaveBeenCalledTimes(3);
  });
  it('avisa el avance: "Preparando N de M…"', async () => {
    const avance = [];
    await prepararDocumentos({ fuentes: fuentes(), onProgreso: (h, t) => avance.push(textoProgreso(h, t)) });
    expect(avance[0]).toBe('Preparando 0 de 6…');
    expect(avance.at(-1)).toBe('Preparando 6 de 6…');
  });
  it(`tope de ${TOPE_DOCUMENTOS}: con más, no arma nada y deja de leer en cuanto se pasa`, async () => {
    const f = fuentes({ nOrdenes: 150, nActivas: 60, nArchivadas: 10 });
    await expect(prepararDocumentos({ fuentes: f })).rejects.toBeInstanceOf(DescargaExcedeTope);
    expect(f.pdfOrden).not.toHaveBeenCalled();
    expect(f.pdfCotizacion).not.toHaveBeenCalled();
    expect(f.listarCotizaciones).not.toHaveBeenCalledWith(expect.objectContaining({ archivada: true }));
    expect(new DescargaExcedeTope().message).toBe(MENSAJES_DESCARGA.tope);
  });
  it('exactamente 200 sí se descarga', async () => {
    const r = await prepararDocumentos({ fuentes: fuentes({ nOrdenes: 200, nActivas: 0, nArchivadas: 0 }) });
    expect(r.total).toBe(200);
  });
  it('se puede cancelar a la mitad: no se arma ni se descarga nada', async () => {
    const f = fuentes({ nOrdenes: 10, nActivas: 0, nArchivadas: 0 });
    let cancelar = false;
    const promesa = prepararDocumentos({ fuentes: f, cancelado: () => cancelar, onProgreso: (h) => { if (h === 4) cancelar = true; } });
    await expect(promesa).rejects.toBeInstanceOf(DescargaCancelada);
    expect(f.pdfOrden.mock.calls.length).toBe(4);
  });
  it('sin documentos: no hay .zip', async () => {
    const r = await prepararDocumentos({ fuentes: fuentes({ nOrdenes: 0, nActivas: 0, nArchivadas: 0 }) });
    expect(r).toEqual({ bytes: null, nombre: null, total: 0, omitidas: [], sinAviso: [] });
  });
  it('nombres de archivo seguros', () => {
    expect(nombreArchivo('orden', 'O261011-7KQ4')).toBe('orden-O261011-7KQ4.pdf');
    expect(nombreArchivo('cotizacion', 'C261011-AB12')).toBe('cotizacion-C261011-AB12.pdf');
    expect(nombreArchivo('orden', '../../x')).toBe('orden-x.pdf');
    expect(nombreZip(new Date(2026, 9, 11))).toBe('documentos-mecanix-2026-10-11.zip');
  });

  it('cotización con datos del cliente y sin aviso: queda fuera del .zip y se dice cuál', async () => {
    const f = fuentes({ nOrdenes: 1, nActivas: 2, nArchivadas: 0 });
    f.pdfCotizacion = vi.fn(async (c) => {
      if (c.folio === 'C261011-A001') throw Object.assign(new Error('sin aviso'), { name: 'CotizacionSinAviso', folio: c.folio });
      return new TextEncoder().encode(`PDF ${c.folio}`);
    });
    const r = await prepararDocumentos({ fuentes: f });
    expect(Object.keys(unzipSync(r.bytes)).sort()).toEqual(['cotizacion-C261011-A000.pdf', 'orden-O261011-0000.pdf']);
    expect(r.total).toBe(2);
    expect(r.omitidas).toEqual(['C261011-A001']);
    expect(textoAvisoCotizaciones(r)).toBe('No se incluyeron porque tienen datos del cliente y no encontramos el texto de su aviso de privacidad: C261011-A001. Escríbenos.');
  });
  it('cotización sin datos del cliente y sin aviso: entra al .zip y se dice que va sin la hoja del aviso', async () => {
    const f = { ...fuentes({ nOrdenes: 0, nActivas: 2, nArchivadas: 0 }), tieneAviso: (c) => c.folio !== 'C261011-A000' };
    const r = await prepararDocumentos({ fuentes: f });
    expect(r.total).toBe(2);
    expect(r.sinAviso).toEqual(['C261011-A000']);
    expect(textoAvisoCotizaciones(r)).toBe('Salieron sin la hoja del aviso de privacidad porque no encontramos el texto de su versión: C261011-A000.');
  });
  it('si TODAS se quedan fuera, no hay .zip pero sí se dice cuáles', async () => {
    const f = fuentes({ nOrdenes: 0, nActivas: 1, nArchivadas: 0 });
    f.pdfCotizacion = vi.fn(async () => { throw Object.assign(new Error('x'), { name: 'CotizacionSinAviso' }); });
    const r = await prepararDocumentos({ fuentes: f });
    expect(r).toEqual({ bytes: null, nombre: null, total: 0, omitidas: ['C261011-A000'], sinAviso: [] });
  });
  it('cualquier otro error al armar una cotización sigue deteniendo la descarga', async () => {
    const f = fuentes({ nOrdenes: 0, nActivas: 1, nArchivadas: 0 });
    f.pdfCotizacion = vi.fn(async () => { throw new Error('jsPDF falló'); });
    await expect(prepararDocumentos({ fuentes: f })).rejects.toThrow('jsPDF falló');
  });
  it('sin cotizaciones con problemas, no hay aviso extra', () => {
    expect(textoAvisoCotizaciones({ omitidas: [], sinAviso: [] })).toBe('');
  });
});

