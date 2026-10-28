'use client';

// Refaccionarias: lista con fecha de alta, estado y ciudad, y lo que solo el admin decide: activo,
// insignia Verificado, fin de la prueba (pruebaHasta) y fin del pago (premiumHasta). Sin plan Básico:
// prueba de 3 meses que el admin inicia al activar la cuenta y, al terminar, pago. Las cuentas las da
// de alta cada refaccionaria en /panel/refaccionaria/registro (con config/refaccionarias.habilitado).
// Solo admin (admin/layout.js) y las reglas. Costo: 1 lectura por refaccionaria al abrir; 1 escritura
// por cada "Guardar".
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, deleteField, doc, getDocs, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { estadoCuentaRefaccionaria, finPruebaDesde, MESES_PRUEBA, textoEstadoCuenta } from '../../../lib/refaccionarias';
import { fechaParaCampo } from '../talleres/planTaller';

const fechaDeCampo = (valor) => (valor ? new Date(`${valor}T00:00:00`) : null);
const ESTILO_ESTADO = {
  'prueba-vigente': { bg: '#EEF2F7', color: '#1A3C5E' },
  'pago-vigente': { bg: '#FAEEDA', color: '#854F0B' },
  vencida: { bg: '#FDECEA', color: '#C62828' },
  'sin-activar': { bg: '#F1F1F1', color: '#555' },
};

// Lo que se guarda: cada fecha como Timestamp, o se borra si queda vacía. plan = 'pago' mientras
// haya fecha de pago (sin plan Básico).
function cambiosCuenta(pruebaHasta, premiumHasta) {
  return {
    pruebaHasta: pruebaHasta ? Timestamp.fromDate(fechaDeCampo(pruebaHasta)) : deleteField(),
    premiumHasta: premiumHasta ? Timestamp.fromDate(fechaDeCampo(premiumHasta)) : deleteField(),
    plan: premiumHasta ? 'pago' : deleteField(),
  };
}

function FilaRefaccionaria({ refaccionaria: r, onGuardado }) {
  const [activo, setActivo] = useState(r.activo === true);
  const [verificado, setVerificado] = useState(r.verificado === true);
  const [pruebaHasta, setPruebaHasta] = useState(fechaParaCampo(r.pruebaHasta));
  const [premiumHasta, setPremiumHasta] = useState(fechaParaCampo(r.premiumHasta));
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const cuenta = estadoCuentaRefaccionaria({ pruebaHasta: fechaDeCampo(pruebaHasta), premiumHasta: fechaDeCampo(premiumHasta) });
  const etiqueta = ESTILO_ESTADO[cuenta.estado];
  const alta = r.creadoAt?.toDate ? r.creadoAt.toDate().toLocaleDateString('es-MX') : '';

  async function guardar() {
    setGuardando(true);
    setMensaje('');
    try {
      await updateDoc(doc(db, 'refaccionarias', r.id), { activo, verificado, ...cambiosCuenta(pruebaHasta, premiumHasta) });
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
          {textoEstadoCuenta(cuenta)}
        </span>
      </div>

      <label style={casilla}>
        <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} /> Activa
      </label>
      <label style={casilla}>
        <input type="checkbox" checked={verificado} onChange={(e) => setVerificado(e.target.checked)} /> Insignia Verificado
      </label>

      <label style={campoEtiqueta}>
        Prueba vence el
        <input type="date" value={pruebaHasta} onChange={(e) => setPruebaHasta(e.target.value)} style={campoFecha} />
      </label>
      {!pruebaHasta && (
        <button type="button" onClick={() => setPruebaHasta(finPruebaDesde())} style={botonSecundario}>
          Iniciar prueba de {MESES_PRUEBA} meses desde hoy
        </button>
      )}
      <label style={campoEtiqueta}>
        Pago vence el
        <input type="date" value={premiumHasta} onChange={(e) => setPremiumHasta(e.target.value)} style={campoFecha} />
        <span style={{ fontSize: '12px', color: '#888' }}>Vacío = sin pago. Al vencer la prueba o el pago, sus datos se conservan 90 días.</span>
      </label>

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
          Activa o desactiva, asigna la insignia Verificado, la prueba y el pago. Las cuentas se registran en /panel/refaccionaria/registro con config/refaccionarias.habilitado encendido.
        </p>
        {error && <p role="alert" style={{ color: '#C62828' }}>{error}</p>}
        {!error && refaccionarias === null && <p style={{ color: '#666' }}>Cargando...</p>}
        {refaccionarias && refaccionarias.length === 0 && <p style={{ color: '#666' }}>Todavía no hay refaccionarias.</p>}
        {refaccionarias && refaccionarias.map((r) => (
          <FilaRefaccionaria key={`${r.id}-${r.activo}-${r.verificado}-${fechaParaCampo(r.pruebaHasta)}-${fechaParaCampo(r.premiumHasta)}`} refaccionaria={r} onGuardado={() => setRecarga((n) => n + 1)} />
        ))}
      </div>
    </main>
  );
}

const tarjeta = { backgroundColor: '#fff', borderRadius: '14px', padding: '16px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(26,60,94,0.06)' };
const casilla = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#1A3C5E', fontWeight: '600', marginTop: '10px', cursor: 'pointer' };
const campoEtiqueta = { display: 'block', fontSize: '13px', color: '#555', margin: '12px 0 4px' };
const botonSecundario = { background: 'none', border: '1px solid #1A3C5E', borderRadius: '10px', color: '#1A3C5E', fontWeight: '600', fontSize: '13px', padding: '8px 12px', cursor: 'pointer', marginBottom: '6px' };
const campoFecha = { display: 'block', width: '100%', boxSizing: 'border-box', margin: '6px 0 4px', padding: '10px', borderRadius: '10px', border: '1px solid #ccc', fontSize: '15px' };
const botonGuardar = { width: '100%', padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#1A3C5E', color: '#fff', fontWeight: '700', fontSize: '15px', cursor: 'pointer' };
const volver = { background: 'none', border: 'none', color: '#1A3C5E', fontWeight: '600', cursor: 'pointer', padding: 0, fontSize: '14px' };
