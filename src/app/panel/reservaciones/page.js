'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection, query, where, onSnapshot, orderBy, doc, updateDoc, addDoc
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../../lib/firebase';
import { useAuth } from '../AuthContext';
import BottomNav from '../BottomNav';

export default function ReservacionesPanel() {
  const router = useRouter();
  const { user, yonkeId, yonkePlan, loading } = useAuth();

  const [reservaciones, setReservaciones] = useState([]);
  const [loadingReservas, setLoadingReservas] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [reservaSeleccionada, setReservaSeleccionada] = useState(null);
  const [montoVenta, setMontoVenta] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      const timer = setTimeout(() => router.push('/panel'), 1500);
      return () => clearTimeout(timer);
    }
  }, [user, loading]);

  useEffect(() => {
    if (!yonkeId || yonkePlan !== 'premium') return;
    const ref = collection(db, 'reservaciones');
    const q = query(
      ref,
      where('yonkeId', '==', yonkeId),
      where('estado', '==', 'pendiente'),
      orderBy('fecha', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setReservaciones(lista);
      setLoadingReservas(false);
    });
    return unsubscribe;
  }, [yonkeId, yonkePlan]);

  function abrirModalConfirmar(reserva) {
    setReservaSeleccionada(reserva);
    setMontoVenta('');
    setModalVisible(true);
  }

  async function confirmarVenta() {
    if (!montoVenta || isNaN(parseFloat(montoVenta))) {
      alert('Ingresa un monto válido');
      return;
    }
    setGuardando(true);
    try {
      await addDoc(collection(db, 'ventas'), {
        reservaId: reservaSeleccionada.id,
        yonkeId,
        numeroPedido: reservaSeleccionada.numeroPedido,
        nombreCliente: reservaSeleccionada.nombreCliente,
        piezaVendida: reservaSeleccionada.piezaSolicitada,
        vehiculo: reservaSeleccionada.vehiculo,
        monto: parseFloat(montoVenta),
        fecha: new Date(),
      });

      await updateDoc(doc(db, 'reservaciones', reservaSeleccionada.id), {
        estado: 'completada',
      });

      setModalVisible(false);
      alert('¡Venta registrada correctamente!');
    } catch (error) {
      console.error(error);
      alert('No se pudo confirmar la venta');
    } finally {
      setGuardando(false);
    }
  }

  async function cancelarReservacion(reservaId) {
    if (!confirm('¿El cliente no se presentó o ya no quiere la pieza?')) return;
    await updateDoc(doc(db, 'reservaciones', reservaId), { estado: 'cancelada' });
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
            <h1 style={{ color: '#fff', fontSize: '20px', margin: 0, fontWeight: 'bold' }}>Reservaciones</h1>
          </div>
        </div>
        <div style={lockContainerStyle}>
          <p style={{ fontSize: '64px', margin: '0 0 16px' }}>🔒</p>
          <h2 style={lockTituloStyle}>Función Premium</h2>
          <p style={lockMensajeStyle}>
            La gestión de reservaciones está disponible en el plan Premium.
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
          <h1 style={{ color: '#fff', fontSize: '20px', margin: 0, fontWeight: 'bold' }}>Reservaciones</h1>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#E8720C', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
        {loadingReservas ? (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '32px' }}>Cargando...</p>
        ) : reservaciones.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '32px' }}>No tienes reservaciones pendientes</p>
        ) : (
          reservaciones.map((r) => (
            <div key={r.id} style={cardStyle}>
              <div style={{ backgroundColor: '#1A3C5E', color: '#fff', fontSize: '12px', fontWeight: 'bold', padding: '4px 10px', borderRadius: '6px', display: 'inline-block', marginBottom: '8px' }}>
                {r.numeroPedido}
              </div>
              <p style={{ fontWeight: 'bold', color: '#1A3C5E', fontSize: '16px', margin: 0 }}>
                {r.piezaSolicitada}
              </p>
              <p style={{ color: '#888', fontSize: '13px', margin: '2px 0 0' }}>
                {r.vehiculo?.marca} {r.vehiculo?.modelo} {r.vehiculo?.ano}
              </p>
              <p style={{ color: '#666', fontSize: '13px', marginTop: '8px' }}>👤 {r.nombreCliente}</p>
              <p style={{ color: '#666', fontSize: '13px', marginTop: '2px' }}>📞 {r.telefonoCliente}</p>

              <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                <button onClick={() => cancelarReservacion(r.id)} style={cancelButtonStyle}>
                  Cancelar
                </button>
                <button onClick={() => abrirModalConfirmar(r)} style={confirmButtonStyle}>
                  Confirmar entrega
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {modalVisible && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ color: '#1A3C5E', fontSize: '18px', marginBottom: '4px' }}>Confirmar entrega</h2>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '16px' }}>{reservaSeleccionada?.piezaSolicitada}</p>

            <p style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>¿En cuánto se vendió la pieza?</p>
            <input
              type="number"
              placeholder="Monto en pesos"
              value={montoVenta}
              onChange={(e) => setMontoVenta(e.target.value)}
              style={inputStyle}
            />

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button onClick={() => setModalVisible(false)} style={cancelButtonStyle}>Cancelar</button>
              <button onClick={confirmarVenta} disabled={guardando} style={confirmButtonStyle}>
                {guardando ? 'Guardando...' : 'Confirmar venta'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  );
}

const inputStyle = {
  width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '12px',
  fontSize: '15px', backgroundColor: '#F4F5F5', color: '#333', boxSizing: 'border-box',
};
const cardStyle = {
  backgroundColor: '#fff', borderRadius: '12px', padding: '16px', marginBottom: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
};
const cancelButtonStyle = {
  flex: 1, padding: '10px', borderRadius: '8px', border: 'none', backgroundColor: '#F4F5F5',
  color: '#D85A30', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer',
};
const confirmButtonStyle = {
  flex: 1, padding: '10px', borderRadius: '8px', border: 'none', backgroundColor: '#E8720C',
  color: '#fff', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer',
};
const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1000,
};
const modalStyle = {
  backgroundColor: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '420px', width: '100%',
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