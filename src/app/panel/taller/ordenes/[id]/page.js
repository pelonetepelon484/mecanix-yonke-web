'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import OrdenForm from '../OrdenForm';
import { useOrdenes } from '../contexto';
import AgregarAlHistorial from '../AgregarAlHistorial';
import { borrarOrden, guardarOrden, leerOrden, quitarDatosClienteOrden } from '../datos';
import { AVISO_COPIA } from '../../../../../lib/ordenes';
import { MENSAJES_COTIZACION } from '../../../../../lib/cotizaciones';
import { descargarPdfOrden } from '../pdf';
import { datosClienteDisponibles } from '../../../../../lib/avisoOrden';

export default function DetalleOrden() {
  const router = useRouter();
  const { id: folio } = useParams();
  const { tallerId, taller, puedeEditar, puedeBorrar, versionVigente, configOrdenes } = useOrdenes();
  const [orden, setOrden] = useState(null);
  const [noExiste, setNoExiste] = useState(false);
  const [version, setVersion] = useState(0);
  const [aviso, setAviso] = useState('');
  const [vencida, setVencida] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  useEffect(() => {
    let cancelado = false;
    leerOrden(tallerId, folio)
      .then((o) => {
        if (cancelado) return;
        if (!o) setNoExiste(true);
        setVencida(o?.expiraAt?.toDate ? o.expiraAt.toDate().getTime() <= Date.now() : false);
        setOrden(o);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelado) setAviso('No pudimos abrir la orden. Intenta de nuevo.');
      });
    return () => { cancelado = true; };
  }, [tallerId, folio, version]);

  // El PDF se arma con lo GUARDADO (orden), no con lo que esté a medio editar en el formulario.
  async function descargarPdf() {
    setGenerandoPdf(true);
    try {
      await descargarPdfOrden({ orden, taller });
    } catch (err) {
      console.error(err);
      setAviso('No pudimos generar el PDF. Intenta de nuevo.');
    } finally {
      setGenerandoPdf(false);
    }
  }

  if (noExiste) {
    return (
      <main style={{ minHeight: '100vh', padding: '24px' }}>
        <p>Esta orden no existe o ya no está disponible.</p>
        <button onClick={() => router.push('/panel/taller/ordenes')}>Volver a órdenes</button>
      </main>
    );
  }
  if (!orden) {
    return <main style={{ minHeight: '100vh', padding: '24px' }}><p style={{ color: '#555' }}>{aviso || 'Cargando...'}</p></main>;
  }

  const fechaEliminacion = orden.expiraAt?.toDate ? orden.expiraAt.toDate() : null;
  const soloLectura = !puedeEditar || vencida;

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '16px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <p style={{ fontSize: '13px', color: '#888', margin: '4px 0' }}>Folio {folio}</p>
        <h1 style={{ fontSize: '22px', color: '#1A3C5E', margin: '0 0 14px' }}>{soloLectura ? 'Ver orden' : 'Editar orden'}</h1>
        {vencida && <p role="alert" style={{ color: '#8A2A1A', fontSize: '14px' }}>Esta orden ya venció y está en solo lectura.</p>}
        {aviso && <p role="status" style={{ color: '#1A3C5E', fontSize: '14px' }}>{aviso}</p>}
        {taller?.activo === true && !versionVigente && (
          <p role="note" style={{ color: '#8A2A1A', fontSize: '14px', backgroundColor: '#FFF6E8', borderRadius: '10px', padding: '10px' }}>{MENSAJES_COTIZACION.sinTerminosVigentes}</p>
        )}
        {fechaEliminacion && (
          <p data-testid="se-eliminara" style={{ fontSize: '14px', color: '#8A2A1A', backgroundColor: '#FFF6E8', border: '1px solid #E8720C', borderRadius: '12px', padding: '12px', margin: '0 0 14px', lineHeight: '1.5' }}>
            Se eliminará el {fechaEliminacion.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}. {AVISO_COPIA}
          </p>
        )}

        <div style={{ marginBottom: '14px' }}>
          <button type="button" onClick={descargarPdf} disabled={generandoPdf} style={{ width: '100%', minHeight: '52px', borderRadius: '12px', border: '1px solid #1A3C5E', backgroundColor: '#fff', color: '#1A3C5E', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', opacity: generandoPdf ? 0.6 : 1 }}>
            {generandoPdf ? 'Generando PDF...' : 'Descargar PDF'}
          </button>
          <p style={{ fontSize: '13px', color: '#555', margin: '6px 0 0' }}>El PDF usa lo último que guardaste.</p>
        </div>

        {/* Historial de servicios (config/historialTaller): solo órdenes entregadas, con Premium. */}
        <AgregarAlHistorial tallerId={tallerId} taller={taller} folio={folio} orden={orden} puedeEditar={puedeEditar} />

        <OrdenForm
          key={version}
          inicial={orden}
          tallerActivo={taller?.activo === true}
          soloLectura={soloLectura}
          // Eliminar y quitar datos: taller activo Y términos vigentes (las reglas exigen lo mismo; no
          // piden Premium).
          puedeEliminar={puedeBorrar}
          // Datos del cliente solo en órdenes con la versión de aviso vigente (las viejas, nunca).
          datosCliente={datosClienteDisponibles(configOrdenes, orden.avisoVersion)}
          onEliminar={async () => {
            if (!window.confirm('¿Eliminar esta orden? Esto no se puede deshacer.')) return;
            try {
              await borrarOrden(tallerId, folio);
              router.push('/panel/taller/ordenes');
            } catch (err) {
              console.error(err);
              setAviso('No pudimos eliminar la orden. Intenta de nuevo.');
            }
          }}
          onCancelar={() => router.push('/panel/taller/ordenes')}
          onGuardar={async (datos) => {
            await guardarOrden({ tallerId, folio, datos, original: orden });
            setAviso('Cambios guardados.');
            setVersion((v) => v + 1);
          }}
          onQuitarDatos={!puedeBorrar ? undefined : async () => {
            if (!window.confirm('¿Quitar el nombre, el teléfono y las placas de esta orden? Esto no se puede deshacer.')) return;
            try {
              await quitarDatosClienteOrden(tallerId, folio);
              setAviso('Se quitaron los datos del cliente.');
              setVersion((v) => v + 1);
            } catch (err) {
              console.error(err);
              setAviso('No pudimos quitar los datos. Intenta de nuevo.');
            }
          }}
        />
      </div>
    </main>
  );
}
