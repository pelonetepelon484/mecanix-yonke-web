'use client';

// Talleres: lista (nombre, ciudad, activo, plan y vencimiento del Premium) y asignar o quitar el
// Premium con su fecha, igual que en la ficha de un yonke (admin/yonke/[id]). Solo admin
// (admin/layout.js) y las reglas: plan y premiumHasta solo los escribe el admin (y el usuario de
// servicio, solo para la promoción de registro). Muestra si el Premium vino de la promoción o del
// admin, con su vencimiento exacto.
// Costo: 1 lectura por taller al abrir; 1 escritura por cada "Guardar".
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { estadoPlan, ETIQUETAS_ESTADO_PLAN } from '../../../lib/planes';
import { cambiosPlan, fechaParaCampo, origenPremium, planSinCambios } from './planTaller';

function FilaTaller({ taller, onGuardado }) {
  const [plan, setPlan] = useState(taller.plan === 'premium' ? 'premium' : 'freemium');
  const [premiumHasta, setPremiumHasta] = useState(fechaParaCampo(taller.premiumHasta));
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const etiqueta = ETIQUETAS_ESTADO_PLAN[estadoPlan({ plan, premiumHasta: premiumHasta ? new Date(`${premiumHasta}T00:00:00`) : null })];

  const origen = origenPremium(taller);

  async function guardar() {
    if (planSinCambios(taller, plan, premiumHasta)) {
      setMensaje('Sin cambios.');
      return;
    }
    setGuardando(true);
    setMensaje('');
    try {
      await updateDoc(doc(db, 'talleres', taller.id), cambiosPlan(plan, premiumHasta));
      setMensaje('Guardado.');
      onGuardado();
    } catch (err) {
      console.error('[admin/talleres] No se pudo guardar el plan', err);
      setMensaje('No se pudo guardar. Revisa tu conexión y tus permisos de admin.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={tarjeta}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontWeight: '700', color: '#1A3C5E' }}>{taller.nombre || '(sin nombre)'}</p>
          <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#666' }}>
            {taller.ciudad || 'Sin ciudad'} · {taller.activo === true ? '✅ Activo' : '⛔ Desactivado'}
          </p>
          {origen && (
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#1A3C5E' }}>
              {origen.texto} · <strong>{origen.vence}</strong>
            </p>
          )}
        </div>
        <span style={{ backgroundColor: etiqueta.bg, color: etiqueta.color, fontSize: '12px', fontWeight: '700', padding: '4px 10px', borderRadius: '12px' }}>
          {etiqueta.texto}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '10px', margin: '12px 0' }}>
        {['freemium', 'premium'].map((p) => (
          <button key={p} type="button" onClick={() => setPlan(p)} style={{
            flex: 1, padding: '10px', borderRadius: '10px', border: '2px solid',
            borderColor: plan === p ? (p === 'premium' ? '#E8720C' : '#1A3C5E') : '#ddd',
            backgroundColor: plan === p ? (p === 'premium' ? '#FEF3EC' : '#EEF2F7') : '#F8F9FA',
            color: plan === p ? '#1A3C5E' : '#888', fontWeight: '700', cursor: 'pointer', fontSize: '14px',
          }}>
            {p === 'premium' ? '⭐ Premium' : '🆓 Básico'}
          </button>
        ))}
      </div>

      {plan === 'premium' && (
        <label style={{ display: 'block', fontSize: '13px', color: '#555', marginBottom: '10px' }}>
          Premium vence el
          <input type="date" value={premiumHasta} onChange={(e) => setPremiumHasta(e.target.value)} style={campoFecha} />
          <span style={{ fontSize: '12px', color: '#888' }}>Sin fecha = Premium sin vencimiento.</span>
        </label>
      )}

      <button type="button" onClick={guardar} disabled={guardando} style={botonGuardar}>
        {guardando ? 'Guardando...' : 'Guardar plan'}
      </button>
      {mensaje && <p role="status" style={{ margin: '8px 0 0', fontSize: '13px', color: '#1A3C5E' }}>{mensaje}</p>}
    </div>
  );
}

export default function AdminTalleresPage() {
  const router = useRouter();
  const [talleres, setTalleres] = useState(null);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let cancelado = false;
    getDocs(collection(db, 'talleres'))
      .then((snap) => {
        if (cancelado) return;
        const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        lista.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
        setTalleres(lista);
      })
      .catch((err) => {
        console.error('[admin/talleres] No se pudieron cargar los talleres', err);
        if (!cancelado) setError('No se pudieron cargar los talleres.');
      });
    return () => { cancelado = true; };
  }, [recarga]);

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F0F2F5', padding: '24px 16px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <button type="button" onClick={() => router.push('/admin')} style={volver}>← Volver al admin</button>
        <h1 style={{ fontSize: '22px', color: '#1A3C5E', margin: '8px 0 4px' }}>Talleres</h1>
        <p style={{ fontSize: '13px', color: '#666', margin: '0 0 16px' }}>
          Asigna o quita el plan Premium. Con config/ordenes.requierePremium encendido, crear y editar órdenes de servicio pide Premium vigente.
        </p>
        {error && <p role="alert" style={{ color: '#C62828' }}>{error}</p>}
        {!error && talleres === null && <p style={{ color: '#666' }}>Cargando...</p>}
        {talleres && talleres.length === 0 && <p style={{ color: '#666' }}>Todavía no hay talleres.</p>}
        {talleres && talleres.map((t) => (
          <FilaTaller key={`${t.id}-${t.plan}-${fechaParaCampo(t.premiumHasta)}-${t.premiumOrigen || ''}`} taller={t} onGuardado={() => setRecarga((n) => n + 1)} />
        ))}
      </div>
    </main>
  );
}

const tarjeta = { backgroundColor: '#fff', borderRadius: '14px', padding: '16px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(26,60,94,0.06)' };
const campoFecha = { display: 'block', width: '100%', boxSizing: 'border-box', margin: '6px 0 4px', padding: '10px', borderRadius: '10px', border: '1px solid #ccc', fontSize: '15px' };
const botonGuardar = { width: '100%', padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#1A3C5E', color: '#fff', fontWeight: '700', fontSize: '15px', cursor: 'pointer' };
const volver = { background: 'none', border: 'none', color: '#1A3C5E', fontWeight: '600', cursor: 'pointer', padding: 0, fontSize: '14px' };
