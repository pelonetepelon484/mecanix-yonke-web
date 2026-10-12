import { describe, expect, it, vi, beforeEach } from 'vitest';

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
    output() {
      return new ArrayBuffer(4);
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

const {
  EN_BLANCO, MENSAJES_AVISO_COTIZACION, armarAvisoPrivacidad, bytesPdfCotizacion, descargarPdfCotizacion, formatearWhatsapp, tieneDatosCliente,
} = await import('./pdf.js');

const taller = { nombre: 'Taller El Güero', ciudad: 'Tijuana', whatsapp: '6641234567' };
const cotizacion = {
  folio: 'C261007-7KQ4',
  creadoAt: { toDate: () => new Date(2026, 9, 7) },
  vigenciaDias: 15,
  estado: 'borrador',
  avisoVersion: 'aviso-taller-1',
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
    const { titulo, parrafos, version } = armarAvisoPrivacidad(taller, 'aviso-taller-1');
    const todo = [titulo, ...parrafos].join('\n');
    expect(todo).not.toContain('[');
    expect(todo).not.toContain(']');
    expect(todo).toContain('Taller El Güero, con domicilio en Tijuana y contacto en 664 123 4567');
    expect(todo).toContain('acudiendo a Taller El Güero en WhatsApp 664 123 4567');
    expect(titulo).toBe('Aviso de privacidad');
    expect(version).toBe('aviso-taller-1');
  });
  it('termina en la línea de firma; la versión no va en el cuerpo', () => {
    const { parrafos } = armarAvisoPrivacidad(taller, 'aviso-taller-1');
    expect(parrafos[parrafos.length - 1].startsWith('Nombre y firma del cliente')).toBe(true);
    expect(parrafos.join('\n')).not.toContain('Versión del aviso');
  });
  it('si al taller le faltan datos, deja líneas en blanco (sin corchetes)', () => {
    const { titulo, parrafos } = armarAvisoPrivacidad({ nombre: 'Taller X', ciudad: '', whatsapp: undefined }, 'aviso-taller-1');
    const todo = [titulo, ...parrafos].join('\n');
    expect(todo).not.toContain('[');
    expect(todo).toContain(`Taller X, con domicilio en ${EN_BLANCO} y contacto en ${EN_BLANCO}`);
    expect(todo).toContain(`acudiendo a Taller X en ${EN_BLANCO}`);
  });
  it('sin taller, todo queda en blanco y sin corchetes', () => {
    const { parrafos } = armarAvisoPrivacidad(null, 'aviso-taller-1');
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
    const pie = pagina2.find((t) => t.texto === 'Versión del aviso: aviso-taller-1');
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
  it('caracteres que la fuente no soporta salen como "?", sin tocar acentos ni la ñ', async () => {
    const conRaros = {
      ...cotizacion,
      cliente: { nombre: 'Ana Muñoz 😀' },
      observaciones: 'Señor Núñez ✓ llega mañana 🚗',
      renglones: [{ tipo: 'pieza', descripcion: 'Balata 🔧 ñ á é', cantidad: 1, precioUnitario: 10 }],
    };
    await descargarPdfCotizacion({ cotizacion: conRaros, taller: { ...taller, nombre: 'Taller ⭐' } });
    const todos = registro.textos.map((t) => t.texto);
    expect(todos).toEqual(expect.arrayContaining(['Ana Muñoz ?', 'Señor Núñez ? llega mañana ?', 'Balata ? ñ á é (Pieza)', 'Taller ?']));
    expect(todos.join('')).not.toMatch(/[😀✓🚗🔧⭐]/u);
  });
});

describe('aviso de privacidad por versión', () => {
  const textoPagina = (n) => registro.textos.filter((t) => t.pagina === n).map((t) => t.texto).join('\n');

  it('una cotización vieja (aviso-taller-1) sigue con el texto viejo del plazo', async () => {
    const r = await descargarPdfCotizacion({ cotizacion, taller });
    expect(r).toEqual({ conAviso: true });
    const aviso = textoPagina(2);
    expect(aviso).toContain('Plazo. Sus datos se eliminan de la plataforma a los 90 días de elaborada la cotización');
    expect(aviso).not.toContain('se convierte en una orden de trabajo');
    expect(aviso).toContain('Versión del aviso: aviso-taller-1');
  });
  it('una cotización con aviso-taller-2 imprime el plazo nuevo con el nombre del taller', async () => {
    const r = await descargarPdfCotizacion({ cotizacion: { ...cotizacion, avisoVersion: 'aviso-taller-2' }, taller });
    expect(r).toEqual({ conAviso: true });
    const aviso = textoPagina(2);
    expect(aviso).toContain('Plazo. Si usted aprueba la cotización, esta se convierte en una orden de trabajo y la cotización se elimina de la plataforma para ahorrar espacio de almacenamiento; Taller El Güero puede imprimirla o conservarla para su contabilidad, lo cual ya no compete a Mecanix.');
    expect(aviso).toContain('a más tardar a los 90 días de elaborada la cotización');
    expect(aviso).not.toContain('Sus datos se eliminan de la plataforma a los 90 días');
    expect(aviso).not.toContain('[');
    expect(aviso).toContain('Versión del aviso: aviso-taller-2');
  });
  it('las dos versiones solo difieren en el párrafo "Plazo"', () => {
    const v1 = armarAvisoPrivacidad(taller, 'aviso-taller-1');
    const v2 = armarAvisoPrivacidad(taller, 'aviso-taller-2');
    expect(v2.parrafos).toHaveLength(v1.parrafos.length);
    const distintos = v1.parrafos.filter((p, i) => p !== v2.parrafos[i]);
    expect(distintos).toHaveLength(1);
    expect(distintos[0].startsWith('Plazo.')).toBe(true);
  });
  it('versión desconocida o vacía: no hay plantilla', () => {
    expect(armarAvisoPrivacidad(taller, 'aviso-taller-9')).toBeNull();
    expect(armarAvisoPrivacidad(taller, '')).toBeNull();
    expect(armarAvisoPrivacidad(taller, undefined)).toBeNull();
  });
  it('detecta datos del cliente: nombre, teléfono o placas (los espacios no cuentan)', () => {
    expect(tieneDatosCliente({ cliente: { nombre: 'Ana' } })).toBe(true);
    expect(tieneDatosCliente({ cliente: { telefono: '6641234567' } })).toBe(true);
    expect(tieneDatosCliente({ cliente: {}, vehiculo: { placas: 'ABC1234' } })).toBe(true);
    expect(tieneDatosCliente({ cliente: { nombre: '  ' }, vehiculo: { marca: 'Nissan' } })).toBe(false);
    expect(tieneDatosCliente({})).toBe(false);
  });
  for (const [caso, cambio] of [
    ['nombre', { cliente: { nombre: 'Juan' }, vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 } }],
    ['teléfono', { cliente: { telefono: '6641234567' }, vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 } }],
    ['placas', { cliente: {}, vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001, placas: 'ABC1234' } }],
  ]) {
    it(`falla cerrada: con ${caso} del cliente y versión desconocida NO genera el PDF`, async () => {
      const promesa = descargarPdfCotizacion({ cotizacion: { ...cotizacion, ...cambio, avisoVersion: 'aviso-taller-9' }, taller });
      await expect(promesa).rejects.toThrow(MENSAJES_AVISO_COTIZACION.sinPdf);
      await expect(bytesPdfCotizacion({ cotizacion: { ...cotizacion, ...cambio, avisoVersion: 'aviso-taller-9' }, taller }))
        .rejects.toMatchObject({ name: 'CotizacionSinAviso', folio: 'C261007-7KQ4' });
      expect(registro.guardado).toBeNull();
      expect(registro.textos).toHaveLength(0);
    });
  }
  it('sin datos del cliente y versión desconocida: sale sin la hoja del aviso y lo indica', async () => {
    const sinCliente = { ...cotizacion, cliente: {}, vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 }, avisoVersion: 'aviso-taller-9' };
    const r = await descargarPdfCotizacion({ cotizacion: sinCliente, taller });
    expect(r).toEqual({ conAviso: false });
    expect(registro.guardado).toBe('cotizacion-C261007-7KQ4.pdf');
    expect(registro.textos.every((t) => t.pagina === 1)).toBe(true);
    const todos = registro.textos.map((t) => t.texto).join('\n');
    expect(todos).not.toContain('Aviso de privacidad');
    expect(todos).not.toContain('Versión del aviso');
    expect(MENSAJES_AVISO_COTIZACION.sinHoja).toContain('sin la hoja del aviso de privacidad');
  });
});
