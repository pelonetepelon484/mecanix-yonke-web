import qrcode from 'qrcode-generator';

// QR de la liga de seguimiento para el PDF de la orden (lógica pura). Corrección de errores M: con
// la liga de ~87 caracteres sale la versión 6 (41 × 41 cuadritos). Se dibuja con rectángulos de
// jsPDF (pdf.js), juntando los cuadritos oscuros seguidos de cada fila: queda nítido al imprimir y
// sin imágenes. Se carga solo al generar un PDF con el bloque (import dinámico en pdf.js).

export const MARGEN_QR = 4; // margen blanco obligatorio, en cuadritos, alrededor del código

// { version, tamano (cuadritos por lado, sin margen), oscuro(fila, columna) }
export function matrizQr(texto) {
  const qr = qrcode(0, 'M');
  qr.addData(texto, 'Byte');
  qr.make();
  const tamano = qr.getModuleCount();
  return { version: (tamano - 17) / 4, tamano, oscuro: (fila, columna) => qr.isDark(fila, columna) };
}

// Tramos oscuros por fila: [{ fila, columna, largo }]. Un rectángulo por tramo en lugar de uno por
// cuadrito (cientos menos en el PDF).
export function tramosQr({ tamano, oscuro }) {
  const tramos = [];
  for (let fila = 0; fila < tamano; fila++) {
    let inicio = -1;
    for (let columna = 0; columna <= tamano; columna++) {
      const negro = columna < tamano && oscuro(fila, columna);
      if (negro && inicio === -1) inicio = columna;
      if (!negro && inicio !== -1) {
        tramos.push({ fila, columna: inicio, largo: columna - inicio });
        inicio = -1;
      }
    }
  }
  return tramos;
}
