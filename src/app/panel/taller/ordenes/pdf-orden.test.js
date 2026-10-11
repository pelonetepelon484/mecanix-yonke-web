import { describe, expect, it, vi, beforeEach } from 'vitest';

// jspdf falso: guarda cada texto con la hoja en que se escribió. splitTextToSize corta cada 60
// caracteres para que los textos largos ocupen varias líneas (y hojas), como el real.
const registro = { textos: [], guardado: null, hojas: 1 };
vi.mock('jspdf', () => ({
  jsPDF: class {
    constructor() {
      this.pagina = 1;
      registro.hojas = 1;
    }
    text(texto, x, y) {
      for (const t of [].concat(texto)) registro.textos.push({ pagina: this.pagina, texto: String(t), y });
    }
    splitTextToSize(texto) {
      const s = String(texto);
      const partes = [];
      for (let i = 0; i < s.length; i += 60) partes.push(s.slice(i, i + 60));
      return partes.length ? partes : [''];
    }
    addPage() {
      registro.hojas += 1;
      this.pagina = registro.hojas;
    }
    getNumberOfPages() { return registro.hojas; }
    setPage(n) { this.pagina = n; }
    save(nombre) { registro.guardado = nombre; }
    output() { return new ArrayBuffer(8); }
    setFont() {}
    setFontSize() {}
    setTextColor() {}
    setFillColor() {}
    setDrawColor() {}
    rect() {}
    line() {}
  },
}));

const { bytesPdfOrden, descargarPdfOrden, nombrePdfOrden, textoPie } = await import('./pdf.js');

const DIA = 86400000;
const expira = new Date(2027, 0, 7);
const taller = { nombre: 'Taller El Güero', ciudad: 'Tijuana', whatsapp: '6641234567' };
const orden = {
  folio: 'O261011-7KQ4',
  creadoAt: { toDate: () => new Date(2026, 9, 11) },
  expiraAt: { toDate: () => expira },
  estado: 'reparacion',
  vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001, kilometraje: 150000 },
  fallaReportada: 'Ruido al frenar',
  estadoRecepcion: 'Rayón en la puerta',
  pertenencias: 'Gato y llanta de refacción',
  observaciones: 'Balatas al 10 %',
  trabajos: [{ descripcion: 'Cambio de balatas', cantidad: 1, precioUnitario: 500 }],
  piezas: [{ descripcion: 'Balatas delanteras', cantidad: 2, precioUnitario: 350.5 }],
};
const todos = () => registro.textos.map((t) => t.texto);
const pie = `Esta orden se eliminará de Mecanix el ${expira.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}. Conserva este documento.`;

beforeEach(() => {
  registro.textos = [];
  registro.guardado = null;
});

describe('PDF de la orden de servicio', () => {
  it('incluye taller, folio, fecha, vehículo, los cuatro textos, tablas y totales con IVA', async () => {
    await descargarPdfOrden({ orden, taller });
    for (const esperado of [
      'Taller El Güero', 'Tijuana · WhatsApp 664 123 4567', 'ORDEN DE SERVICIO', 'Folio: O261011-7KQ4', 'Fecha: 11 de octubre de 2026',
      'Vehículo:', 'Nissan Sentra 2001', 'Kilometraje:', '150,000 km', 'Estado:', 'En reparación',
      'Falla reportada', 'Ruido al frenar', 'Estado del vehículo al recibirlo', 'Rayón en la puerta',
      'Pertenencias dentro del vehículo', 'Gato y llanta de refacción',
      'Trabajos', 'Cambio de balatas', '$500.00', 'Piezas', 'Balatas delanteras', '$350.50', '$701.00',
      'Subtotal', '$1,201.00', 'IVA (16 %)', '$192.16', 'Total', '$1,393.16',
      'Observaciones del vehículo', 'Balatas al 10 %', pie,
    ]) {
      expect(todos()).toContain(esperado);
    }
    expect(registro.guardado).toBe('orden-O261011-7KQ4.pdf');
  });
  it('NO lleva hoja de aviso de privacidad ni firma del cliente (eso es la etapa 4)', async () => {
    await descargarPdfOrden({ orden, taller });
    expect(todos().join('\n')).not.toMatch(/Aviso de privacidad|firma del cliente/i);
    expect(registro.hojas).toBe(1);
  });
  it('entregada: muestra la fecha de entrega y los días de garantía', async () => {
    await descargarPdfOrden({ orden: { ...orden, estado: 'entregado', fechaEntrega: { toDate: () => new Date(2026, 9, 20) }, garantiaDias: 30 }, taller });
    expect(todos()).toEqual(expect.arrayContaining(['Entregada:', '20 de octubre de 2026', 'Garantía:', '30 días']));
  });
  it('sin entregar: no muestra entrega ni garantía', async () => {
    await descargarPdfOrden({ orden, taller });
    expect(todos()).not.toContain('Entregada:');
    expect(todos()).not.toContain('Garantía:');
  });
  it('20 trabajos + 20 piezas y textos largos: varias hojas, encabezado de tabla repetido y el pie en TODAS', async () => {
    const largo = (n) => 'x'.repeat(n);
    const veinte = (nombre) => Array.from({ length: 20 }, (_, i) => ({ descripcion: `${nombre} ${i + 1} ${largo(180)}`, cantidad: 999, precioUnitario: 1000000 }));
    await descargarPdfOrden({
      orden: { ...orden, trabajos: veinte('Trabajo'), piezas: veinte('Pieza'), fallaReportada: largo(1000), estadoRecepcion: largo(500), pertenencias: largo(500), observaciones: largo(1000) },
      taller,
    });
    expect(registro.hojas).toBeGreaterThan(3);
    for (let h = 1; h <= registro.hojas; h++) {
      const deHoja = registro.textos.filter((t) => t.pagina === h).map((t) => t.texto);
      expect(deHoja).toContain(pie);
      expect(deHoja).toContain(`Hoja ${h} de ${registro.hojas}`);
    }
    // Ningún texto queda debajo del área útil (salvo el pie).
    expect(registro.textos.filter((t) => t.y > 280 && t.texto !== pie && !t.texto.startsWith('Hoja ')).length).toBe(0);
    for (let i = 1; i <= 20; i++) {
      expect(todos().some((t) => t.startsWith(`Trabajo ${i} `))).toBe(true);
      expect(todos().some((t) => t.startsWith(`Pieza ${i} `))).toBe(true);
    }
    expect(todos().filter((t) => t === 'Trabajos').length + todos().filter((t) => t === 'Piezas').length).toBeGreaterThan(2);
  });
  it('caracteres que la fuente no soporta salen como "?", sin tocar acentos ni la ñ', async () => {
    await descargarPdfOrden({
      orden: { ...orden, fallaReportada: 'Ruido 🔧 al frenar, señor Núñez ✓', trabajos: [{ descripcion: 'Afinación 🚗', cantidad: 1, precioUnitario: 100 }] },
      taller: { ...taller, nombre: 'Taller ⭐ Peña' },
    });
    expect(todos()).toEqual(expect.arrayContaining(['Ruido ? al frenar, señor Núñez ?', 'Afinación ?', 'Taller ? Peña']));
    expect(todos().join('')).not.toMatch(/[🔧🚗⭐✓]/u);
  });
  it('tolera renglones y textos mal formados sin romperse', async () => {
    const raro = { ...orden, trabajos: [null, 5, { descripcion: { html: '<b>' }, cantidad: 'x', precioUnitario: null }], piezas: 'basura', fallaReportada: { a: 1 }, vehiculo: null, estado: 'otro' };
    await expect(descargarPdfOrden({ orden: raro, taller: null })).resolves.toBeUndefined();
    expect(todos()).toContain('(sin descripción)');
    expect(todos().some((t) => t.includes('undefined') || t.includes('[object'))).toBe(false);
  });
  it('bytes para el .zip y nombre de archivo seguro', async () => {
    const bytes = await bytesPdfOrden({ orden, taller });
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(nombrePdfOrden('O261011-7KQ4')).toBe('orden-O261011-7KQ4.pdf');
    expect(nombrePdfOrden('../x/y')).toBe('orden-xy.pdf');
    expect(textoPie({})).toBe('Conserva este documento.');
    expect(DIA).toBeGreaterThan(0);
  });
});
