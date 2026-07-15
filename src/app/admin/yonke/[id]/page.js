'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, setDoc, Timestamp, deleteField } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

const CIUDADES_BC = [
  { key: 'tijuana', label: 'Tijuana' },
  { key: 'mexicali', label: 'Mexicali' },
  { key: 'ensenada', label: 'Ensenada' },
  { key: 'tecate', label: 'Tecate' },
  { key: 'rosarito', label: 'Playas de Rosarito' },
  { key: 'sanquintin', label: 'San Quintín' },
];

const METODOS_PAGO = [
  { key: 'efectivo', label: 'Efectivo' },
  { key: 'tarjeta', label: 'Tarjeta (débito/crédito)' },
  { key: 'transferencia', label: 'Transferencia bancaria' },
  { key: 'spei', label: 'SPEI' },
  { key: 'codi', label: 'CoDi' },
  { key: 'zelle', label: 'Zelle' },
  { key: 'paypal', label: 'PayPal' },
];

const DIAS = [
  { key: 'lunes', label: 'Lunes' },
  { key: 'martes', label: 'Martes' },
  { key: 'miercoles', label: 'Miércoles' },
  { key: 'jueves', label: 'Jueves' },
  { key: 'viernes', label: 'Viernes' },
  { key: 'sabado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' },
];

const HORARIO_DEFAULT = {
  lunes:     { abierto: true,  apertura: '08:00', cierre: '17:00' },
  martes:    { abierto: true,  apertura: '08:00', cierre: '17:00' },
  miercoles: { abierto: true,  apertura: '08:00', cierre: '17:00' },
  jueves:    { abierto: true,  apertura: '08:00', cierre: '17:00' },
  viernes:   { abierto: true,  apertura: '08:00', cierre: '17:00' },
  sabado:    { abierto: true,  apertura: '08:00', cierre: '14:00' },
  domingo:   { abierto: false, apertura: '09:00', cierre: '13:00' },
};

function formatearFechaInput(fecha) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function EditarYonkePage() {
  const router = useRouter();
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [ciudad, setCiudad] = useState('tijuana');
  const [telefono, setTelefono] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [plan, setPlan] = useState('freemium');
  const [premiumHasta, setPremiumHasta] = useState('');
  const [activo, setActivo] = useState(true);
  const [metodosPago, setMetodosPago] = useState([]);
  const [horario, setHorario] = useState(HORARIO_DEFAULT);

  useEffect(() => {
    async function cargarYonke() {
      const ref = doc(db, 'yonkes', id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setNombre(data.nombre || '');
        setDireccion(data.direccion || '');
        setCiudad(data.ciudad || 'tijuana');
        setTelefono(data.telefono || '');
        setWhatsapp(data.whatsapp || '');
        setEmail(data.email || '');
        setPlan(data.plan || 'freemium');
        if (data.premiumHasta) {
          const fecha = data.premiumHasta?.toDate ? data.premiumHasta.toDate() : new Date(data.premiumHasta);
          setPremiumHasta(formatearFechaInput(fecha));
        }
        setActivo(data.activo !== false);
        setMetodosPago(data.metodosPago || []);
        setHorario(data.horario || HORARIO_DEFAULT);
      }
      setLoading(false);
    }
    cargarYonke();
  }, [id]);

  function toggleMetodo(key) {
    setMetodosPago(prev =>
      prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key]
    );
  }

  function toggleDia(dia) {
    setHorario(prev => ({
      ...prev,
      [dia]: { ...prev[dia], abierto: !prev[dia].abierto }
    }));
  }

  function actualizarHora(dia, campo, valor) {
    const limpio = valor.replace(/[^0-9:]/g, '');
    setHorario(prev => ({
      ...prev,
      [dia]: { ...prev[dia], [campo]: limpio }
    }));
  }

  async function guardar() {
    if (!nombre || !direccion || !telefono) {
      alert('Llena nombre, dirección y teléfono'); return;
    }
    setGuardando(true);
    try {
      await setDoc(doc(db, 'yonkes', id), {
        nombre: nombre.trim(),
        direccion: direccion.trim(),
        ciudad,
        telefono: telefono.trim(),
        whatsapp: whatsapp.trim() || telefono.trim(),
        email: email.trim(),
        plan,
        premiumHasta: plan === 'premium' && premiumHasta
          ? Timestamp.fromDate(new Date(`${premiumHasta}T00:00:00`))
          : deleteField(),
        activo,
        metodosPago,
        horario,
      }, { merge: true });
      alert('✅ Yonke actualizado correctamente');
      router.push('/admin');
    } catch (error) {
      console.error(error);
      alert('No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A3C5E' }}>
        <p style={{ color: '#fff' }}>Cargando...</p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F0F2F5', fontFamily: "'Inter', sans-serif", paddingBottom: '40px' }}>
      <div style={{ backgroundColor: '#1A3C5E', padding: '20px 16px', paddingTop: '24px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: '#E8720C', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold', padding: 0 }}>
              ← Volver
            </button>
            <h1 style={{ color: '#fff', fontSize: '18px', margin: '4px 0 0', fontWeight: '700' }}>Editar yonke</h1>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>

        {/* Info básica */}
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

        {/* Plan y estado */}
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

          {plan === 'premium' && (
            <>
              <p style={labelStyle}>Premium vence el</p>
              <input
                type="date"
                value={premiumHasta}
                onChange={(e) => setPremiumHasta(e.target.value)}
                style={inputStyle}
              />
            </>
          )}

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

        {/* Métodos de pago */}
        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Métodos de pago</h2>
          {METODOS_PAGO.map(m => {
            const actv = metodosPago.includes(m.key);
            return (
              <label key={m.key} style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F4F5F5', cursor: 'pointer' }}>
                <input type="checkbox" checked={actv} onChange={() => toggleMetodo(m.key)}
                  style={{ width: '18px', height: '18px', marginRight: '12px', accentColor: '#E8720C' }} />
                <span style={{ fontSize: '15px', color: '#333' }}>{m.label}</span>
              </label>
            );
          })}
        </div>

        {/* Horario */}
        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Horario de atención</h2>
          {DIAS.map(({ key, label }) => {
            const diaData = horario[key] || { abierto: false, apertura: '08:00', cierre: '17:00' };
            return (
              <div key={key} style={{ borderBottom: '1px solid #F4F5F5', paddingTop: '10px', paddingBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '15px', fontWeight: '700', color: diaData.abierto ? '#1A3C5E' : '#bbb' }}>{label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '12px', color: '#888' }}>{diaData.abierto ? 'Abierto' : 'Cerrado'}</span>
                    <input type="checkbox" checked={diaData.abierto} onChange={() => toggleDia(key)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#1A3C5E' }} />
                  </div>
                </div>
                {diaData.abierto && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>Apertura</p>
                      <input type="text" value={diaData.apertura} onChange={(e) => actualizarHora(key, 'apertura', e.target.value)}
                        placeholder="08:00" maxLength={5} style={{ ...inputStyle, textAlign: 'center', fontWeight: '700', color: '#1A3C5E', marginBottom: 0 }} />
                    </div>
                    <span style={{ fontSize: '18px', color: '#ccc', marginTop: '16px' }}>—</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>Cierre</p>
                      <input type="text" value={diaData.cierre} onChange={(e) => actualizarHora(key, 'cierre', e.target.value)}
                        placeholder="17:00" maxLength={5} style={{ ...inputStyle, textAlign: 'center', fontWeight: '700', color: '#1A3C5E', marginBottom: 0 }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button onClick={guardar} disabled={guardando} style={{ ...primaryButtonStyle, marginTop: '8px' }}>
          {guardando ? 'Guardando...' : '💾 Guardar cambios'}
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