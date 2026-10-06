'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { useAuth } from '../AuthContext';

export default function PanelTaller() {
  const router = useRouter();
  const { tallerId } = useAuth();
  const [nombre, setNombre] = useState('');
  const [errorCarga, setErrorCarga] = useState('');

  useEffect(() => {
    if (!tallerId) return;
    getDoc(doc(db, 'talleres', tallerId))
      .then((snap) => {
        if (snap.exists()) setNombre(snap.data().nombre || '');
        else setErrorCarga('No encontramos los datos de tu taller.');
      })
      .catch(() => setErrorCarga('No pudimos cargar los datos de tu taller. Intenta recargar la página.'));
  }, [tallerId]);

  async function cerrarSesion() {
    await signOut(auth);
    router.push('/panel');
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ maxWidth: '420px', width: '100%', backgroundColor: '#fff', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', textAlign: 'center' }}>
        <p style={{ fontSize: '13px', color: '#E8720C', letterSpacing: '2px', fontWeight: 'bold', marginBottom: '8px' }}>PANEL DEL TALLER</p>
        <h1 style={{ fontSize: '22px', color: '#1A3C5E', margin: '0 0 16px' }}>{nombre || 'Tu taller'}</h1>
        {errorCarga && <p role="alert" style={{ color: '#D85A30', fontSize: '13px' }}>{errorCarga}</p>}
        <p style={{ fontSize: '15px', color: '#555', margin: '16px 0 24px' }}>Próximamente: cotizaciones</p>
        <button onClick={cerrarSesion} style={{ background: 'none', border: '1px solid #DDD', borderRadius: '10px', padding: '10px 18px', fontSize: '14px', color: '#555', cursor: 'pointer' }}>
          Cerrar sesión
        </button>
      </div>
    </main>
  );
}
