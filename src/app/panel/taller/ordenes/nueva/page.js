'use client';

import { useRouter } from 'next/navigation';
import OrdenForm from '../OrdenForm';
import { useOrdenes } from '../contexto';
import { guardarOrden } from '../datos';
import { datosClienteDisponibles, ordenConSeguimiento } from '../../../../../lib/avisoOrden';
import { AVISO_ENTREGA_SEGUIMIENTO } from '../../../../../lib/seguimiento';

export default function NuevaOrden() {
  const router = useRouter();
  const { tallerId, taller, puedeEditar, avisoVersion, configOrdenes } = useOrdenes();

  if (!puedeEditar) {
    return (
      <main style={{ minHeight: '100vh', padding: '24px' }}>
        <p role="alert" style={{ color: '#8A2A1A' }}>No puedes crear órdenes ahora: revisa el aviso de cambios o que tu taller esté activo.</p>
        <button onClick={() => router.push('/panel/taller/ordenes')}>Volver a órdenes</button>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '16px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '22px', color: '#1A3C5E', margin: '4px 0 14px' }}>Nueva orden de servicio</h1>
        <OrdenForm
          tallerActivo={taller?.activo === true}
          datosCliente={datosClienteDisponibles(configOrdenes)}
          avisoEntrega={configOrdenes?.seguimientoHabilitado === true && ordenConSeguimiento(avisoVersion) ? AVISO_ENTREGA_SEGUIMIENTO : null}
          onCancelar={() => router.push('/panel/taller/ordenes')}
          onGuardar={async (datos) => {
            const folio = await guardarOrden({ tallerId, datos, avisoVersion });
            router.replace(`/panel/taller/ordenes/${folio}`);
          }}
        />
      </div>
    </main>
  );
}
