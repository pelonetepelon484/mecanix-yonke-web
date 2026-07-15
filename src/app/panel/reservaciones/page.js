'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection, query, where, onSnapshot, orderBy, doc, updateDoc, addDoc, deleteDoc
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../../lib/firebase';
import { useAuth } from '../AuthContext';
import BottomNav from '../BottomNav';

const DIAS_EXPIRACION = 3;

export default function ReservacionesPanel() {
  const router = useRouter();
  const { user, yonkeId, loading } = useAuth();

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
    if (!yonkeId) return;
    const ref = collection(db, 'reservaciones');
    const q = query(
      ref,
      where('yonkeId', '==', yonkeId),
      where('estado', '==', 'pendiente'),
      orderBy('fecha', 'desc')
    );
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const lista = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      // Marcar como expiradas las de más de 3 días
      const ahora = new Date();
      for (const reserva of lista) {
        const fechaReserva = reserva.fecha?.toDate ? reserva.fecha.toDate() : new Date(reserva.fecha);
        const diasTranscurridos = (ahora - fechaReserva) / (1000 * 60 * 60 * 24);
        if (diasTranscurridos > DIAS_EXPIRACION && reserva.estado === 'pendiente') {
          await updateDoc(doc(db, 'reservaciones', reserva.id), { estado: 'expirada' });
        }
      }

      setReservaciones(lista);
      setLoadingReservas(false);
    });
    return unsubscribe;
  }, [yonkeId]);

  function estaExpirada(reserva) {
    const fechaReserva = reserva.fecha?.toDate ? reserva.fecha.toDate() : new Date(reserva.fecha);
    const diasTranscurridos = (new Date() - fechaReserva) / (1000 * 60 * 60 * 24);
    return diasTranscurridos > DIAS_EXPIRACION;
  }

  function diasRestantes(reserva) {
    const fechaReserva = reserva.fecha?.toDate ? reserva.fecha.toDate() : new Date(reserva.fecha);
    const diasTranscurridos = (new Date() - fechaReserva) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.ceil(DIAS_EXPIRACION - diasTranscurridos));
  }

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
      await updateDoc(doc(db, 'reservaciones', reservaSeleccionada.id), { estado: 'completada' });
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

  async function eliminarReservacion(reservaId) {
    if (!confirm('¿Eliminar esta reservación expirada?')) return;
    await deleteDoc(doc(db, 'reservaciones', reservaId));
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

  const reservacionesVigentes = reservaciones.filter(r => !estaExpirada(r));
  const reservacionesExpiradas = reservaciones.filter(r => estaExpirada(r));

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', paddingBottom: '70px' }}>
      <div style={{ backgroundColor: '#1A3C5E', padding: '20px 16px', paddingTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '600px', margin: '0 auto' }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: '20px', margin: 0, fontWeight: 'bold' }}>Reservaciones</h1>
            {!loadingReservas && (
              <p style={{ color: '#cdd9e4', fontSize: '13px', margin: '4px 0 0' }}>
                {reservacionesVigentes.length} pendiente{reservacionesVigentes.length !== 1 ? 's' : ''}
                {reservacionesExpiradas.length > 0 && ` · ${reservacionesExpiradas.length} expirada${reservacionesExpiradas.length !== 1 ? 's' : ''}`}
              </p>
            )}
          </div>
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
          <>
            {/* Reservaciones vigentes */}
            {reservacionesVigentes.map((r) => {
              const restantes = diasRestantes(r);
              return (
                <div key={r.id} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ backgroundColor: '#1A3C5E', color: '#fff', fontSize: '12px', fontWeight: 'bold', padding: '4px 10px', borderRadius: '6px', display: 'inline-block' }}>
                      {r.numeroPedido}
                    </div>
                    {restantes <= 1 && (
                      <span style={{ backgroundColor: '#FFF3CD', color: '#856404', fontSize: '11px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '6px' }}>
                        ⚠️ Expira {restantes === 0 ? 'hoy' : 'mañana'}
                      </span>
                    )}
                  </div>
                  <p style={{ fontWeight: 'bold', color: '#1A3C5E', fontSize: '16px', margin: 0 }}>
                    {r.piezaSolicitada}
                  </p>
                  <p style={{ color: '#888', fontSize: '13px', margin: '2px 0 0' }}>
                    {r.vehiculo?.marca} {r.vehiculo?.modelo} {r.vehiculo?.ano}
                  </p>
                  <p style={{ color: '#666', fontSize: '13px', marginTop: '8px' }}>👤 {r.nombreCliente}</p>
                  <p style={{ color: '#666', fontSize: '13px', marginTop: '2px' }}>📞 {r.telefonoCliente}</p>
                  <p style={{ color: '#aaa', fontSize: '12px', marginTop: '4px' }}>
                    🕐 Expira en {restantes} día{restantes !== 1 ? 's' : ''}
                  </p>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                    <button onClick={() => cancelarReservacion(r.id)} style={cancelButtonStyle}>
                      Cancelar
                    </button>
                    <button onClick={() => abrirModalConfirmar(r)} style={confirmButtonStyle}>
                      Confirmar entrega
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Reservaciones expiradas */}
            {reservacionesExpiradas.length > 0 && (
              <>
                <p style={{ fontSize: '13px', fontWeight: 'bold', color: '#888', letterSpacing: '1px', margin: '20px 0 10px' }}>
                  EXPIRADAS
                </p>
                {reservacionesExpiradas.map((r) => (
                  <div key={r.id} style={{ ...cardStyle, opacity: 0.7, borderLeft: '4px solid #D85A30' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ backgroundColor: '#888', color: '#fff', fontSize: '12px', fontWeight: 'bold', padding: '4px 10px', borderRadius: '6px', display: 'inline-block' }}>
                        {r.numeroPedido}
                      </div>
                      <span style={{ backgroundColor: '#FDECEA', color: '#C62828', fontSize: '11px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '6px' }}>
                        ⏰ Expirada
                      </span>
                    </div>
                    <p style={{ fontWeight: 'bold', color: '#888', fontSize: '15px', margin: 0 }}>
                      {r.piezaSolicitada}
                    </p>
                    <p style={{ color: '#aaa', fontSize: '13px', margin: '2px 0 0' }}>
                      {r.vehiculo?.marca} {r.vehiculo?.modelo} {r.vehiculo?.ano}
                    </p>
                    <p style={{ color: '#aaa', fontSize: '13px', marginTop: '6px' }}>👤 {r.nombreCliente}</p>
                    <p style={{ color: '#aaa', fontSize: '13px', marginTop: '2px' }}>📞 {r.telefonoCliente}</p>
                    <button
                      onClick={() => eliminarReservacion(r.id)}
                      style={{ ...cancelButtonStyle, marginTop: '12px', width: '100%', color: '#C62828' }}
                    >
                      🗑️ Eliminar
                    </button>
                  </div>
                ))}
              </>
            )}
          </>
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
  backgroundColor: '#fff', borderRadius: '12px', padding: '16px', marginBottom: '14px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
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