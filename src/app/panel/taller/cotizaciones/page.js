'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { listarCotizaciones } from './datos';
import { useCotizaciones } from './contexto';
import { ESTADOS_COTIZACION, formatearPesos, totalConIvaCentavos } from '../../../../lib/cotizaciones';

const MENSAJE_INDICE = 'Falta un índice de Firestore para esta lista. Avisa al equipo técnico (el enlace para crearlo aparece en la consola del navegador).';

function fecha(ts) {
  return ts?.toDate ? ts.toDate().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
}

export default function ListaCotizaciones() {
  const router = useRouter();
  const { tallerId, puedeEditar } = useCotizaciones();
  const [pestana, setPestana] = useState('activas');
  const [filtroEstado, setFiltroEstado] = useState('todas');
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelado = false;
    listarCotizaciones(tallerId, { archivada: pestana === 'archivadas' })
      .then((r) => {
        if (cancelado) return;
        setItems(r.items);
        setCursor(r.cursor);
        setHayMas(r.hayMas);
        setError('');
      })
      .catch((err) => {
        console.error(err);
        if (!cancelado) setError(err?.code === 'failed-precondition' ? MENSAJE_INDICE : 'No pudimos cargar tus cotizaciones. Intenta de nuevo.');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => { cancelado = true; };
  }, [tallerId, pestana]);

  function cambiarPestana(nueva) {
    setCargando(true);
    setItems([]);
    setPestana(nueva);
  }

  function verMas() {
    setCargandoMas(true);
    listarCotizaciones(tallerId, { archivada: pestana === 'archivadas', cursor })
      .then((r) => {
        setItems((prev) => [...prev, ...r.items]);
        setCursor(r.cursor);
        setHayMas(r.hayMas);
      })
      .catch((err) => {
        console.error(err);
        setError('No pudimos cargar más cotizaciones. Intenta de nuevo.');
      })
      .finally(() => setCargandoMas(false));
  }

  const visibles = items.filter((i) => filtroEstado === 'todas' || i.estado === filtroEstado);

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '16px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <button onClick={() => router.push('/panel/taller')} style={{ background: 'none', border: 'none', color: '#1A3C5E', fontSize: '15px', cursor: 'pointer', padding: '8px 0' }}>
          ← Mi taller
        </button>
        <h1 style={{ fontSize: '22px', color: '#1A3C5E', margin: '4px 0 14px' }}>Cotizaciones</h1>

        {puedeEditar ? (
          <button onClick={() => router.push('/panel/taller/cotizaciones/nueva')} style={{ width: '100%', minHeight: '56px', borderRadius: '14px', border: 'none', backgroundColor: '#E8720C', color: '#fff', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '14px' }}>
            + Nueva cotización
          </button>
        ) : (
          <p style={{ fontSize: '14px', color: '#8A2A1A', margin: '0 0 14px' }}>Solo lectura: no puedes crear ni editar cotizaciones ahora.</p>
        )}

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          {[['activas', 'Activas'], ['archivadas', 'Archivadas']].map(([valor, texto]) => (
            <button
              key={valor}
              onClick={() => cambiarPestana(valor)}
              style={{ flex: 1, minHeight: '48px', borderRadius: '12px', border: 'none', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: pestana === valor ? '#1A3C5E' : '#fff', color: pestana === valor ? '#fff' : '#1A3C5E' }}
            >
              {texto}
            </button>
          ))}
        </div>

        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ width: '100%', minHeight: '48px', borderRadius: '12px', border: '1px solid #CCC', fontSize: '15px', padding: '0 12px', marginBottom: '14px', backgroundColor: '#fff' }}>
          <option value="todas">Todos los estados</option>
          {ESTADOS_COTIZACION.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>

        {error && <p role="alert" style={{ color: '#B3261E', fontSize: '14px' }}>{error}</p>}
        {cargando && <p style={{ color: '#555' }}>Cargando...</p>}
        {!cargando && !error && visibles.length === 0 && (
          <p style={{ color: '#555', fontSize: '15px' }}>{pestana === 'activas' ? 'No tienes cotizaciones activas.' : 'No tienes cotizaciones archivadas.'}</p>
        )}

        {visibles.map((c) => (
          <button
            key={c.folio}
            onClick={() => router.push(`/panel/taller/cotizaciones/${c.folio}`)}
            style={{ display: 'block', width: '100%', textAlign: 'left', backgroundColor: '#fff', borderRadius: '14px', border: 'none', padding: '14px 16px', marginBottom: '10px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '13px', color: '#888' }}>{c.folio}</span>
              <span style={{ fontSize: '12px', color: '#E8720C', fontWeight: 'bold' }}>{c.estado}</span>
            </div>
            <p style={{ margin: '4px 0', fontSize: '16px', color: '#1A3C5E', fontWeight: 'bold' }}>
              {c.cliente?.nombre || 'Sin nombre de cliente'}
            </p>
            <p style={{ margin: '0 0 6px', fontSize: '14px', color: '#555' }}>
              {[c.vehiculo?.marca, c.vehiculo?.modelo, c.vehiculo?.anio].filter(Boolean).join(' ')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: '#888' }}>Se eliminará el {fecha(c.expiraAt)}</span>
              {/* totalCentavos se guarda sin IVA; aquí se muestra con IVA */}
              <span style={{ textAlign: 'right' }}>
                <strong style={{ color: '#1A3C5E', fontSize: '16px' }}>{formatearPesos(totalConIvaCentavos(c.totalCentavos ?? 0))}</strong>
                <span style={{ display: 'block', fontSize: '12px', color: '#888' }}>IVA incluido</span>
              </span>
            </div>
          </button>
        ))}

        {hayMas && (
          <button onClick={verMas} disabled={cargandoMas} style={{ width: '100%', minHeight: '52px', borderRadius: '12px', border: '1px solid #1A3C5E', backgroundColor: '#fff', color: '#1A3C5E', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
            {cargandoMas ? 'Cargando...' : 'Ver más'}
          </button>
        )}
      </div>
    </main>
  );
}
