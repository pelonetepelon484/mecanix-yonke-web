'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../../lib/firebase';
import { useAuth } from '../AuthContext';

const METODOS_PAGO = [
  { key: 'efectivo', label: 'Efectivo' },
  { key: 'tarjeta', label: 'Tarjeta (débito/crédito)' },
  { key: 'transferencia', label: 'Transferencia bancaria' },
  { key: 'spei', label: 'SPEI' },
  { key: 'codi', label: 'CoDi' },
  { key: 'zelle', label: 'Zelle' },
  { key: 'paypal', label: 'PayPal' },
];

export default function PerfilPanel() {
  const router = useRouter();
  const { user, yonkeId, loading } = useAuth();

  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [metodosPago, setMetodosPago] = useState([]);
  const [loadingPerfil, setLoadingPerfil] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      const timer = setTimeout(() => router.push('/panel'), 1500);
      return () => clearTimeout(timer);
    }
  }, [user, loading]);

  useEffect(() => {
    async function cargarPerfil() {
      if (!yonkeId) return;
      const ref = doc(db, 'yonkes', yonkeId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setNombre(data.nombre || '');
        setDireccion(data.direccion || '');
        setTelefono(data.telefono || '');
        setMetodosPago(data.metodosPago || []);
      }
      setLoadingPerfil(false);
    }
    cargarPerfil();
  }, [yonkeId]);

  function toggleMetodo(key) {
    setMetodosPago(prev =>
      prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key]
    );
  }

  async function guardarPerfil() {
    if (!nombre || !direccion || !telefono) {
      alert('Llena nombre, dirección y teléfono');
      return;
    }
    setGuardando(true);
    try {
      const ref = doc(db, 'yonkes', yonkeId);
      await setDoc(ref, {
        nombre: nombre.trim(),
        direccion: direccion.trim(),
        telefono: telefono.trim(),
        metodosPago,
      }, { merge: true });
      alert('Tu perfil se guardó correctamente');
    } catch (error) {
      console.error(error);
      alert('No se pudo guardar el perfil');
    } finally {
      setGuardando(false);
    }
  }

  async function handleLogout() {
    await signOut(auth);
    router.push('/panel');
  }

  if (loading || !user || loadingPerfil) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A3C5E' }}>
        <p style={{ color: '#fff' }}>Cargando...</p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5' }}>
      <div style={{ backgroundColor: '#1A3C5E', padding: '20px 16px', paddingTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '600px', margin: '0 auto' }}>
          <h1 style={{ color: '#fff', fontSize: '20px', margin: 0, fontWeight: 'bold' }}>Mi negocio</h1>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#E8720C', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
        <div style={sectionStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1A3C5E', marginBottom: '12px' }}>
            Información del negocio
          </h2>

          <p style={labelStyle}>Nombre del yonke</p>
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Yonke El Tigre" style={inputStyle} />

          <p style={labelStyle}>Dirección</p>
          <input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle, colonia, referencias" style={inputStyle} />

          <p style={labelStyle}>Teléfono</p>
          <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="664 000 0000" style={inputStyle} />
        </div>

        <div style={sectionStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1A3C5E', marginBottom: '4px' }}>
            Métodos de pago que aceptas
          </h2>
          <p style={{ fontSize: '13px', color: '#888', marginBottom: '14px' }}>
            El cliente verá esto antes de visitarte
          </p>

          {METODOS_PAGO.map((metodo) => {
            const activo = metodosPago.includes(metodo.key);
            return (
              <label key={metodo.key} style={checkboxRowStyle}>
                <input
                  type="checkbox"
                  checked={activo}
                  onChange={() => toggleMetodo(metodo.key)}
                  style={{ width: '18px', height: '18px', marginRight: '12px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '15px', color: '#333' }}>{metodo.label}</span>
              </label>
            );
          })}
        </div>

        <button onClick={guardarPerfil} disabled={guardando} style={saveButtonStyle}>
          {guardando ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </main>
  );
}

const sectionStyle = {
  backgroundColor: '#fff',
  borderRadius: '12px',
  padding: '18px',
  marginBottom: '16px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
};

const labelStyle = {
  fontSize: '13px',
  color: '#666',
  marginBottom: '6px',
  marginTop: '12px',
};

const inputStyle = {
  width: '100%',
  padding: '12px',
  borderRadius: '8px',
  border: '1px solid #ddd',
  fontSize: '15px',
  backgroundColor: '#F4F5F5',
  color: '#333',
  boxSizing: 'border-box',
};

const checkboxRowStyle = {
  display: 'flex',
  alignItems: 'center',
  padding: '10px 0',
  cursor: 'pointer',
};

const saveButtonStyle = {
  width: '100%',
  padding: '16px',
  borderRadius: '10px',
  border: 'none',
  backgroundColor: '#E8720C',
  color: '#fff',
  fontWeight: 'bold',
  fontSize: '16px',
  cursor: 'pointer',
  marginBottom: '40px',
};