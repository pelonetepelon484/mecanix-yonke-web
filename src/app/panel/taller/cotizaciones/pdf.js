'use client';

// PDF de una cotización guardada. Se arma en el navegador con jspdf (se carga solo al usarlo) y se
// descarga directo: no se sube nada a ningún servidor.
// Página 1 (o más, si hay muchos renglones): la cotización. Página aparte: el aviso de privacidad
// que el taller entrega al cliente al firmar (términos de talleres, 1.3).
import { IVA_PORCENTAJE, aCentavos, formatearPesos, ivaCentavos, subtotalCentavos, totalCentavos, totalConIvaCentavos } from '../../../../lib/cotizaciones';
import textosTalleres from '../../../../lib/textosLegalesTalleres.json';

// Dato del taller que falta: línea en blanco para llenarse a mano.
export const EN_BLANCO = '______________________';
const INICIO_LINEA_FIRMA = 'Nombre y firma del cliente';

const AZUL = [26, 60, 94];
const GRIS = [110, 110, 110];
const NEGRO = [40, 40, 40];
const MARGEN = 14;
const DERECHA = 196;
const ANCHO = DERECHA - MARGEN;
const LIMITE_Y = 275;

// "6641234567" -> "664 123 4567". Si no son 10 dígitos, se deja como venga.
export function formatearWhatsapp(whatsapp) {
  const texto = String(whatsapp ?? '').trim();
  const digitos = texto.replace(/\D/g, '');
  return digitos.length === 10 ? `${digitos.slice(0, 3)} ${digitos.slice(3, 6)} ${digitos.slice(6)}` : texto;
}

function fechaLarga(fecha) {
  return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Aviso de privacidad con los datos del taller. El cuerpo termina en la línea de firma; la versión
// del aviso va aparte (en el pie de la página), por eso no se incluye el renglón "Versión del aviso".
export function armarAvisoPrivacidad(taller) {
  const nombre = taller?.nombre?.trim() || EN_BLANCO;
  const ciudad = taller?.ciudad?.trim() || EN_BLANCO;
  const whatsapp = formatearWhatsapp(taller?.whatsapp) || EN_BLANCO;
  const contacto = whatsapp === EN_BLANCO ? EN_BLANCO : `WhatsApp ${whatsapp}`;
  const reemplazos = [
    [/\[nombre del taller\]/gi, nombre],
    [/\[ciudad\]/gi, ciudad],
    [/\[whatsapp del taller\]/gi, whatsapp],
    [/\[medio de contacto del taller\]/gi, contacto],
  ];
  const { plantilla, version } = textosTalleres.avisoTaller;
  const firma = plantilla.findIndex((p) => p.texto.startsWith(INICIO_LINEA_FIRMA));
  const textos = plantilla
    .slice(0, firma === -1 ? plantilla.length : firma + 1)
    .map((p) => reemplazos.reduce((texto, [marca, valor]) => texto.replace(marca, valor), p.texto));
  const [titulo, ...parrafos] = textos;
  return { titulo, parrafos, version };
}

// Líneas de cliente y vehículo, [etiqueta, valor]. Lo vacío se omite para no dejar huecos.
export function lineasClienteVehiculo(cotizacion) {
  const lineas = [];
  const cliente = cotizacion.cliente ?? {};
  const v = cotizacion.vehiculo ?? {};
  if (cliente.nombre?.trim()) lineas.push(['Cliente', cliente.nombre.trim()]);
  if (cliente.telefono?.trim()) lineas.push(['Teléfono', cliente.telefono.trim()]);
  const vehiculo = [v.marca, v.modelo, v.anio].filter(Boolean).join(' ');
  if (vehiculo) lineas.push(['Vehículo', vehiculo]);
  if (v.placas?.trim()) lineas.push(['Placas', v.placas.trim()]);
  if (Number.isInteger(v.kilometraje)) lineas.push(['Kilometraje', `${v.kilometraje.toLocaleString('es-MX')} km`]);
  return lineas;
}

function estilo(doc, { tamano, negrita = false, color = NEGRO }) {
  doc.setFont('helvetica', negrita ? 'bold' : 'normal');
  doc.setFontSize(tamano);
  doc.setTextColor(...color);
}

function dibujarCotizacion(doc, cotizacion, taller) {
  const creado = cotizacion.creadoAt?.toDate ? cotizacion.creadoAt.toDate() : new Date();
  const vence = new Date(creado.getTime() + cotizacion.vigenciaDias * 24 * 60 * 60 * 1000);

  // Encabezado: datos del taller a la izquierda, folio y fecha a la derecha.
  estilo(doc, { tamano: 16, negrita: true, color: AZUL });
  doc.text(doc.splitTextToSize(taller?.nombre?.trim() || 'Cotización', 120)[0], MARGEN, 20);
  estilo(doc, { tamano: 10, color: GRIS });
  const contacto = [taller?.ciudad?.trim(), taller?.whatsapp ? `WhatsApp ${formatearWhatsapp(taller.whatsapp)}` : ''].filter(Boolean).join(' · ');
  if (contacto) doc.text(contacto, MARGEN, 26);

  estilo(doc, { tamano: 13, negrita: true, color: AZUL });
  doc.text('COTIZACIÓN', DERECHA, 20, { align: 'right' });
  estilo(doc, { tamano: 10 });
  doc.text(`Folio: ${cotizacion.folio}`, DERECHA, 26, { align: 'right' });
  doc.text(`Fecha: ${fechaLarga(creado)}`, DERECHA, 31, { align: 'right' });

  doc.setDrawColor(...AZUL);
  doc.line(MARGEN, 35, DERECHA, 35);
  let y = 43;

  estilo(doc, { tamano: 10 });
  doc.text(`Vigencia: ${cotizacion.vigenciaDias} días (hasta el ${fechaLarga(vence)})`, MARGEN, y);
  y += 8;

  for (const [etiqueta, valor] of lineasClienteVehiculo(cotizacion)) {
    estilo(doc, { tamano: 10, negrita: true });
    doc.text(`${etiqueta}:`, MARGEN, y);
    estilo(doc, { tamano: 10 });
    for (const linea of doc.splitTextToSize(valor, ANCHO - 28)) {
      doc.text(linea, MARGEN + 28, y);
      y += 5;
    }
    y += 1;
  }
  y += 4;

  // Tabla de renglones. Columnas: descripción | cantidad | precio unitario | importe.
  const encabezadoTabla = () => {
    doc.setFillColor(...AZUL);
    doc.rect(MARGEN, y, ANCHO, 8, 'F');
    estilo(doc, { tamano: 9, negrita: true, color: [255, 255, 255] });
    doc.text('Descripción', MARGEN + 2, y + 5.5);
    doc.text('Cant.', 128, y + 5.5, { align: 'right' });
    doc.text('Precio unitario', 160, y + 5.5, { align: 'right' });
    doc.text('Importe', DERECHA - 2, y + 5.5, { align: 'right' });
    y += 8;
  };
  encabezadoTabla();
  cotizacion.renglones.forEach((r, i) => {
    estilo(doc, { tamano: 9 });
    const tipo = r.tipo === 'manoObra' ? 'Mano de obra' : 'Pieza';
    const lineas = doc.splitTextToSize(`${r.descripcion} (${tipo})`, 100);
    const alto = lineas.length * 4.2 + 3.5;
    if (y + alto > LIMITE_Y) {
      doc.addPage();
      y = 20;
      encabezadoTabla();
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

  // Totales: precios sin IVA, IVA calculado sobre el subtotal de toda la cotización.
  const subtotal = totalCentavos(cotizacion.renglones);
  if (y + 26 > LIMITE_Y) {
    doc.addPage();
    y = 20;
  }
  y += 7;
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

  const observaciones = (cotizacion.observaciones ?? '').trim();
  if (observaciones) {
    if (y + 12 > LIMITE_Y) {
      doc.addPage();
      y = 20;
    }
    estilo(doc, { tamano: 10, negrita: true });
    doc.text('Observaciones', MARGEN, y);
    y += 6;
    estilo(doc, { tamano: 10 });
    for (const linea of doc.splitTextToSize(observaciones, ANCHO)) {
      if (y > LIMITE_Y) {
        doc.addPage();
        y = 20;
      }
      doc.text(linea, MARGEN, y);
      y += 5;
    }
  }
}

function dibujarAviso(doc, taller) {
  const { titulo, parrafos, version } = armarAvisoPrivacidad(taller);
  const pie = () => {
    estilo(doc, { tamano: 8, color: GRIS });
    doc.text(`Versión del aviso: ${version}`, MARGEN, 288);
  };
  pie();
  estilo(doc, { tamano: 14, negrita: true, color: AZUL });
  doc.text(titulo, MARGEN, 22);
  let y = 32;
  parrafos.forEach((parrafo, i) => {
    const esFirma = i === parrafos.length - 1;
    // Espacio para firmar antes de la última línea.
    if (esFirma) y += 14;
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

// Genera el PDF y lo descarga en el dispositivo. cotizacion: tal como la devuelve leerCotizacion (con folio y renglones).
export async function descargarPdfCotizacion({ cotizacion, taller }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  dibujarCotizacion(doc, cotizacion, taller);
  doc.addPage();
  dibujarAviso(doc, taller);
  doc.save(`cotizacion-${cotizacion.folio}.pdf`);
}
