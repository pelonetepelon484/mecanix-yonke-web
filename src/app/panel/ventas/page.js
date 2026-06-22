'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../../lib/firebase';
import { useAuth } from '../AuthContext';
import BottomNav from '../BottomNav';

export default function VentasPanel() {
  const router = useRouter();
  const { user, yonkeId, yonkePlan, loading } = useAuth();

  const [ventas, setVentas] = useState([]);
  const [loadingVentas, setLoadingVentas] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      const timer = setTimeout(() => router.push('/panel'), 1500);
      return () => clearTimeout(timer);
    }
  }, [user, loading]);

  useEffect(() => {
    if (!yonkeId || yonkePlan !== 'premium') return;
    const ref = collection(db, 'ventas');
    const q = query(ref, where('yonkeId', '==', yonkeId), orderBy('fecha', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setVentas(lista);
      setLoadingVentas(false);
    });
    return unsubscribe;
  }, [yonkeId, yonkePlan]);

  const totalGeneral = ventas.reduce((sum, v) => sum + (v.monto || 0), 0);

  const hoy = new Date();
  const totalHoy = ventas
    .filter(v => {
      const fechaVenta = v.fecha?.toDate ? v.fecha.toDate() : new Date(v.fecha);
      return fechaVenta.toDateString() === hoy.toDateString();
    })
    .reduce((sum, v) => sum + (v.monto || 0), 0);

  function formatearFecha(fecha) {
    const f = fecha?.toDate ? fecha.toDate() : new Date(fecha);
    return f.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  async function handleLogout() {
    await signOut(auth);
    router.push('/panel');
  }

  if (loading || !user) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A3C5E' }}>
        <p style={{ color: '#fff' }}>Cargando...</p>
      </main>
    );
  }

  // Pantalla de bloqueo para plan freemium
  if (yonkePlan !== 'premium') {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', paddingBottom: '70px' }}>
        <div style={{ backgroundColor: '#1A3C5E', padding: '20px 16px', paddingTop: '24px' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h1 style={{ color: '#fff', fontSize: '20px', margin: 0, fontWeight: 'bold' }}>Mis ventas</h1>
          </div>
        </div>
        <div style={lockContainerStyle}>
          <p style={{ fontSize: '64px', margin: '0 0 16px' }}>🔒</p>
          <h2 style={lockTituloStyle}>Función Premium</h2>
          <p style={lockMensajeStyle}>
            El historial y registro de ventas está disponible en el plan Premium.
          </p>
          <p style={lockContactoStyle}>
            Comunícate con nosotros para activar tu plan Premium y acceder a todas las funciones.
          </p>
          <a href="https://wa.me/526611034260" target="_blank" rel="noopener noreferrer" style={lockBotonStyle}>
            💬 Contactar por WhatsApp
          </a>
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', paddingBottom: '70px' }}>
      <div style={{ backgroundColor: '#1A3C5E', padding: '20px 16px', paddingTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '600px', margin: '0 auto' }}>
          <h1 style={{ color: '#fff', fontSize: '20px', margin: 0, fontWeight: 'bold' }}>Mis ventas</h1>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#E8720C', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <div style={resumenCardStyle}>
            <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>Hoy</p>
            <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#E8720C', margin: '4px 0 0' }}>
              ${totalHoy.toLocaleString('es-MX')}
            </p>
          </div>
          <div style={resumenCardStyle}>
            <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>Total acumulado</p>
            <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#E8720C', margin: '4px 0 0' }}>
              ${totalGeneral.toLocaleString('es-MX')}
            </p>
          </div>
        </div>

        {loadingVentas ? (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '32px' }}>Cargando...</p>
        ) : ventas.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '32px' }}>Aún no tienes ventas registradas</p>
        ) : (
          ventas.map((v) => (
            <div key={v.id} style={ventaCardStyle}>
              <div>
                <p style={{ fontWeight: 'bold', color: '#1A3C5E', fontSize: '15px', margin: 0 }}>
                  {v.piezaVendida}
                </p>
                <p style={{ color: '#888', fontSize: '13px', margin: '2px 0 0' }}>
                  {v.vehiculo?.marca} {v.vehiculo?.modelo} {v.vehiculo?.ano}
                </p>
                <p style={{ color: '#aaa', fontSize: '12px', marginTop: '4px' }}>{formatearFecha(v.fecha)}</p>
              </div>
              <p style={{ fontSize: '17px', fontWeight: 'bold', color: '#1A3C5E' }}>
                ${v.monto?.toLocaleString('es-MX')}
              </p>
            </div>
          ))
        )}
      </div>

      <BottomNav />
    </main>
  );
}

const resumenCardStyle = {
  flex: 1, backgroundColor: '#fff', borderRadius: '12px', padding: '16px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
};
const ventaCardStyle = {
  backgroundColor: '#fff', borderRadius: '10px', padding: '16px', marginBottom: '12px',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
};
const lockContainerStyle = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  padding: '48px 32px', textAlign: 'center', maxWidth: '400px', margin: '0 auto',
};
const lockTituloStyle = {
  fontSize: '22px', fontWeight: 'bold', color: '#1A3C5E', marginBottom: '12px',
};
const lockMensajeStyle = {
  fontSize: '15px', color: '#555', lineHeight: '1.6', marginBottom: '12px',
};
const lockContactoStyle = {
  fontSize: '13px', color: '#888', lineHeight: '1.6', marginBottom: '24px',
};
const lockBotonStyle = {
  backgroundColor: '#25D366', color: '#fff', fontWeight: 'bold', fontSize: '14px',
  padding: '12px 24px', borderRadius: '24px', textDecoration: 'none', display: 'inline-block',
};