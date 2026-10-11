import { describe, expect, it } from 'vitest';
import { unzipSync, zipSync } from 'fflate';

// Con el jsPDF REAL (sin dobles): el caso máximo se genera sin romperse, en varias hojas.
const { bytesPdfOrden } = await import('./pdf.js');
const { bytesPdfCotizacion } = await import('../cotizaciones/pdf.js');

const largo = (n) => 'Texto largo con acentos áéíóú y ñ '.repeat(Math.ceil(n / 34)).slice(0, n);
const veinte = (nombre) => Array.from({ length: 20 }, (_, i) => ({ descripcion: `${nombre} ${i + 1} ${largo(180)} 🔧`, cantidad: 999, precioUnitario: 1000000 }));
const orden = {
  folio: 'O261011-7KQ4', creadoAt: new Date(), expiraAt: new Date(Date.now() + 30 * 86400000), estado: 'entregado',
  fechaEntrega: new Date(), garantiaDias: 30, vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001, kilometraje: 150000 },
  fallaReportada: largo(1000), estadoRecepcion: largo(500), pertenencias: largo(500), observaciones: `${largo(990)} 😀`,
  trabajos: veinte('Trabajo'), piezas: veinte('Pieza'),
};
const taller = { nombre: 'Taller Peña ⭐', ciudad: 'Tijuana', whatsapp: '6641234567' };
const texto = (bytes) => new TextDecoder('latin1').decode(bytes);

describe('PDF real (jsPDF de verdad)', () => {
  it('orden con 20 trabajos, 20 piezas y textos largos: PDF válido de varias hojas', async () => {
    const bytes = await bytesPdfOrden({ orden, taller });
    const pdf = texto(bytes);
    expect(pdf.startsWith('%PDF-')).toBe(true);
    const hojas = (pdf.match(/\/Type \/Page\b/g) || []).length;
    expect(hojas).toBeGreaterThan(3);
    expect(bytes.length).toBeLessThan(400 * 1024);
  });
  it('cotización real con su hoja de aviso, y ambos caben en un .zip', async () => {
    const cotizacion = {
      folio: 'C261011-AB12', creadoAt: new Date(), vigenciaDias: 15, cliente: { nombre: 'Ana 😀' }, vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 },
      observaciones: 'ok', renglones: [{ tipo: 'pieza', descripcion: 'Balata', cantidad: 1, precioUnitario: 100 }],
    };
    const bytesCot = await bytesPdfCotizacion({ cotizacion, taller });
    expect(texto(bytesCot).startsWith('%PDF-')).toBe(true);
    const zip = zipSync({ 'cotizacion-C261011-AB12.pdf': bytesCot, 'orden-O261011-7KQ4.pdf': await bytesPdfOrden({ orden, taller }) }, { level: 1 });
    expect(Object.keys(unzipSync(zip)).sort()).toEqual(['cotizacion-C261011-AB12.pdf', 'orden-O261011-7KQ4.pdf']);
  });
});
