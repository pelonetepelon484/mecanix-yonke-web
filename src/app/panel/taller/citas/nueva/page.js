'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCitas } from '../contexto';
import { crearCita } from '../datos';
import CitaForm from '../CitaForm';

// Agendar una cita. Sin permiso de escribir (sin Premium, términos viejos o taller desactivado)
// regresa a la agenda.
export default function NuevaCitaPage() {
  const router = useRouter();
  const { tallerId, puedeEscribir } = useCitas();

  useEffect(() => {
    if (!puedeEscribir) router.replace('/panel/taller/citas');
  }, [puedeEscribir, router]);
  if (!puedeEscribir) return null;

  async function guardar(datos) {
    const id = await crearCita({ tallerId, datos });
    router.push(`/panel/taller/citas/${id}`);
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '16px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <button type="button" onClick={() => router.push('/panel/taller/citas')} style={volver}>← Citas</button>
        <h1 style={{ fontSize: '22px', color: '#1A3C5E', margin: '8px 0 6px' }}>Agendar cita</h1>
        <CitaForm tallerId={tallerId} textoBoton="Agendar cita" onGuardar={guardar} />
      </div>
    </main>
  );
}

const volver = { background: 'none', border: 'none', color: '#1A3C5E', fontWeight: '600', cursor: 'pointer', padding: 0, fontSize: '14px' };
