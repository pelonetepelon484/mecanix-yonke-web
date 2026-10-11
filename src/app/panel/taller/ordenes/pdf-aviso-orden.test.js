import { describe, expect, it, vi, beforeEach } from 'vitest';

// jspdf falso (mismo que pdf-orden.test.js, corto).
const registro = { textos: [], hojas: 1 };
vi.mock('jspdf', () => ({
  jsPDF: class {
    constructor() { this.pagina = 1; registro.hojas = 1; }
    text(t, x, y) { for (const s of [].concat(t)) registro.textos.push({ pagina: this.pagina, texto: String(s), y }); }
    splitTextToSize(t) { return [String(t)]; }
    addPage() { registro.hojas += 1; this.pagina = registro.hojas; }
    getNumberOfPages() { return registro.hojas; }
    setPage(n) { this.pagina = n; }
    save() {}
    output() { return new ArrayBuffer(4); }
    setFont() {} setFontSize() {} setTextColor() {} setFillColor() {} setDrawColor() {} rect() {} line() {}
  },
}));
// El aviso real todavía es "[TEXTO LEGAL PENDIENTE]"; aquí se simula el texto final para probar las hojas.
let avisoListo = false;
vi.mock('../../../../lib/avisoOrden', async (original) => {
  const real = await original();
  const listo = {
    version: 'aviso-orden-1',
    aviso: [{ texto: 'Aviso de prueba' }, { texto: 'Responsable: [Nombre del taller] en [ciudad], [WhatsApp del taller].' }],
    constancia: [{ texto: 'Constancia de prueba' }, { texto: 'Recibí la unidad de la orden [folio].' }, { texto: 'Nombre y firma del cliente: ____' }],
  };
  return { ...real, armarAvisoOrden: (t, o, v) => (avisoListo ? real.armarAvisoOrden(t, o, v, listo) : real.armarAvisoOrden(t, o, v)) };
});

const { descargarPdfOrden, MENSAJE_SIN_AVISO } = await import('./pdf.js');
const taller = { nombre: 'Taller Peña', ciudad: 'Tijuana', whatsapp: '6641234567' };
const base = {
  folio: 'O261011-7KQ4', estado: 'recibido', creadoAt: new Date(2026, 9, 11), expiraAt: new Date(2027, 0, 7),
  vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 }, trabajos: [], piezas: [], avisoVersion: 'aviso-orden-1',
};
const deHoja = (h) => registro.textos.filter((t) => t.pagina === h).map((t) => t.texto);

beforeEach(() => { registro.textos = []; avisoListo = false; });

describe('hojas de aviso y constancia en el PDF de la orden (etapa 4)', () => {
  it('con el texto PENDIENTE y datos del cliente: NO genera el PDF (falla cerrada)', async () => {
    await expect(descargarPdfOrden({ orden: { ...base, cliente: { nombre: 'Juan' } }, taller })).rejects.toThrow(MENSAJE_SIN_AVISO);
    await expect(descargarPdfOrden({ orden: { ...base, cliente: {}, vehiculo: { ...base.vehiculo, placas: 'ABC123' } }, taller })).rejects.toThrow(MENSAJE_SIN_AVISO);
  });
  it('con el texto PENDIENTE y sin datos del cliente: PDF de la orden sin hojas legales (nunca imprime el marcador)', async () => {
    await descargarPdfOrden({ orden: { ...base, cliente: {} }, taller });
    expect(registro.hojas).toBe(1);
    expect(registro.textos.map((t) => t.texto).join('\n')).not.toContain('[TEXTO LEGAL PENDIENTE]');
  });
  it('con texto final: agrega la hoja del aviso y la constancia con los datos del taller, del cliente y la versión al pie', async () => {
    avisoListo = true;
    await descargarPdfOrden({ orden: { ...base, cliente: { nombre: 'Juan Pérez', telefono: '664 111 2233' }, vehiculo: { ...base.vehiculo, placas: 'ABC123' } }, taller });
    expect(registro.hojas).toBe(3);
    expect(deHoja(1)).toEqual(expect.arrayContaining(['Cliente:', 'Juan Pérez', 'Teléfono:', '664 111 2233', 'Placas:', 'ABC123']));
    expect(deHoja(2)).toEqual(expect.arrayContaining(['Aviso de prueba', 'Responsable: Taller Peña en Tijuana, 664 123 4567.', 'Versión del aviso: aviso-orden-1']));
    expect(deHoja(3)).toEqual(expect.arrayContaining(['Constancia de prueba', 'Recibí la unidad de la orden O261011-7KQ4.', 'Nombre y firma del cliente: ____', 'Versión del aviso: aviso-orden-1']));
    // El pie de borrado va en las hojas de la orden, no en las legales.
    expect(deHoja(2).some((t) => t.startsWith('Esta orden se eliminará'))).toBe(false);
  });
  it('orden VIEJA (aviso-orden-0): aunque el texto esté listo, no se imprime un aviso que no se le entregó', async () => {
    avisoListo = true;
    await descargarPdfOrden({ orden: { ...base, avisoVersion: 'aviso-orden-0', cliente: {} }, taller });
    expect(registro.hojas).toBe(1);
  });
});
