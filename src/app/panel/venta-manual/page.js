'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, getDocs, addDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../../lib/firebase';
import { useAuth } from '../AuthContext';
import BottomNav from '../BottomNav';

export default function VentaManualPanel() {
  const router = useRouter();
  const { user, yonkeId, loading } = useAuth();

  const [vehiculos, setVehiculos] = useState([]);
  const [loadingVehiculos, setLoadingVehiculos] = useState(true);

  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState(null);
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [piezaVendida, setPiezaVendida] = useState('');
  const [monto, setMonto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [folioGenerado, setFolioGenerado] = useState(null);

  useEffect(() => {
    if (!loading && !user) {
      const timer = setTimeout(() => router.push('/panel'), 1500);
      return () => clearTimeout(timer);
    }
  }, [user, loading]);

  useEffect(() => {
    async function cargarVehiculos() {
      if (!yonkeId) return;
      try {
        const ref = collection(db, 'yonkes', yonkeId, 'vehiculos');
        const q = query(ref, orderBy('marca'));
        const snap = await getDocs(q);
        const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setVehiculos(lista);
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingVehiculos(false);
      }
    }
    cargarVehiculos();
  }, [yonkeId]);

  function generarFolioManual() {
    const random = Math.floor(1000 + Math.random() * 9000);
    const fecha = new Date();
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    return `VM-${mes}${dia}-${random}`;
  }

  async function registrarVenta() {
    if (!vehiculoSeleccionado) {
      alert('Selecciona el vehículo del que vendiste la pieza');
      return;
    }
    if (!piezaVendida.trim()) {
      alert('Escribe qué pieza vendiste');
      return;
    }
    if (!monto || isNaN(parseFloat(monto))) {
      alert('Escribe un monto válido');
      return;
    }

    setGuardando(true);
    try {
      const folio = generarFolioManual();

      await addDoc(collection(db, 'ventas'), {
        numeroPedido: folio,
        yonkeId,
        origen: 'manual',
        piezaVendida: piezaVendida.trim(),
        vehiculo: {
          marca: vehiculoSeleccionado.marca,
          modelo: vehiculoSeleccionado.modelo,
          ano: vehiculoSeleccionado.ano,
        },
        monto: parseFloat(monto),
        fecha: new Date(),
      });

      setFolioGenerado(folio);
    } catch (error) {
      console.error(error);
      alert('No se pudo registrar la venta');
    } finally {
      setGuardando(false);
    }
  }

  function registrarOtra() {
    setVehiculoSeleccionado(null);
    setPiezaVendida('');
    setMonto('');
    setFolioGenerado(null);
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

  if (folioGenerado) {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', paddingBottom: '70px' }}>
        <div style={{ backgroundColor: '#1A3C5E', padding: '20px 16px', paddingTop: '24px' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h1 style={{ color: '#fff', fontSize: '20px', margin: 0, fontWeight: 'bold' }}>Venta manual</h1>
          </div>
        </div>

        <div style={{ maxWidth: '420px', margin: '40px auto', padding: '16px', textAlign: 'center' }}>
          <p style={{ fontSize: '48px', margin: '0 0 12px' }}>✅</p>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1A3C5E', marginBottom: '6px' }}>¡Venta registrada!</h2>
          <p style={{ fontSize: '14px', color: '#888', marginBottom: '16px' }}>Folio de la venta:</p>
          <div style={{ backgroundColor: '#1A3C5E', color: '#fff', fontSize: '22px', fontWeight: 'bold', padding: '16px', borderRadius: '10px', letterSpacing: '1px', marginBottom: '24px' }}>
            {folioGenerado}
          </div>

          <button onClick={registrarOtra} style={{ ...secondaryButtonStyle, marginBottom: '12px' }}>
            Registrar otra venta
          </button>
          <button onClick={() => router.push('/panel/inventario')} style={primaryButtonStyle}>
            Listo
          </button>
        </div>

        <BottomNav />
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', paddingBottom: '70px' }}>
      <div style={{ backgroundColor: '#1A3C5E', padding: '20px 16px', paddingTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '600px', margin: '0 auto' }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: '20px', margin: 0, fontWeight: 'bold' }}>Venta manual</h1>
            <p style={{ color: '#ccc', fontSize: '13px', margin: '2px 0 0' }}>Registra ventas hechas fuera de la plataforma</p>
          </div>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#E8720C', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
        <div style={sectionStyle}>
          <p style={labelStyle}>Vehículo</p>
          {loadingVehiculos ? (
            <p style={{ color: '#888' }}>Cargando...</p>
          ) : (
            <button onClick={() => setSelectorVisible(true)} style={selectorButtonStyle}>
              {vehiculoSeleccionado
                ? `${vehiculoSeleccionado.marca} ${vehiculoSeleccionado.modelo} ${vehiculoSeleccionado.ano}`
                : 'Selecciona un vehículo de tu inventario'}
            </button>
          )}

          <p style={labelStyle}>Pieza vendida</p>
          <input
            type="text"
            value={piezaVendida}
            onChange={(e) => setPiezaVendida(e.target.value)}
            placeholder="Ej. Espejo lateral izquierdo"
            style={inputStyle}
          />

          <p style={labelStyle}>Monto de la venta</p>
          <input
            type="number"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="Monto en pesos"
            style={inputStyle}
          />

          <button onClick={registrarVenta} disabled={guardando} style={{ ...primaryButtonStyle, marginTop: '20px' }}>
            {guardando ? 'Guardando...' : 'Registrar venta'}
          </button>
        </div>
      </div>

      {selectorVisible && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ color: '#1A3C5E', fontSize: '18px', marginBottom: '16px' }}>Selecciona el vehículo</h2>
            {vehiculos.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#888', padding: '20px 0' }}>No tienes vehículos en tu inventario</p>
            ) : (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {vehiculos.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => {
                      setVehiculoSeleccionado(v);
                      setSelectorVisible(false);
                    }}
                    style={vehiculoOpcionStyle}
                  >
                    {v.marca} {v.modelo} {v.ano}
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setSelectorVisible(false)} style={{ ...secondaryButtonStyle, marginTop: '16px' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  );
}

const sectionStyle = {
  backgroundColor: '#fff', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
};

const labelStyle = {
  fontSize: '13px', color: '#666', marginBottom: '6px', marginTop: '12px',
};

const inputStyle = {
  width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd',
  fontSize: '15px', backgroundColor: '#F4F5F5', color: '#333', boxSizing: 'border-box',
};

const selectorButtonStyle = {
  width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd',
  backgroundColor: '#F4F5F5', color: '#888', fontSize: '15px', textAlign: 'left', cursor: 'pointer',
};

const primaryButtonStyle = {
  width: '100%', padding: '14px', borderRadius: '10px', border: 'none', backgroundColor: '#E8720C',
  color: '#fff', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer',
};

const secondaryButtonStyle = {
  width: '100%', padding: '14px', borderRadius: '10px', border: '1.5px solid #1A3C5E',
  backgroundColor: '#fff', color: '#1A3C5E', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer',
};

const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1000,
};

const modalStyle = {
  backgroundColor: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '420px', width: '100%',
};

const vehiculoOpcionStyle = {
  padding: '14px 0', borderBottom: '1px solid #F4F5F5', fontSize: '15px', color: '#333', cursor: 'pointer',
};