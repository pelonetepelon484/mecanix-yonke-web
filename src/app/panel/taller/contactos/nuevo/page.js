'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useContactos } from '../contexto';
import { crearContacto } from '../datos';
import ContactoForm from '../ContactoForm';

// Alta de un contacto. Sin permiso de escribir (términos viejos o taller desactivado) regresa a la
// lista. Con los 25 lugares del plan Básico ocupados, crearContacto avisa con el mensaje de Premium.
export default function NuevoContactoPage() {
  const router = useRouter();
  const { tallerId, premium, puedeEscribir } = useContactos();

  useEffect(() => {
    if (!puedeEscribir) router.replace('/panel/taller/contactos');
  }, [puedeEscribir, router]);
  if (!puedeEscribir) return null;

  async function guardar(datos) {
    const id = await crearContacto({ tallerId, datos, premium });
    router.push(`/panel/taller/contactos/${id}`);
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '16px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <button type="button" onClick={() => router.push('/panel/taller/contactos')} style={volver}>← Contactos</button>
        <h1 style={{ fontSize: '22px', color: '#1A3C5E', margin: '8px 0 6px' }}>Nuevo contacto</h1>
        <ContactoForm textoBoton="Guardar contacto" onGuardar={guardar} />
      </div>
    </main>
  );
}

const volver = { background: 'none', border: 'none', color: '#1A3C5E', fontWeight: '600', cursor: 'pointer', padding: 0, fontSize: '14px' };
