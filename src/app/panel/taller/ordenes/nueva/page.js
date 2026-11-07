'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import OrdenForm from '../OrdenForm';
import { useOrdenes } from '../contexto';
import { guardarOrden } from '../datos';
import { datosClienteDisponibles, ordenConSeguimiento } from '../../../../../lib/avisoOrden';
import { AVISO_ENTREGA_SEGUIMIENTO } from '../../../../../lib/seguimiento';
import { ordenDesdeCita } from '../../../../../lib/citasTaller';
import { cambiarEstadoCita, leerCita } from '../../citas/datos';

// "?cita=ID" en la dirección: viene de "Convertir en orden" de una cita. Se lee la cita y se llena
// el formulario (el taller revisa y guarda). Al guardar, la cita se marca "Atendida" (si no se
// puede, p. ej. sin Premium de citas, la orden queda guardada igual).
const citaDeLaDireccion = () => {
  if (typeof window === 'undefined') return null;
  const id = new URLSearchParams(window.location.search).get('cita');
  return id && /^[A-Za-z0-9]{1,40}$/.test(id) ? id : null;
};

export default function NuevaOrden() {
  const router = useRouter();
  const { tallerId, taller, puedeEditar, avisoVersion, configOrdenes } = useOrdenes();
  const [citaId] = useState(citaDeLaDireccion);
  const [desdeCita, setDesdeCita] = useState(citaId ? undefined : null); // undefined = cargando
  const datosCliente = datosClienteDisponibles(configOrdenes);

  useEffect(() => {
    if (!citaId || !tallerId) return undefined;
    let cancelado = false;
    leerCita(tallerId, citaId)
      .then((c) => { if (!cancelado) setDesdeCita(c); })
      .catch((err) => { console.error(err); if (!cancelado) setDesdeCita(null); });
    return () => { cancelado = true; };
  }, [citaId, tallerId]);

  if (!puedeEditar) {
    return (
      <main style={{ minHeight: '100vh', padding: '24px' }}>
        <p role="alert" style={{ color: '#8A2A1A' }}>No puedes crear órdenes ahora: revisa el aviso de cambios o que tu taller esté activo.</p>
        <button onClick={() => router.push('/panel/taller/ordenes')}>Volver a órdenes</button>
      </main>
    );
  }
  if (desdeCita === undefined) {
    return <main style={{ minHeight: '100vh', padding: '24px' }}><p style={{ color: '#555' }}>Cargando...</p></main>;
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '16px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '22px', color: '#1A3C5E', margin: '4px 0 14px' }}>Nueva orden de servicio</h1>
        {desdeCita && (
          <p role="note" style={{ fontSize: '14px', color: '#1A3C5E', backgroundColor: '#E8EEF5', borderRadius: '10px', padding: '10px', margin: '0 0 14px' }}>
            Datos tomados de la cita de {desdeCita.nombre}. Revísalos y completa la orden. Al guardarla, la cita se marcará como atendida.
          </p>
        )}
        <OrdenForm
          tallerActivo={taller?.activo === true}
          datosCliente={datosCliente}
          tallerId={tallerId}
          prellenado={desdeCita ? ordenDesdeCita(desdeCita, datosCliente) : null}
          avisoEntrega={configOrdenes?.seguimientoHabilitado === true && ordenConSeguimiento(avisoVersion) ? AVISO_ENTREGA_SEGUIMIENTO : null}
          onCancelar={() => router.push(desdeCita ? `/panel/taller/citas/${citaId}` : '/panel/taller/ordenes')}
          onGuardar={async (datos) => {
            const folio = await guardarOrden({ tallerId, datos, avisoVersion });
            if (desdeCita) await cambiarEstadoCita({ tallerId, id: citaId, estado: 'atendida' }).catch(() => {});
            router.replace(`/panel/taller/ordenes/${folio}`);
          }}
        />
      </div>
    </main>
  );
}
