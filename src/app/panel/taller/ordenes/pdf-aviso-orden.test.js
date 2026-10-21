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
// modo 'pendiente': simula un texto con "[TEXTO LEGAL PENDIENTE]" (falla cerrada); 'listo': un texto de
// prueba corto; 'real': el texto final del archivo (textosLegalesTalleres.json).
let modo = 'pendiente';
vi.mock('../../../../lib/avisoOrden', async (original) => {
  const real = await original();
  const listo = {
    version: 'aviso-orden-2',
    aviso: [{ texto: 'Aviso de prueba' }, { texto: 'Responsable: [Nombre del taller] en [ciudad], [WhatsApp del taller].' }],
    constancia: [{ texto: 'Constancia de prueba' }, { texto: 'Recibí la unidad de la orden [folio].' }, { texto: 'Nombre y firma del cliente: ____' }],
  };
  const pendiente = { version: 'aviso-orden-2', aviso: [{ texto: '[TEXTO LEGAL PENDIENTE]' }], constancia: [{ texto: '[TEXTO LEGAL PENDIENTE]' }] };
  return {
    ...real,
    armarAvisoOrden: (t, o, v) => (modo === 'real' ? real.armarAvisoOrden(t, o, v) : real.armarAvisoOrden(t, o, v, modo === 'listo' ? listo : pendiente)),
  };
});

const { descargarPdfOrden, bytesPdfOrden, MENSAJE_SIN_AVISO } = await import('./pdf.js');
const taller = { nombre: 'Taller Peña', ciudad: 'Tijuana', whatsapp: '6641234567' };
const base = {
  folio: 'O261011-7KQ4', estado: 'recibido', creadoAt: new Date(2026, 9, 11), expiraAt: new Date(2027, 0, 7),
  vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 }, trabajos: [], piezas: [], avisoVersion: 'aviso-orden-2',
};
const deHoja = (h) => registro.textos.filter((t) => t.pagina === h).map((t) => t.texto);

beforeEach(() => { registro.textos = []; modo = 'pendiente'; });

describe('hojas de aviso y constancia en el PDF de la orden (etapa 4)', () => {
  it('con el texto final real: título de cada hoja, datos llenos, la versión una sola vez (al pie) y la firma al final', async () => {
    modo = 'real';
    await descargarPdfOrden({ orden: { ...base, cliente: { nombre: 'Juan Pérez' } }, taller });
    expect(registro.hojas).toBe(3);
    expect(deHoja(2)[0]).toBe('Versión del aviso: aviso-orden-2');
    expect(deHoja(2)).toContain('Aviso de privacidad de la orden de servicio');
    expect(deHoja(2).filter((t) => t.startsWith('Versión del aviso')).length).toBe(1);
    expect(deHoja(2)).toContain('Responsable. Taller Peña, con domicilio en Tijuana y contacto en 664 123 4567, es el responsable de los datos personales que usted proporciona para recibir su vehículo y para elaborar y dar seguimiento a la orden de servicio O261011-7KQ4.');
    expect(deHoja(3)).toContain('Constancia de recepción del vehículo');
    expect(deHoja(3)).toContain('Orden de servicio O261011-7KQ4. Fecha de recepción: 11 de octubre de 2026.');
    expect(deHoja(3).at(-1)).toBe('Nombre y firma del cliente: ______________________________ Fecha: ______________');
    expect([...deHoja(2), ...deHoja(3)].join('\n')).not.toMatch(/\[[^\]]+\]/);
  });
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
    modo = 'listo';
    await descargarPdfOrden({ orden: { ...base, cliente: { nombre: 'Juan Pérez', telefono: '664 111 2233' }, vehiculo: { ...base.vehiculo, placas: 'ABC123' } }, taller });
    expect(registro.hojas).toBe(3);
    expect(deHoja(1)).toEqual(expect.arrayContaining(['Cliente:', 'Juan Pérez', 'Teléfono:', '664 111 2233', 'Placas:', 'ABC123']));
    expect(deHoja(2)).toEqual(expect.arrayContaining(['Aviso de prueba', 'Responsable: Taller Peña en Tijuana, 664 123 4567.', 'Versión del aviso: aviso-orden-2']));
    expect(deHoja(3)).toEqual(expect.arrayContaining(['Constancia de prueba', 'Recibí la unidad de la orden O261011-7KQ4.', 'Nombre y firma del cliente: ____', 'Versión del aviso: aviso-orden-2']));
    // El pie de borrado va en las hojas de la orden, no en las legales.
    expect(deHoja(2).some((t) => t.startsWith('Esta orden se eliminará'))).toBe(false);
  });
  it('orden VIEJA (aviso-orden-0): aunque el texto esté listo, no se imprime un aviso que no se le entregó', async () => {
    modo = 'listo';
    await descargarPdfOrden({ orden: { ...base, avisoVersion: 'aviso-orden-0', cliente: {} }, taller });
    expect(registro.hojas).toBe(1);
  });
});

describe('aviso por versión: cada orden con el texto que se le entregó al cliente', () => {
  const HISTORIAL = 'Historial Digital de Servicios y recordatorios de mantenimiento.';
  const conHistorial = (h) => h.some((t) => t.startsWith(HISTORIAL));
  it('orden VIEJA (aviso-orden-1) con datos del cliente: imprime SU aviso y su constancia (sin el párrafo del historial)', async () => {
    modo = 'real';
    await descargarPdfOrden({ orden: { ...base, avisoVersion: 'aviso-orden-1', cliente: { nombre: 'Juan Pérez' } }, taller });
    expect(registro.hojas).toBe(3);
    expect(deHoja(2)[0]).toBe('Versión del aviso: aviso-orden-1');
    expect(deHoja(2)).toContain('Aviso de privacidad de la orden de servicio');
    expect(conHistorial(deHoja(2))).toBe(false);
    expect(deHoja(3)).toContain('Constancia de recepción del vehículo');
  });
  it('orden NUEVA (aviso-orden-2): imprime el aviso nuevo con el párrafo del historial', async () => {
    modo = 'real';
    await descargarPdfOrden({ orden: { ...base, avisoVersion: 'aviso-orden-2', cliente: { nombre: 'Juan Pérez' } }, taller });
    expect(deHoja(2)[0]).toBe('Versión del aviso: aviso-orden-2');
    expect(conHistorial(deHoja(2))).toBe(true);
  });
  it('"Descargar mis documentos" (.zip) usa también la versión de cada orden', async () => {
    modo = 'real';
    await bytesPdfOrden({ orden: { ...base, avisoVersion: 'aviso-orden-1', cliente: { nombre: 'Juan' } }, taller });
    expect(registro.hojas).toBe(3);
    expect(deHoja(2)[0]).toBe('Versión del aviso: aviso-orden-1');
    registro.textos = []; registro.hojas = 0;
    await bytesPdfOrden({ orden: { ...base, avisoVersion: 'aviso-orden-2', cliente: { nombre: 'Juan' } }, taller });
    expect(conHistorial(deHoja(2))).toBe(true);
  });
  it('nunca imprime un aviso que no corresponde: versión sin aviso y con datos, no genera el PDF', async () => {
    modo = 'real';
    await expect(descargarPdfOrden({ orden: { ...base, avisoVersion: 'aviso-orden-0', cliente: { nombre: 'Juan' } }, taller })).rejects.toThrow(MENSAJE_SIN_AVISO);
  });
});

