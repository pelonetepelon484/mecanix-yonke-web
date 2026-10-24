'use client';

// Botón "Descargar mis documentos" (en la lista de órdenes y en la de cotizaciones). Ver
// descargaDocumentos.js: tandas, tope de 200, progreso y cancelar; todo en el navegador.
import { useRef, useState } from 'react';
import { leerConfigOrdenes, leerSeguimiento, listarOrdenes } from './datos';
import { ligaSeguimientoParaPdf } from '../../../../lib/seguimiento';
import { listarCotizaciones, leerRenglones } from '../cotizaciones/datos';
import { bytesPdfOrden } from './pdf';
import { bytesPdfCotizacion, plantillaAvisoTaller } from '../cotizaciones/pdf';
import { DescargaCancelada, DescargaExcedeTope, MENSAJES_DESCARGA, guardarZip, prepararDocumentos, textoAvisoCotizaciones, textoProgreso } from './descargaDocumentos';

const boton = { width: '100%', minHeight: '52px', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' };

// configOrdenes: la de la lista de órdenes (contexto); si no llega (lista de cotizaciones), se lee
// una vez al descargar. Con las banderas del seguimiento en el PDF, las órdenes con enlace activo
// llevan su liga y su QR.
export default function DescargarDocumentos({ tallerId, taller, configOrdenes = undefined, fuentes: fuentesPrueba = null }) {
  const [estado, setEstado] = useState({ fase: 'listo', hechos: 0, total: 0, mensaje: '' });
  const cancelar = useRef(false);

  async function descargar() {
    cancelar.current = false;
    setEstado({ fase: 'preparando', hechos: 0, total: 0, mensaje: '' });
    const config = fuentesPrueba ? null : (configOrdenes !== undefined ? configOrdenes : await leerConfigOrdenes().catch(() => null));
    const conSeguimiento = config?.seguimientoEnPdf === true && config?.seguimientoHabilitado === true;
    const fuentes = fuentesPrueba ?? {
      listarOrdenes: (o) => listarOrdenes(tallerId, o),
      listarCotizaciones: (o) => listarCotizaciones(tallerId, o),
      leerRenglones: (folio) => leerRenglones(tallerId, folio),
      ...(conSeguimiento ? { leerEnlace: (orden) => leerSeguimiento(orden.seguimientoToken) } : {}),
      pdfOrden: (orden, enlace) => bytesPdfOrden({ orden, taller, ligaSeguimiento: ligaSeguimientoParaPdf(config, orden, enlace) }),
      pdfCotizacion: (cotizacion) => bytesPdfCotizacion({ cotizacion, taller }),
      tieneAviso: (cotizacion) => plantillaAvisoTaller(cotizacion.avisoVersion) !== null,
    };
    try {
      const r = await prepararDocumentos({
        fuentes,
        cancelado: () => cancelar.current,
        onProgreso: (hechos, total) => setEstado({ fase: 'preparando', hechos, total, mensaje: '' }),
      });
      const avisoCotizaciones = textoAvisoCotizaciones(r);
      if (!r.bytes) {
        setEstado({ fase: 'listo', hechos: 0, total: 0, mensaje: avisoCotizaciones || MENSAJES_DESCARGA.vacio });
        return;
      }
      guardarZip(r.bytes, r.nombre);
      const listo = `Listo: se descargaron ${r.total} ${r.total === 1 ? 'documento' : 'documentos'} en ${r.nombre}.`;
      setEstado({ fase: 'listo', hechos: 0, total: 0, mensaje: avisoCotizaciones ? `${listo} ${avisoCotizaciones}` : listo });
    } catch (err) {
      if (!(err instanceof DescargaCancelada) && !(err instanceof DescargaExcedeTope)) console.error(err);
      const mensaje = err instanceof DescargaCancelada || err instanceof DescargaExcedeTope ? err.message : MENSAJES_DESCARGA.fallo;
      setEstado({ fase: 'listo', hechos: 0, total: 0, mensaje });
    }
  }

  const preparando = estado.fase === 'preparando';
  return (
    <div style={{ marginBottom: '14px' }}>
      {!preparando ? (
        <button type="button" onClick={descargar} style={{ ...boton, border: '1px solid #1A3C5E', backgroundColor: '#fff', color: '#1A3C5E' }}>
          Descargar mis documentos
        </button>
      ) : (
        <div role="status" style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '12px', border: '1px solid #C5D8EC' }}>
          <p style={{ margin: '0 0 10px', fontSize: '15px', color: '#1A3C5E', fontWeight: 'bold' }}>
            {estado.total ? textoProgreso(estado.hechos, estado.total) : 'Buscando tus documentos…'}
          </p>
          <button type="button" onClick={() => { cancelar.current = true; }} style={{ ...boton, minHeight: '44px', border: 'none', backgroundColor: '#EEF1F5', color: '#333' }}>
            Cancelar
          </button>
        </div>
      )}
      <p style={{ fontSize: '12px', color: '#555', margin: '6px 0 0' }}>
        Un solo archivo .zip con el PDF de tus órdenes y cotizaciones activas (también las archivadas). Se arma en tu celular; no se sube a ningún lado.
      </p>
      {estado.mensaje && <p role="alert" style={{ fontSize: '14px', color: '#1A3C5E', margin: '6px 0 0' }}>{estado.mensaje}</p>}
    </div>
  );
}
