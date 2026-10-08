import { describe, expect, it, vi, beforeEach } from 'vitest';
import textos from '../../../../lib/textosLegalesTalleres.json';

// jspdf falso: guarda cada texto con la página en que se escribió.
const registro = { textos: [], guardado: null };
vi.mock('jspdf', () => ({
  jsPDF: class {
    constructor() {
      this.pagina = 1;
    }
    text(texto, x, y) {
      registro.textos.push({ pagina: this.pagina, texto: String(texto), y });
    }
    splitTextToSize(texto) {
      return [texto];
    }
    addPage() {
      this.pagina += 1;
    }
    save(nombre) {
      registro.guardado = nombre;
    }
    setFont() {}
    setFontSize() {}
    setTextColor() {}
    setFillColor() {}
    setDrawColor() {}
    rect() {}
    line() {}
  },
}));

const { EN_BLANCO, armarAvisoPrivacidad, descargarPdfCotizacion, formatearWhatsapp } = await import('./pdf.js');

const taller = { nombre: 'Taller El Güero', ciudad: 'Tijuana', whatsapp: '6641234567' };
const cotizacion = {
  folio: 'C261007-7KQ4',
  creadoAt: { toDate: () => new Date(2026, 9, 7) },
  vigenciaDias: 15,
  estado: 'borrador',
  cliente: { nombre: 'Juan Pérez', telefono: '664 765 4321' },
  vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001, placas: 'ABC1234' },
  observaciones: 'Ruido al frenar.',
  renglones: [
    { tipo: 'pieza', descripcion: 'Balata delantera', cantidad: 3, precioUnitario: 19.99 },
    { tipo: 'manoObra', descripcion: 'Instalación', cantidad: 2, precioUnitario: 350.55 },
  ],
};

beforeEach(() => {
  registro.textos = [];
  registro.guardado = null;
});

describe('aviso de privacidad del PDF', () => {
  it('llena todos los huecos de la plantilla con los datos del taller', () => {
    const { titulo, parrafos, version } = armarAvisoPrivacidad(taller);
    const todo = [titulo, ...parrafos].join('\n');
    expect(todo).not.toContain('[');
    expect(todo).not.toContain(']');
    expect(todo).toContain('Taller El Güero, con domicilio en Tijuana y contacto en 664 123 4567');
    expect(todo).toContain('acudiendo a Taller El Güero en WhatsApp 664 123 4567');
    expect(titulo).toBe('Aviso de privacidad');
    expect(version).toBe(textos.avisoTaller.version);
  });
  it('termina en la línea de firma; la versión no va en el cuerpo', () => {
    const { parrafos } = armarAvisoPrivacidad(taller);
    expect(parrafos[parrafos.length - 1].startsWith('Nombre y firma del cliente')).toBe(true);
    expect(parrafos.join('\n')).not.toContain('Versión del aviso');
  });
  it('si al taller le faltan datos, deja líneas en blanco (sin corchetes)', () => {
    const { titulo, parrafos } = armarAvisoPrivacidad({ nombre: 'Taller X', ciudad: '', whatsapp: undefined });
    const todo = [titulo, ...parrafos].join('\n');
    expect(todo).not.toContain('[');
    expect(todo).toContain(`Taller X, con domicilio en ${EN_BLANCO} y contacto en ${EN_BLANCO}`);
    expect(todo).toContain(`acudiendo a Taller X en ${EN_BLANCO}`);
  });
  it('sin taller, todo queda en blanco y sin corchetes', () => {
    const { parrafos } = armarAvisoPrivacidad(null);
    expect(parrafos.join('\n')).not.toContain('[');
  });
  it('formatea el WhatsApp de 10 dígitos', () => {
    expect(formatearWhatsapp('6641234567')).toBe('664 123 4567');
    expect(formatearWhatsapp('')).toBe('');
  });
});

describe('PDF de la cotización', () => {
  it('incluye taller, folio, cliente, vehículo, renglones, totales y observaciones en la página 1', async () => {
    await descargarPdfCotizacion({ cotizacion, taller });
    const pagina1 = registro.textos.filter((t) => t.pagina === 1).map((t) => t.texto);
    for (const esperado of [
      'Taller El Güero', 'Tijuana · WhatsApp 664 123 4567', 'Folio: C261007-7KQ4', 'Fecha: 7 de octubre de 2026',
      'Vigencia: 15 días (hasta el 22 de octubre de 2026)',
      'Cliente:', 'Juan Pérez', 'Teléfono:', '664 765 4321', 'Vehículo:', 'Nissan Sentra 2001', 'Placas:', 'ABC1234',
      'Balata delantera (Pieza)', 'Instalación (Mano de obra)', '$19.99', '$59.97', '$350.55', '$701.10',
      'Subtotal', '$761.07', 'IVA (16 %)', '$121.77', 'Total', '$882.84', 'Observaciones', 'Ruido al frenar.',
    ]) {
      expect(pagina1).toContain(esperado);
    }
    expect(registro.guardado).toBe('cotizacion-C261007-7KQ4.pdf');
  });
  it('el aviso va en una página aparte, sin corchetes y con la versión en el pie', async () => {
    await descargarPdfCotizacion({ cotizacion, taller });
    const pagina2 = registro.textos.filter((t) => t.pagina === 2);
    const textosPagina2 = pagina2.map((t) => t.texto);
    expect(textosPagina2).toContain('Aviso de privacidad');
    expect(textosPagina2.some((t) => t.startsWith('Nombre y firma del cliente'))).toBe(true);
    expect(textosPagina2.join('\n')).not.toContain('[');
    const pie = pagina2.find((t) => t.texto === `Versión del aviso: ${textos.avisoTaller.version}`);
    expect(pie.y).toBeGreaterThan(280);
    expect(registro.textos.filter((t) => t.pagina === 1).map((t) => t.texto)).not.toContain('Aviso de privacidad');
  });
  it('omite nombre, teléfono y placas vacíos sin dejar etiquetas sueltas', async () => {
    const sinDatos = { ...cotizacion, cliente: {}, vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 }, observaciones: '' };
    await descargarPdfCotizacion({ cotizacion: sinDatos, taller });
    const todos = registro.textos.map((t) => t.texto);
    expect(todos).not.toContain('Cliente:');
    expect(todos).not.toContain('Teléfono:');
    expect(todos).not.toContain('Placas:');
    expect(todos).not.toContain('Observaciones');
    expect(todos).toContain('Vehículo:');
    expect(todos.some((t) => t.includes('undefined'))).toBe(false);
  });
});
