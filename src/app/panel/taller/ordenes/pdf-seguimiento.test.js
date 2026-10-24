import { describe, expect, it, vi, beforeEach } from 'vitest';

// jspdf falso: registra textos y rectángulos con su hoja y su posición.
const registro = { textos: [], rects: [], hojas: 1 };
vi.mock('jspdf', () => ({
  jsPDF: class {
    constructor() { this.pagina = 1; registro.hojas = 1; }
    text(t, x, y) { for (const s of [].concat(t)) registro.textos.push({ pagina: this.pagina, texto: String(s), y }); }
    rect(x, y, w, h, estilo) { registro.rects.push({ pagina: this.pagina, x, y, w, h, estilo }); }
    splitTextToSize(t) { return [String(t)]; }
    addPage() { registro.hojas += 1; this.pagina = registro.hojas; }
    getNumberOfPages() { return registro.hojas; }
    setPage(n) { this.pagina = n; }
    save() {}
    output() { return new ArrayBuffer(4); }
    setFont() {} setFontSize() {} setTextColor() {} setFillColor() {} setDrawColor() {} line() {}
  },
}));

const { bytesPdfOrden, descargarPdfOrden, altoBloqueSeguimiento } = await import('./pdf.js');
const { LIMITE_Y } = await import('../cotizaciones/pdf.js');
const { TITULO_SEGUIMIENTO_PDF, NOTA_SEGUIMIENTO_PDF } = await import('../../../../lib/seguimiento');
const { matrizQr, MARGEN_QR } = await import('../../../../lib/qrSeguimiento');

const LIGA = `https://www.mecanixyonkevirtual.com/seguimiento/${'Q'.repeat(40)}abc`;
const taller = { nombre: 'Taller Peña', ciudad: 'Tijuana', whatsapp: '6641234567' };
const base = {
  folio: 'O261023-ABCD', creadoAt: new Date(), expiraAt: new Date(Date.now() + 80 * 86400000), estado: 'reparacion',
  vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 }, trabajos: [], piezas: [], avisoVersion: 'aviso-orden-0',
};
const conTitulo = () => registro.textos.filter((t) => t.texto === TITULO_SEGUIMIENTO_PDF);
const negros = () => registro.rects.filter((r) => r.estilo === 'F' && r.w < 30);

beforeEach(() => { registro.textos = []; registro.rects = []; registro.hojas = 1; });

describe('PDF de la orden: bloque "Sigue tu orden en línea"', () => {
  it('con liga: título, liga, nota y el QR en la hoja de la orden; sin ninguna fecha de vencimiento en el bloque', async () => {
    await descargarPdfOrden({ orden: base, taller, ligaSeguimiento: LIGA });
    const [titulo] = conTitulo();
    expect(titulo.pagina).toBe(1);
    const textos = registro.textos.map((t) => t.texto);
    expect(textos).toContain(LIGA);
    expect(textos).toContain(NOTA_SEGUIMIENTO_PDF);
    expect(negros().length).toBeGreaterThan(100);
    expect(negros().every((r) => r.pagina === 1)).toBe(true);
  });
  it('sin liga (banderas apagadas, sin token, desactivado, vencido o lectura fallida): ni el título ni el QR; el PDF sale igual que hoy', async () => {
    await descargarPdfOrden({ orden: base, taller, ligaSeguimiento: null });
    const sinBloque = registro.textos.map((t) => t.texto);
    expect(conTitulo()).toHaveLength(0);
    expect(sinBloque).not.toContain(NOTA_SEGUIMIENTO_PDF);
    expect(negros()).toHaveLength(0);
    registro.textos = []; registro.rects = [];
    await descargarPdfOrden({ orden: base, taller });
    expect(registro.textos.map((t) => t.texto)).toEqual(sinBloque);
  });
  it('orden con aviso y constancia: el bloque solo en la hoja de la orden, nunca en las hojas legales', async () => {
    await bytesPdfOrden({ orden: { ...base, avisoVersion: 'aviso-orden-3', cliente: { nombre: 'Juan' } }, taller, ligaSeguimiento: LIGA });
    expect(registro.hojas).toBe(3);
    expect(conTitulo().map((t) => t.pagina)).toEqual([1]);
    expect(negros().every((r) => r.pagina === 1)).toBe(true);
  });
  it('orden larga: el bloque nunca se parte entre hojas (salta a la siguiente si no cabe)', async () => {
    const renglon = (i) => ({ descripcion: `Trabajo ${i}`, cantidad: 1, precioUnitario: 100 });
    const larga = { ...base, trabajos: Array.from({ length: 20 }, (_, i) => renglon(i)), piezas: Array.from({ length: 20 }, (_, i) => renglon(i)) };
    await descargarPdfOrden({ orden: larga, taller, ligaSeguimiento: LIGA });
    const [titulo] = conTitulo();
    const marco = registro.rects.find((r) => r.pagina === titulo.pagina && r.estilo === undefined && r.h > 30);
    expect(marco).toBeTruthy();
    expect(marco.y + marco.h).toBeLessThanOrEqual(LIMITE_Y + 0.001);
    expect(marco.h).toBeCloseTo(altoBloqueSeguimiento(matrizQr(LIGA), MARGEN_QR), 5);
    expect(negros().every((r) => r.pagina === titulo.pagina && r.y >= marco.y && r.y + r.h <= marco.y + marco.h + 0.001)).toBe(true);
    expect(registro.hojas).toBeGreaterThan(1);
  });
});
