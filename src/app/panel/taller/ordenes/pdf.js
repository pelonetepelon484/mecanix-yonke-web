'use client';

// PDF de una orden de servicio (etapa 3). Se arma en el navegador con jspdf (se carga solo al
// usarlo) y se descarga directo: no se sube nada a ningún servidor. Mismo estilo que el de
// cotizaciones. SIN hoja de aviso de privacidad ni constancia con firma (eso es la etapa 4).
// Todo el texto es texto plano: lo que venga de Firestore se lee con textoPlano/leerItems
// (tolerando renglones mal formados) y pasa por textoPdf (lo que la fuente no soporta -> "?").
// Al pie de CADA hoja: "Esta orden se eliminará de Mecanix el [fecha]. Conserva este documento."
import { IVA_PORCENTAJE, aCentavos, formatearPesos, ivaCentavos, subtotalCentavos, totalConIvaCentavos } from '../../../../lib/cotizaciones';
import { MAX_ESTADO_RECEPCION, MAX_FALLA, MAX_OBSERVACIONES, MAX_PERTENENCIAS, NOMBRE_ESTADO_ORDEN, leerItems, textoPlano } from '../../../../lib/ordenes';
import { protegerTextos } from '../../../../lib/pdfTexto';
import { ANCHO, AZUL, DERECHA, GRIS, LIMITE_Y, MARGEN, estilo, fechaLarga, formatearWhatsapp } from '../cotizaciones/pdf';

const aFecha = (v) => (v?.toDate ? v.toDate() : v instanceof Date ? v : null);
const Y_PIE = 288;

export function textoPie(orden) {
  const expira = aFecha(orden?.expiraAt);
  return expira
    ? `Esta orden se eliminará de Mecanix el ${fechaLarga(expira)}. Conserva este documento.`
    : 'Conserva este documento.';
}

// Datos del vehículo y de la entrega, [etiqueta, valor]. Lo vacío se omite.
export function lineasOrden(orden) {
  const v = orden?.vehiculo ?? {};
  const lineas = [];
  const vehiculo = [textoPlano(v.marca, 60), textoPlano(v.modelo, 60), Number.isInteger(v.anio) ? String(v.anio) : ''].filter(Boolean).join(' ');
  if (vehiculo) lineas.push(['Vehículo', vehiculo]);
  if (Number.isInteger(v.kilometraje)) lineas.push(['Kilometraje', `${v.kilometraje.toLocaleString('es-MX')} km`]);
  const estado = NOMBRE_ESTADO_ORDEN[orden?.estado];
  if (estado) lineas.push(['Estado', estado]);
  if (orden?.estado === 'entregado') {
    const entrega = aFecha(orden.fechaEntrega);
    if (entrega) lineas.push(['Entregada', fechaLarga(entrega)]);
    if (Number.isInteger(orden.garantiaDias)) lineas.push(['Garantía', `${orden.garantiaDias} ${orden.garantiaDias === 1 ? 'día' : 'días'}`]);
  }
  return lineas;
}

function dibujarOrden(doc, orden, taller) {
  const creado = aFecha(orden.creadoAt) ?? new Date();
  let y = 0;
  const nuevaHoja = () => {
    doc.addPage();
    y = 20;
  };
  const asegurar = (alto) => {
    if (y + alto > LIMITE_Y) nuevaHoja();
  };

  // Encabezado: datos del taller a la izquierda, folio y fecha a la derecha (igual que cotizaciones).
  estilo(doc, { tamano: 16, negrita: true, color: AZUL });
  doc.text(doc.splitTextToSize(textoPlano(taller?.nombre, 100).trim() || 'Orden de servicio', 120)[0], MARGEN, 20);
  estilo(doc, { tamano: 10, color: GRIS });
  const contacto = [textoPlano(taller?.ciudad, 100).trim(), taller?.whatsapp ? `WhatsApp ${formatearWhatsapp(taller.whatsapp)}` : ''].filter(Boolean).join(' · ');
  if (contacto) doc.text(contacto, MARGEN, 26);
  estilo(doc, { tamano: 13, negrita: true, color: AZUL });
  doc.text('ORDEN DE SERVICIO', DERECHA, 20, { align: 'right' });
  estilo(doc, { tamano: 10 });
  doc.text(`Folio: ${textoPlano(orden.folio, 20)}`, DERECHA, 26, { align: 'right' });
  doc.text(`Fecha: ${fechaLarga(creado)}`, DERECHA, 31, { align: 'right' });
  doc.setDrawColor(...AZUL);
  doc.line(MARGEN, 35, DERECHA, 35);
  y = 43;

  for (const [etiqueta, valor] of lineasOrden(orden)) {
    asegurar(6);
    estilo(doc, { tamano: 10, negrita: true });
    doc.text(`${etiqueta}:`, MARGEN, y);
    estilo(doc, { tamano: 10 });
    for (const linea of doc.splitTextToSize(valor, ANCHO - 28)) {
      asegurar(5);
      doc.text(linea, MARGEN + 28, y);
      y += 5;
    }
    y += 1;
  }
  y += 3;

  // Textos libres (largos): cada uno con su título, en varias líneas y hojas si hace falta.
  const bloques = [
    ['Falla reportada', textoPlano(orden.fallaReportada, MAX_FALLA)],
    ['Estado del vehículo al recibirlo', textoPlano(orden.estadoRecepcion, MAX_ESTADO_RECEPCION)],
    ['Pertenencias dentro del vehículo', textoPlano(orden.pertenencias, MAX_PERTENENCIAS)],
  ];
  const bloqueTexto = (titulo, texto) => {
    if (!texto.trim()) return;
    asegurar(12);
    estilo(doc, { tamano: 10, negrita: true });
    doc.text(titulo, MARGEN, y);
    y += 6;
    estilo(doc, { tamano: 10 });
    for (const linea of doc.splitTextToSize(texto.trim(), ANCHO)) {
      asegurar(5);
      doc.text(linea, MARGEN, y);
      y += 5;
    }
    y += 3;
  };
  bloques.forEach(([titulo, texto]) => bloqueTexto(titulo, texto));

  // Tablas de trabajos y de piezas. Columnas: descripción | cantidad | precio unitario | importe.
  const tabla = (titulo, items) => {
    if (items.length === 0) return;
    const encabezado = () => {
      doc.setFillColor(...AZUL);
      doc.rect(MARGEN, y, ANCHO, 8, 'F');
      estilo(doc, { tamano: 9, negrita: true, color: [255, 255, 255] });
      doc.text(titulo, MARGEN + 2, y + 5.5);
      doc.text('Cant.', 128, y + 5.5, { align: 'right' });
      doc.text('Precio unitario', 160, y + 5.5, { align: 'right' });
      doc.text('Importe', DERECHA - 2, y + 5.5, { align: 'right' });
      y += 8;
    };
    asegurar(16);
    encabezado();
    items.forEach((r, i) => {
      estilo(doc, { tamano: 9 });
      const lineas = doc.splitTextToSize(r.descripcion || '(sin descripción)', 100);
      const alto = lineas.length * 4.2 + 3.5;
      if (y + alto > LIMITE_Y) {
        nuevaHoja();
        encabezado();
        estilo(doc, { tamano: 9 });
      }
      if (i % 2 === 0) {
        doc.setFillColor(246, 247, 249);
        doc.rect(MARGEN, y, ANCHO, alto, 'F');
      }
      lineas.forEach((linea, j) => doc.text(linea, MARGEN + 2, y + 5.3 + j * 4.2));
      doc.text(String(r.cantidad), 128, y + 5.3, { align: 'right' });
      doc.text(formatearPesos(aCentavos(r.precioUnitario)), 160, y + 5.3, { align: 'right' });
      doc.text(formatearPesos(subtotalCentavos(r)), DERECHA - 2, y + 5.3, { align: 'right' });
      y += alto;
    });
    y += 5;
  };
  const trabajos = leerItems(orden.trabajos);
  const piezas = leerItems(orden.piezas);
  tabla('Trabajos', trabajos);
  tabla('Piezas', piezas);

  // Totales: precios sin IVA; el IVA se calcula sobre el subtotal de toda la orden.
  const subtotal = [...trabajos, ...piezas].reduce((suma, r) => suma + subtotalCentavos(r), 0);
  asegurar(26);
  y += 2;
  estilo(doc, { tamano: 10 });
  doc.text('Subtotal', 160, y, { align: 'right' });
  doc.text(formatearPesos(subtotal), DERECHA - 2, y, { align: 'right' });
  y += 6;
  doc.text(`IVA (${IVA_PORCENTAJE} %)`, 160, y, { align: 'right' });
  doc.text(formatearPesos(ivaCentavos(subtotal)), DERECHA - 2, y, { align: 'right' });
  y += 7;
  estilo(doc, { tamano: 12, negrita: true, color: AZUL });
  doc.text('Total', 160, y, { align: 'right' });
  doc.text(formatearPesos(totalConIvaCentavos(subtotal)), DERECHA - 2, y, { align: 'right' });
  y += 10;

  bloqueTexto('Observaciones del vehículo', textoPlano(orden.observaciones, MAX_OBSERVACIONES));

  // Pie en TODAS las hojas.
  const pie = textoPie(orden);
  const hojas = doc.getNumberOfPages();
  for (let h = 1; h <= hojas; h++) {
    doc.setPage(h);
    estilo(doc, { tamano: 8, color: GRIS });
    doc.text(pie, MARGEN, Y_PIE);
    doc.text(`Hoja ${h} de ${hojas}`, DERECHA, Y_PIE, { align: 'right' });
  }
}

async function crearDocOrden({ orden, taller }) {
  const { jsPDF } = await import('jspdf');
  const doc = protegerTextos(new jsPDF());
  dibujarOrden(doc, orden, taller);
  return doc;
}

export const nombrePdfOrden = (folio) => `orden-${String(folio ?? '').replace(/[^A-Za-z0-9-]/g, '') || 'sin-folio'}.pdf`;

// Genera el PDF y lo descarga en el dispositivo. orden: tal como la devuelve leerOrden (con folio).
export async function descargarPdfOrden({ orden, taller }) {
  const doc = await crearDocOrden({ orden, taller });
  doc.save(nombrePdfOrden(orden.folio));
}

// Mismo PDF, como bytes (para meterlo al .zip de "Descargar mis documentos").
export async function bytesPdfOrden({ orden, taller }) {
  const doc = await crearDocOrden({ orden, taller });
  return new Uint8Array(doc.output('arraybuffer'));
}
