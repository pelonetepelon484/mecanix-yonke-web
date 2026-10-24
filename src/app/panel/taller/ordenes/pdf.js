'use client';

// PDF de una orden de servicio (etapa 3). Se arma en el navegador con jspdf (se carga solo al
// usarlo) y se descarga directo: no se sube nada a ningún servidor. Mismo estilo que el de
// cotizaciones. Etapa 4: si el aviso de órdenes está listo (texto final del abogado, misma versión
// que la orden), agrega la hoja del aviso de privacidad y la constancia de recepción con firma. Si la
// orden trae datos del cliente y el aviso NO está listo, el PDF no se genera (falla cerrada).
// Todo el texto es texto plano: lo que venga de Firestore se lee con textoPlano/leerItems
// (tolerando renglones mal formados) y pasa por textoPdf (lo que la fuente no soporta -> "?").
// Al pie de CADA hoja: "Esta orden se eliminará de Mecanix el [fecha]. Conserva este documento."
// Seguimiento (config/ordenes.seguimientoEnPdf): al final de la hoja de la orden, el bloque "Sigue tu
// orden en línea" con la liga y su QR, SOLO si llega `seguimiento` (la liga ya decidida con
// ligaSeguimientoParaPdf: banderas, token y enlace activo). Nunca en las hojas del aviso ni la
// constancia, y sin fecha de vencimiento.
import { IVA_PORCENTAJE, aCentavos, formatearPesos, ivaCentavos, subtotalCentavos, totalConIvaCentavos } from '../../../../lib/cotizaciones';
import { MAX_ESTADO_RECEPCION, MAX_FALLA, MAX_OBSERVACIONES, MAX_PERTENENCIAS, NOMBRE_ESTADO_ORDEN, leerItems, textoPlano } from '../../../../lib/ordenes';
import { protegerTextos } from '../../../../lib/pdfTexto';
import { armarAvisoOrden } from '../../../../lib/avisoOrden';
import { NOTA_SEGUIMIENTO_PDF, TITULO_SEGUIMIENTO_PDF } from '../../../../lib/seguimiento';
import { ANCHO, AZUL, DERECHA, GRIS, LIMITE_Y, MARGEN, estilo, fechaLarga, formatearWhatsapp } from '../cotizaciones/pdf';

const aFecha = (v) => (v?.toDate ? v.toDate() : v instanceof Date ? v : null);
const Y_PIE = 288;

export const MENSAJE_SIN_AVISO = 'No podemos generar el PDF de esta orden: falta el texto del aviso de privacidad de órdenes. Escríbenos.';

export function tieneDatosCliente(orden) {
  const hay = (v) => typeof v === 'string' && v.trim() !== '';
  return hay(orden?.cliente?.nombre) || hay(orden?.cliente?.telefono) || hay(orden?.vehiculo?.placas);
}

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
  const nombre = textoPlano(orden?.cliente?.nombre, 100).trim();
  const telefono = textoPlano(orden?.cliente?.telefono, 20).trim();
  const placas = textoPlano(v.placas, 12).trim();
  if (nombre) lineas.push(['Cliente', nombre]);
  if (telefono) lineas.push(['Teléfono', telefono]);
  const vehiculo = [textoPlano(v.marca, 60), textoPlano(v.modelo, 60), Number.isInteger(v.anio) ? String(v.anio) : ''].filter(Boolean).join(' ');
  if (vehiculo) lineas.push(['Vehículo', vehiculo]);
  if (placas) lineas.push(['Placas', placas]);
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

// QR de 30 mm de lado más el margen blanco (MARGEN_QR cuadritos por lado); el texto a la derecha.
const LADO_QR = 30;

// Bloque "Sigue tu orden en línea" desde y; devuelve la y de abajo. seguimiento: { liga, matriz, margen }.
function dibujarSeguimiento(doc, y, { liga, matriz, margen, tramos }) {
  const modulo = LADO_QR / matriz.tamano;
  const blanco = margen * modulo;
  const ladoTotal = LADO_QR + 2 * blanco;
  const alto = ladoTotal + 4;
  doc.setDrawColor(...AZUL);
  doc.rect(MARGEN, y, ANCHO, alto);
  // QR: fondo blanco (margen obligatorio) y un rectángulo negro por tramo de cuadritos oscuros.
  const x0 = MARGEN + 2;
  const y0 = y + 2;
  doc.setFillColor(255, 255, 255);
  doc.rect(x0, y0, ladoTotal, ladoTotal, 'F');
  doc.setFillColor(0, 0, 0);
  for (const t of tramos) {
    doc.rect(x0 + blanco + t.columna * modulo, y0 + blanco + t.fila * modulo, t.largo * modulo, modulo, 'F');
  }
  // Texto a la derecha del código.
  const xt = x0 + ladoTotal + 6;
  const anchoTexto = DERECHA - 4 - xt;
  let yt = y + 10;
  estilo(doc, { tamano: 12, negrita: true, color: AZUL });
  doc.text(TITULO_SEGUIMIENTO_PDF, xt, yt);
  yt += 7;
  estilo(doc, { tamano: 8 });
  for (const linea of doc.splitTextToSize(liga, anchoTexto)) {
    doc.text(linea, xt, yt);
    yt += 4;
  }
  yt += 3;
  estilo(doc, { tamano: 9, color: GRIS });
  for (const linea of doc.splitTextToSize(NOTA_SEGUIMIENTO_PDF, anchoTexto)) {
    doc.text(linea, xt, yt);
    yt += 4.5;
  }
  return y + alto;
}
export const altoBloqueSeguimiento = (matriz, margen) => LADO_QR + 2 * margen * (LADO_QR / matriz.tamano) + 4;

function dibujarOrden(doc, orden, taller, seguimiento = null) {
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

  // Seguimiento en línea: al final de la hoja de la orden; si no cabe, en una hoja nueva.
  if (seguimiento) {
    asegurar(altoBloqueSeguimiento(seguimiento.matriz, seguimiento.margen) + 2);
    y = dibujarSeguimiento(doc, y, seguimiento) + 4;
  }

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

// Hoja de texto legal (aviso o constancia). En la constancia se deja espacio para firmar antes del
// último párrafo (la línea de firma). La versión del aviso va al pie.
function dibujarHojaLegal(doc, { titulo, parrafos }, version, { espacioFirma = false } = {}) {
  doc.addPage();
  const pie = () => {
    estilo(doc, { tamano: 8, color: GRIS });
    doc.text(`Versión del aviso: ${version}`, MARGEN, Y_PIE);
  };
  pie();
  estilo(doc, { tamano: 14, negrita: true, color: AZUL });
  doc.text(titulo, MARGEN, 22);
  let y = 32;
  parrafos.forEach((parrafo, i) => {
    if (espacioFirma && i === parrafos.length - 1) y += 14;
    estilo(doc, { tamano: 10 });
    for (const linea of doc.splitTextToSize(parrafo, ANCHO)) {
      if (y > LIMITE_Y) {
        doc.addPage();
        pie();
        y = 22;
        estilo(doc, { tamano: 10 });
      }
      doc.text(linea, MARGEN, y);
      y += 5;
    }
    y += 3;
  });
}

// ligaSeguimiento: la liga ya decidida (ligaSeguimientoParaPdf) o null. El QR se carga solo si hace falta.
async function crearDocOrden({ orden, taller, ligaSeguimiento = null }) {
  // Aviso y constancia SOLO con el texto final y la misma versión que se guardó en la orden.
  const legal = armarAvisoOrden(taller, orden, orden?.avisoVersion);
  if (!legal && tieneDatosCliente(orden)) throw new Error(MENSAJE_SIN_AVISO);
  const { jsPDF } = await import('jspdf');
  const doc = protegerTextos(new jsPDF());
  let seguimiento = null;
  if (ligaSeguimiento) {
    const { MARGEN_QR, matrizQr, tramosQr } = await import('../../../../lib/qrSeguimiento');
    const matriz = matrizQr(ligaSeguimiento);
    seguimiento = { liga: ligaSeguimiento, matriz, margen: MARGEN_QR, tramos: tramosQr(matriz) };
  }
  dibujarOrden(doc, orden, taller, seguimiento);
  if (legal) {
    dibujarHojaLegal(doc, legal.aviso, legal.version);
    dibujarHojaLegal(doc, legal.constancia, legal.version, { espacioFirma: true });
  }
  return doc;
}

export const nombrePdfOrden = (folio) => `orden-${String(folio ?? '').replace(/[^A-Za-z0-9-]/g, '') || 'sin-folio'}.pdf`;

// Genera el PDF y lo descarga en el dispositivo. orden: tal como la devuelve leerOrden (con folio).
export async function descargarPdfOrden({ orden, taller, ligaSeguimiento = null }) {
  const doc = await crearDocOrden({ orden, taller, ligaSeguimiento });
  doc.save(nombrePdfOrden(orden.folio));
}

// Mismo PDF, como bytes (para meterlo al .zip de "Descargar mis documentos").
export async function bytesPdfOrden({ orden, taller, ligaSeguimiento = null }) {
  const doc = await crearDocOrden({ orden, taller, ligaSeguimiento });
  return new Uint8Array(doc.output('arraybuffer'));
}
