'use client';

import { useRouter } from 'next/navigation';
import CotizacionForm from '../CotizacionForm';
import { useCotizaciones } from '../contexto';
import { guardarCotizacion } from '../datos';

export default function NuevaCotizacion() {
  const router = useRouter();
  const { tallerId, taller, puedeEditar, datosClienteHabilitados, avisoVersion } = useCotizaciones();

  if (!puedeEditar) {
    return (
      <main style={{ minHeight: '100vh', padding: '24px' }}>
        <p role="alert" style={{ color: '#8A2A1A' }}>No puedes crear cotizaciones ahora: revisa el aviso de cambios o que tu taller esté activo.</p>
        <button onClick={() => router.push('/panel/taller/cotizaciones')}>Volver a cotizaciones</button>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '16px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '22px', color: '#1A3C5E', margin: '4px 0 14px' }}>Nueva cotización</h1>
        <CotizacionForm
          tallerActivo={taller?.activo === true}
          datosClienteHabilitados={datosClienteHabilitados}
          onCancelar={() => router.push('/panel/taller/cotizaciones')}
          onGuardar={async (datos) => {
            const folio = await guardarCotizacion({ tallerId, datos, avisoVersion });
            router.replace(`/panel/taller/cotizaciones/${folio}`);
          }}
        />
      </div>
    </main>
  );
}
