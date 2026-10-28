'use client';

// Refaccionarias: lista con fecha de alta, estado y ciudad, y lo que solo el admin decide: activo,
// insignia Verificado, plan y vencimiento del Premium (igual que admin/talleres). Las cuentas las da
// de alta cada refaccionaria en /panel/refaccionaria/registro (con config/refaccionarias.habilitado).
// Solo admin (admin/layout.js) y las reglas. Costo: 1 lectura por refaccionaria al abrir; 1 escritura
// por cada "Guardar".
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { estadoPlan, ETIQUETAS_ESTADO_PLAN } from '../../../lib/planes';
import { cambiosPlan, fechaParaCampo } from '../talleres/planTaller';

function FilaRefaccionaria({ refaccionaria: r, onGuardado }) {
  const [activo, setActivo] = useState(r.activo === true);
  const [verificado, setVerificado] = useState(r.verificado === true);
  const [plan, setPlan] = useState(r.plan === 'premium' ? 'premium' : 'freemium');
  const [premiumHasta, setPremiumHasta] = useState(fechaParaCampo(r.premiumHasta));
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const etiqueta = ETIQUETAS_ESTADO_PLAN[estadoPlan({ plan, premiumHasta: premiumHasta ? new Date(`${premiumHasta}T00:00:00`) : null })];
  const alta = r.creadoAt?.toDate ? r.creadoAt.toDate().toLocaleDateString('es-MX') : '';

  async function guardar() {
    setGuardando(true);
    setMensaje('');
    try {
      await updateDoc(doc(db, 'refaccionarias', r.id), { activo, verificado, ...cambiosPlan(plan, premiumHasta) });
      setMensaje('Guardado.');
      onGuardado();
    } catch (err) {
      console.error('[admin/refaccionarias] No se pudo guardar', err);
      setMensaje('No se pudo guardar. Revisa tu conexión y tus permisos de admin.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={tarjeta}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontWeight: '700', color: '#1A3C5E' }}>{r.nombre || '(sin nombre)'}</p>
          <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#666' }}>
            {r.ciudad || 'Sin ciudad'} · {r.estado || 'sin estado'}{alta ? ` · alta ${alta}` : ''} · WhatsApp {r.whatsapp || '—'}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#888' }}>
            Términos aceptados: {r.aceptacionVersion || 'todavía no'}
          </p>
        </div>
        <span style={{ backgroundColor: etiqueta.bg, color: etiqueta.color, fontSize: '12px', fontWeight: '700', padding: '4px 10px', borderRadius: '12px' }}>
          {etiqueta.texto}
        </span>
      </div>

      <label style={casilla}>
        <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} /> Activa
      </label>
      <label style={casilla}>
        <input type="checkbox" checked={verificado} onChange={(e) => setVerificado(e.target.checked)} /> Insignia Verificado
      </label>

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
        {guardando ? 'Guardando...' : 'Guardar'}
      </button>
      {mensaje && <p role="status" style={{ margin: '8px 0 0', fontSize: '13px', color: '#1A3C5E' }}>{mensaje}</p>}
    </div>
  );
}

export default function AdminRefaccionariasPage() {
  const router = useRouter();
  const [refaccionarias, setRefaccionarias] = useState(null);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let cancelado = false;
    getDocs(collection(db, 'refaccionarias'))
      .then((snap) => {
        if (cancelado) return;
        const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        lista.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
        setRefaccionarias(lista);
      })
      .catch((err) => {
        console.error('[admin/refaccionarias] No se pudieron cargar', err);
        if (!cancelado) setError('No se pudieron cargar las refaccionarias.');
      });
    return () => { cancelado = true; };
  }, [recarga]);

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F0F2F5', padding: '24px 16px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <button type="button" onClick={() => router.push('/admin')} style={volver}>← Volver al admin</button>
        <h1 style={{ fontSize: '22px', color: '#1A3C5E', margin: '8px 0 4px' }}>Refaccionarias</h1>
        <p style={{ fontSize: '13px', color: '#666', margin: '0 0 16px' }}>
          Activa o desactiva, asigna la insignia Verificado y el plan. Las cuentas se registran en /panel/refaccionaria/registro con config/refaccionarias.habilitado encendido.
        </p>
        {error && <p role="alert" style={{ color: '#C62828' }}>{error}</p>}
        {!error && refaccionarias === null && <p style={{ color: '#666' }}>Cargando...</p>}
        {refaccionarias && refaccionarias.length === 0 && <p style={{ color: '#666' }}>Todavía no hay refaccionarias.</p>}
        {refaccionarias && refaccionarias.map((r) => (
          <FilaRefaccionaria key={`${r.id}-${r.activo}-${r.verificado}-${r.plan}-${fechaParaCampo(r.premiumHasta)}`} refaccionaria={r} onGuardado={() => setRecarga((n) => n + 1)} />
        ))}
      </div>
    </main>
  );
}

const tarjeta = { backgroundColor: '#fff', borderRadius: '14px', padding: '16px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(26,60,94,0.06)' };
const casilla = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#1A3C5E', fontWeight: '600', marginTop: '10px', cursor: 'pointer' };
const campoFecha = { display: 'block', width: '100%', boxSizing: 'border-box', margin: '6px 0 4px', padding: '10px', borderRadius: '10px', border: '1px solid #ccc', fontSize: '15px' };
const botonGuardar = { width: '100%', padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#1A3C5E', color: '#fff', fontWeight: '700', fontSize: '15px', cursor: 'pointer' };
const volver = { background: 'none', border: 'none', color: '#1A3C5E', fontWeight: '600', cursor: 'pointer', padding: 0, fontSize: '14px' };
