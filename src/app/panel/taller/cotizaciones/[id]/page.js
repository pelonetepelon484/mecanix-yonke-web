'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../AuthContext';
import CotizacionForm from '../CotizacionForm';
import { cambiarArchivada, duplicarCotizacion, guardarCotizacion, leerCotizacion, leerTaller, quitarDatosCliente } from '../datos';

export default function EditarCotizacion() {
  const router = useRouter();
  const { id: folio } = useParams();
  const { tallerId } = useAuth();
  const [cot, setCot] = useState(null);
  const [tallerActivo, setTallerActivo] = useState(true);
  const [version, setVersion] = useState(0); // cambia al recargar, para reiniciar el formulario con datos guardados
  const [aviso, setAviso] = useState('');
  const [noExiste, setNoExiste] = useState(false);

  useEffect(() => {
    if (!tallerId) return;
    let cancelado = false;
    Promise.all([leerCotizacion(tallerId, folio), leerTaller(tallerId)])
      .then(([c, t]) => {
        if (cancelado) return;
        if (!c) setNoExiste(true);
        setCot(c);
        setTallerActivo(t?.activo === true);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelado) setAviso('No pudimos abrir la cotización. Intenta de nuevo.');
      });
    return () => { cancelado = true; };
  }, [tallerId, folio, version]);

  const recargar = () => setVersion((v) => v + 1);

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

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '16px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <p style={{ fontSize: '13px', color: '#888', margin: '4px 0' }}>Folio {folio}</p>
        <h1 style={{ fontSize: '22px', color: '#1A3C5E', margin: '0 0 14px' }}>Editar cotización</h1>
        {aviso && <p role="status" style={{ color: '#1A3C5E', fontSize: '14px' }}>{aviso}</p>}

        <CotizacionForm
          key={version}
          inicial={cot}
          tallerActivo={tallerActivo}
          onCancelar={() => router.push('/panel/taller/cotizaciones')}
          onGuardar={async (datos) => {
            await guardarCotizacion({
              tallerId, folio, datos, creadoAt: cot.creadoAt, renglonesAnteriores: cot.renglones.length,
            });
            setAviso('Cambios guardados.');
            recargar();
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
              const nuevo = await duplicarCotizacion(tallerId, folio);
              router.push(`/panel/taller/cotizaciones/${nuevo}`);
            } catch (err) {
              console.error(err);
              setAviso('No pudimos duplicar la cotización. Intenta de nuevo.');
            }
          }}
          onQuitarDatos={async () => {
            if (!window.confirm('¿Quitar el nombre, el teléfono y las placas de esta cotización? Esto no se puede deshacer. Los precios y piezas se quedan.')) return;
            try {
              await quitarDatosCliente(tallerId, folio);
              setAviso('Se quitaron los datos del cliente.');
              recargar();
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
