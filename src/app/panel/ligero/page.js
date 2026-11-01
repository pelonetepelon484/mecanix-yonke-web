'use client';

// Panel del yonke ligero: lo único que hace es contestar búsquedas activas de su estado. Sin menú
// de abajo: PanelLayoutCliente lo regresa aquí si intenta abrir otra pantalla del panel. Las reglas
// de Firestore son la protección real.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useAuth } from '../AuthContext';
import BotonAvisos from '../BotonAvisos';
import PedidosClientesYonke from '../PedidosClientesYonke';
import { leerYonkeEstadoActivo } from '../solicitudesPiezasDatos';
import { RUTA_COMPLETAR, TEXTO_COMPLETAR } from '../../../lib/yonkeLigero';
import CambiarPassword from './CambiarPassword';

export default function PanelLigero() {
  const router = useRouter();
  const { user, yonkeId, loading, esLigero } = useAuth();
  const [nombre, setNombre] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/panel');
  }, [user, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!yonkeId) return undefined;
    let vigente = true;
    leerYonkeEstadoActivo(yonkeId).then((d) => { if (vigente) setNombre(d.nombre); }).catch(() => {});
    return () => { vigente = false; };
  }, [yonkeId]);

  async function cerrarSesion() {
    await signOut(auth);
    router.push('/panel');
  }

  if (loading || !esLigero || !yonkeId) {
    return <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '48px 16px', textAlign: 'center', color: '#555' }}>Cargando...</main>;
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', paddingBottom: '32px' }}>
      <div style={{ backgroundColor: '#1A3C5E', padding: '20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', maxWidth: '600px', margin: '0 auto' }}>
          <h1 style={{ color: '#fff', fontSize: '20px', margin: 0, fontWeight: 'bold', overflowWrap: 'anywhere' }}>{nombre || 'Mi yonke'}</h1>
          <button onClick={cerrarSesion} style={{ flexShrink: 0, background: 'none', border: 'none', color: '#E8720C', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
        <a href={RUTA_COMPLETAR} style={{ display: 'block', marginBottom: '14px', padding: '10px 14px', borderRadius: '10px', backgroundColor: '#FFF4E8', border: '1px solid #E8720C', color: '#1A3C5E', fontSize: '14px', fontWeight: 'bold', textDecoration: 'none' }}>
          {TEXTO_COMPLETAR} →
        </a>
        <BotonAvisos />
        <PedidosClientesYonke yonkeId={yonkeId} ligero />
        <CambiarPassword />
      </div>
    </main>
  );
}
