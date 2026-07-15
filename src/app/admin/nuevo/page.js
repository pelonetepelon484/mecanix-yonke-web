'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const CIUDADES_BC = [
  { key: 'tijuana', label: 'Tijuana' },
  { key: 'mexicali', label: 'Mexicali' },
  { key: 'ensenada', label: 'Ensenada' },
  { key: 'tecate', label: 'Tecate' },
  { key: 'rosarito', label: 'Playas de Rosarito' },
  { key: 'sanquintin', label: 'San Quintín' },
];

export default function NuevoYonkePage() {
  const router = useRouter();

  const [guardando, setGuardando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [ciudad, setCiudad] = useState('tijuana');
  const [telefono, setTelefono] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [plan, setPlan] = useState('freemium');
  const [activo, setActivo] = useState(true);

  async function guardar() {
    if (!nombre || !direccion || !telefono) {
      alert('Llena nombre, dirección y teléfono'); return;
    }
    setGuardando(true);
    try {
      await addDoc(collection(db, 'yonkes'), {
        nombre: nombre.trim(),
        direccion: direccion.trim(),
        ciudad,
        telefono: telefono.trim(),
        whatsapp: whatsapp.trim() || telefono.trim(),
        email: email.trim(),
        plan,
        activo,
        metodosPago: [],
        fechaRegistro: new Date(),
      });
      alert('✅ Yonke creado correctamente');
      router.push('/admin');
    } catch (error) {
      console.error(error);
      alert('No se pudo crear el yonke');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F0F2F5', fontFamily: "'Inter', sans-serif", paddingBottom: '40px' }}>
      <div style={{ backgroundColor: '#1A3C5E', padding: '20px 16px', paddingTop: '24px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: '#E8720C', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold', padding: 0 }}>
            ← Volver
          </button>
          <h1 style={{ color: '#fff', fontSize: '18px', margin: '4px 0 0', fontWeight: '700' }}>Registrar nuevo yonke</h1>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>

        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Información del negocio</h2>

          <p style={labelStyle}>Nombre *</p>
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del yonke" style={inputStyle} />

          <p style={labelStyle}>Ciudad *</p>
          <select value={ciudad} onChange={(e) => setCiudad(e.target.value)} style={inputStyle}>
            {CIUDADES_BC.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>

          <p style={labelStyle}>Dirección *</p>
          <input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Dirección completa" style={inputStyle} />

          <p style={labelStyle}>Teléfono *</p>
          <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="664 000 0000" style={inputStyle} />

          <p style={labelStyle}>WhatsApp</p>
          <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="664 000 0000" style={inputStyle} />

          <p style={labelStyle}>Correo electrónico</p>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" style={inputStyle} />
        </div>

        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Plan y estado</h2>

          <p style={labelStyle}>Plan</p>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            {['freemium', 'premium'].map(p => (
              <button key={p} onClick={() => setPlan(p)} style={{
                flex: 1, padding: '12px', borderRadius: '10px', border: '2px solid',
                borderColor: plan === p ? (p === 'premium' ? '#E8720C' : '#1A3C5E') : '#ddd',
                backgroundColor: plan === p ? (p === 'premium' ? '#FEF3EC' : '#EEF2F7') : '#F8F9FA',
                color: plan === p ? '#1A3C5E' : '#888', fontWeight: '700', cursor: 'pointer', fontSize: '14px',
              }}>
                {p === 'premium' ? '⭐ Premium' : '🆓 Básico'}
              </button>
            ))}
          </div>

          <p style={labelStyle}>Estado</p>
          <div style={{ display: 'flex', gap: '10px' }}>
            {[true, false].map(v => (
              <button key={String(v)} onClick={() => setActivo(v)} style={{
                flex: 1, padding: '12px', borderRadius: '10px', border: '2px solid',
                borderColor: activo === v ? (v ? '#2E7D32' : '#C62828') : '#ddd',
                backgroundColor: activo === v ? (v ? '#E8F5E9' : '#FDECEA') : '#F8F9FA',
                color: activo === v ? (v ? '#2E7D32' : '#C62828') : '#888',
                fontWeight: '700', cursor: 'pointer', fontSize: '14px',
              }}>
                {v ? '✓ Activo' : '✗ Inactivo'}
              </button>
            ))}
          </div>
        </div>

        <button onClick={guardar} disabled={guardando} style={{ ...primaryButtonStyle, marginTop: '8px' }}>
          {guardando ? 'Creando...' : '+ Crear yonke'}
        </button>

      </div>
    </main>
  );
}

const sectionStyle = { backgroundColor: '#fff', borderRadius: '16px', padding: '18px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(26,60,94,0.06)' };
const sectionTitleStyle = { fontSize: '16px', fontWeight: '700', color: '#1A3C5E', marginBottom: '14px' };
const labelStyle = { fontSize: '13px', color: '#666', marginBottom: '6px', marginTop: '12px' };
const inputStyle = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '15px', backgroundColor: '#F8F9FA', color: '#333', boxSizing: 'border-box', marginBottom: '4px', fontFamily: "'Inter', sans-serif" };
const primaryButtonStyle = { width: '100%', padding: '16px', borderRadius: '10px', border: 'none', backgroundColor: '#E8720C', color: '#fff', fontWeight: '700', fontSize: '16px', cursor: 'pointer', fontFamily: "'Inter', sans-serif" };
