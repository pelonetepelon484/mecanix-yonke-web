'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CotizacionForm from '../CotizacionForm';
import { useCotizaciones } from '../contexto';
import { cambiarArchivada, duplicarCotizacion, guardarCotizacion, leerCotizacion, quitarDatosCliente } from '../datos';

export default function EditarCotizacion() {
  const router = useRouter();
  const { id: folio } = useParams();
  const { tallerId, taller, puedeEditar, datosClienteHabilitados, avisoVersion, recargar } = useCotizaciones();
  const [cot, setCot] = useState(null);
  const [noExiste, setNoExiste] = useState(false);
  const [version, setVersion] = useState(0);
  const [aviso, setAviso] = useState('');
  const [vencida, setVencida] = useState(false);

  useEffect(() => {
    let cancelado = false;
    leerCotizacion(tallerId, folio)
      .then((c) => {
        if (cancelado) return;
        if (!c) setNoExiste(true);
        setVencida(c?.expiraAt?.toDate ? c.expiraAt.toDate().getTime() <= Date.now() : false);
        setCot(c);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelado) setAviso('No pudimos abrir la cotización. Intenta de nuevo.');
      });
    return () => { cancelado = true; };
  }, [tallerId, folio, version]);

  function recargarTodo() {
    setVersion((v) => v + 1);
  }

  if (noExiste) {
    return (
      <main style={{ minHeight: '100vh', padding: '24px' }}>
        <p>Esta cotización no existe o ya no está disponible.</p>
        <button onClick={() => router.push('/panel/taller/cotizaciones')}>Volver a cotizaciones</button>
      </main>
    );
  }
  if (!cot) {
    return <main style={{ minHeight: '100vh', padding: '24px' }}><p style={{ color: '#555' }}>{aviso || 'Cargando...'}</p></main>;
  }

  const fechaEliminacion = cot.expiraAt?.toDate ? cot.expiraAt.toDate() : null;
  const soloLectura = !puedeEditar || vencida;

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '16px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <p style={{ fontSize: '13px', color: '#888', margin: '4px 0' }}>Folio {folio}</p>
        <h1 style={{ fontSize: '22px', color: '#1A3C5E', margin: '0 0 14px' }}>{soloLectura ? 'Ver cotización' : 'Editar cotización'}</h1>
        {vencida && <p role="alert" style={{ color: '#8A2A1A', fontSize: '14px' }}>Esta cotización ya venció y está en solo lectura.</p>}
        {aviso && <p role="status" style={{ color: '#1A3C5E', fontSize: '14px' }}>{aviso}</p>}

        <CotizacionForm
          key={version}
          inicial={cot}
          tallerActivo={taller?.activo === true}
          soloLectura={soloLectura}
          datosClienteHabilitados={datosClienteHabilitados}
          fechaEliminacion={fechaEliminacion}
          onCancelar={() => router.push('/panel/taller/cotizaciones')}
          onGuardar={async (datos) => {
            await guardarCotizacion({
              tallerId, folio, datos, original: cot, renglonesAnteriores: cot.renglones.length,
            });
            setAviso('Cambios guardados.');
            recargarTodo();
          }}
          onArchivar={async () => {
            try {
              await cambiarArchivada(tallerId, folio, !cot.archivada);
              router.push('/panel/taller/cotizaciones');
            } catch (err) {
              console.error(err);
              setAviso('No pudimos archivar la cotización. Intenta de nuevo.');
            }
          }}
          onDuplicar={async () => {
            try {
              const nuevo = await duplicarCotizacion(tallerId, folio, avisoVersion);
              router.push(`/panel/taller/cotizaciones/${nuevo}`);
            } catch (err) {
              console.error(err);
              setAviso('No pudimos duplicar la cotización. Intenta de nuevo.');
            }
          }}
          onQuitarDatos={async () => {
            if (!window.confirm('¿Quitar el nombre, el teléfono y las placas de esta cotización? Esto no se puede deshacer. Los precios y las piezas se quedan.')) return;
            try {
              await quitarDatosCliente(tallerId, folio);
              setAviso('Se quitaron los datos del cliente.');
              recargar();
              recargarTodo();
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
