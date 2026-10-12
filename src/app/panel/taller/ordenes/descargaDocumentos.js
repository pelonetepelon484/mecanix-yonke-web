// "Descargar mis documentos": un solo .zip con el PDF de cada orden activa y de cada cotización
// activa o archivada del taller (las cotizaciones con su hoja de aviso de privacidad). Todo en el
// navegador del taller; nada se sube a ningún lado.
// - Lee en tandas de 20 (las mismas consultas de las listas) y se detiene en cuanto pasa del tope,
//   así nunca lee de más: 1 lectura por orden; 1 por cotización + 1 por cada renglón.
// - Tope: 200 documentos por descarga. Si hay más, no se arma nada y se explica qué hacer.
// - Arma los PDF uno por uno, con una pausa entre cada uno, para que el celular no se trabe;
//   avisa el avance ("Preparando 12 de 40…") y se puede cancelar en cualquier momento.
// - Cotización cuya versión de aviso no está en el archivo: con datos del cliente se deja FUERA
//   del .zip (su PDF no se genera); sin datos del cliente entra sin la hoja del aviso. En los dos
//   casos se avisa cuáles fueron (omitidas / sinAviso).
// Las dependencias llegan en `fuentes` para poder probarlo sin Firestore ni jsPDF.
import { zipSync } from 'fflate';

export const TOPE_DOCUMENTOS = 200;
export const MENSAJES_DESCARGA = {
  tope: `Tienes más de ${TOPE_DOCUMENTOS} documentos activos. Descárgalos uno por uno desde su detalle o escríbenos.`,
  vacio: 'No tienes órdenes ni cotizaciones activas para descargar.',
  fallo: 'No pudimos preparar tus documentos. Revisa tu conexión e intenta de nuevo.',
  cancelado: 'Descarga cancelada. No se descargó nada.',
};

export class DescargaCancelada extends Error {
  constructor() { super(MENSAJES_DESCARGA.cancelado); this.name = 'DescargaCancelada'; }
}
export class DescargaExcedeTope extends Error {
  constructor() { super(MENSAJES_DESCARGA.tope); this.name = 'DescargaExcedeTope'; }
}

const limpiarFolio = (folio) => String(folio ?? '').replace(/[^A-Za-z0-9-]/g, '') || 'sin-folio';
export const nombreArchivo = (tipo, folio) => `${tipo === 'orden' ? 'orden' : 'cotizacion'}-${limpiarFolio(folio)}.pdf`;
export const textoProgreso = (hechos, total) => `Preparando ${hechos} de ${total}…`;
export function nombreZip(fecha = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `documentos-mecanix-${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}.zip`;
}

const pausaPorDefecto = () => new Promise((r) => { setTimeout(r, 0); });

// Junta páginas de una lista (cursor) hasta que no haya más o se pase del tope.
async function juntar(listar, opciones, acumulados, cancelado) {
  let cursor = null;
  for (;;) {
    if (cancelado()) throw new DescargaCancelada();
    const r = await listar({ ...opciones, cursor });
    acumulados.push(...r.items);
    if (acumulados.length > TOPE_DOCUMENTOS) throw new DescargaExcedeTope();
    if (!r.hayMas || !r.cursor) return;
    cursor = r.cursor;
  }
}

// Devuelve { bytes, nombre, total, omitidas, sinAviso } (folios de cotizaciones). Lanza
// DescargaCancelada, DescargaExcedeTope u otro error.
// fuentes: { listarOrdenes(opciones), listarCotizaciones(opciones), leerRenglones(folio),
//            pdfOrden(orden), pdfCotizacion(cotizacion), tieneAviso?(cotizacion), pausa?() }
// pdfCotizacion lanza un error con name 'CotizacionSinAviso' para dejarla fuera.
export async function prepararDocumentos({ fuentes, onProgreso = () => {}, cancelado = () => false }) {
  const pausa = fuentes.pausa ?? pausaPorDefecto;
  const documentos = [];
  const ordenes = [];
  await juntar(fuentes.listarOrdenes, { estado: 'todos' }, ordenes, cancelado);
  documentos.push(...ordenes.map((o) => ({ tipo: 'orden', datos: o })));
  for (const archivada of [false, true]) {
    const cotizaciones = [];
    await juntar(fuentes.listarCotizaciones, { archivada }, cotizaciones, cancelado);
    documentos.push(...cotizaciones.map((c) => ({ tipo: 'cotizacion', datos: c })));
    if (documentos.length > TOPE_DOCUMENTOS) throw new DescargaExcedeTope();
  }
  if (documentos.length === 0) return { bytes: null, nombre: null, total: 0, omitidas: [], sinAviso: [] };

  const archivos = {};
  const omitidas = [];
  const sinAviso = [];
  onProgreso(0, documentos.length);
  for (let i = 0; i < documentos.length; i++) {
    if (cancelado()) throw new DescargaCancelada();
    const { tipo, datos } = documentos[i];
    let bytes;
    if (tipo === 'orden') {
      bytes = await fuentes.pdfOrden(datos);
    } else {
      const renglones = await fuentes.leerRenglones(datos.folio);
      try {
        bytes = await fuentes.pdfCotizacion({ ...datos, renglones });
      } catch (error) {
        if (error?.name !== 'CotizacionSinAviso') throw error;
        omitidas.push(datos.folio);
        onProgreso(i + 1, documentos.length);
        await pausa();
        continue;
      }
      if (fuentes.tieneAviso && !fuentes.tieneAviso(datos)) sinAviso.push(datos.folio);
    }
    // Si dos documentos tuvieran el mismo nombre (no debería), no se pisan.
    let nombre = nombreArchivo(tipo, datos.folio);
    for (let n = 2; archivos[nombre]; n++) nombre = nombreArchivo(tipo, `${datos.folio}-${n}`);
    archivos[nombre] = bytes;
    onProgreso(i + 1, documentos.length);
    await pausa();
  }
  if (cancelado()) throw new DescargaCancelada();
  const total = Object.keys(archivos).length;
  if (total === 0) return { bytes: null, nombre: null, total: 0, omitidas, sinAviso };
  // Los PDF ya vienen comprimidos por dentro; un nivel bajo basta y es rápido en celular.
  const bytes = zipSync(archivos, { level: 1 });
  return { bytes, nombre: nombreZip(), total, omitidas, sinAviso };
}

// Aviso de las cotizaciones que se dejaron fuera o que salieron sin la hoja del aviso ('' si ninguna).
export function textoAvisoCotizaciones({ omitidas = [], sinAviso = [] }) {
  const partes = [];
  if (omitidas.length) {
    partes.push(`No se incluyeron porque tienen datos del cliente y no encontramos el texto de su aviso de privacidad: ${omitidas.join(', ')}. Escríbenos.`);
  }
  if (sinAviso.length) {
    partes.push(`Salieron sin la hoja del aviso de privacidad porque no encontramos el texto de su versión: ${sinAviso.join(', ')}.`);
  }
  return partes.join(' ');
}

// Descarga los bytes del .zip en el dispositivo (sin subir nada).
export function guardarZip(bytes, nombre) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
