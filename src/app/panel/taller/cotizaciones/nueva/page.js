'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../AuthContext';
import CotizacionForm from '../CotizacionForm';
import { guardarCotizacion, leerTaller } from '../datos';

export default function NuevaCotizacion() {
  const router = useRouter();
  const { tallerId } = useAuth();
  const [tallerActivo, setTallerActivo] = useState(true);

  useEffect(() => {
    if (!tallerId) return;
    let cancelado = false;
    leerTaller(tallerId)
      .then((t) => { if (!cancelado) setTallerActivo(t?.activo === true); })
      .catch(() => {});
    return () => { cancelado = true; };
  }, [tallerId]);

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '16px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '22px', color: '#1A3C5E', margin: '4px 0 14px' }}>Nueva cotización</h1>
        <CotizacionForm
          tallerActivo={tallerActivo}
          onCancelar={() => router.push('/panel/taller/cotizaciones')}
          onGuardar={async (datos) => {
            const folio = await guardarCotizacion({ tallerId, datos });
            router.replace(`/panel/taller/cotizaciones/${folio}`);
          }}
        />
      </div>
    </main>
  );
}
