'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { listarOrdenes } from './datos';
import { useOrdenes } from './contexto';
import { formatearPesos, totalConIvaCentavos } from '../../../../lib/cotizaciones';
import { ESTADOS_ORDEN, NOMBRE_ESTADO_ORDEN, textoPlano } from '../../../../lib/ordenes';

const MENSAJE_INDICE = 'Falta un índice de Firestore para esta lista. Avisa al equipo técnico (el enlace para crearlo aparece en la consola del navegador).';

function fecha(ts) {
  return ts?.toDate ? ts.toDate().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
}

// Lista de órdenes: de 20 en 20 con "Ver más", filtro por estado (consulta a Firestore, no se
// bajan todas) y sin escuchas en vivo: se lee solo al abrir, al cambiar el filtro o con "Ver más".
export default function ListaOrdenes() {
  const router = useRouter();
  const { tallerId, puedeEditar } = useOrdenes();
  const [filtro, setFiltro] = useState('todos');
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelado = false;
    listarOrdenes(tallerId, { estado: filtro })
      .then((r) => {
        if (cancelado) return;
        setItems(r.items);
        setCursor(r.cursor);
        setHayMas(r.hayMas);
        setError('');
      })
      .catch((err) => {
        console.error(err);
        if (!cancelado) setError(err?.code === 'failed-precondition' ? MENSAJE_INDICE : 'No pudimos cargar tus órdenes. Intenta de nuevo.');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => { cancelado = true; };
  }, [tallerId, filtro]);

  function cambiarFiltro(nuevo) {
    setCargando(true);
    setItems([]);
    setFiltro(nuevo);
  }

  function verMas() {
    setCargandoMas(true);
    listarOrdenes(tallerId, { estado: filtro, cursor })
      .then((r) => {
        setItems((prev) => [...prev, ...r.items]);
        setCursor(r.cursor);
        setHayMas(r.hayMas);
      })
      .catch((err) => {
        console.error(err);
        setError('No pudimos cargar más órdenes. Intenta de nuevo.');
      })
      .finally(() => setCargandoMas(false));
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '16px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <button onClick={() => router.push('/panel/taller')} style={{ background: 'none', border: 'none', color: '#1A3C5E', fontSize: '15px', cursor: 'pointer', padding: '8px 0' }}>
          ← Mi taller
        </button>
        <h1 style={{ fontSize: '22px', color: '#1A3C5E', margin: '4px 0 14px' }}>Órdenes de servicio</h1>

        {puedeEditar ? (
          <button onClick={() => router.push('/panel/taller/ordenes/nueva')} style={{ width: '100%', minHeight: '56px', borderRadius: '14px', border: 'none', backgroundColor: '#E8720C', color: '#fff', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '14px' }}>
            + Nueva orden
          </button>
        ) : (
          <p style={{ fontSize: '14px', color: '#8A2A1A', margin: '0 0 14px' }}>Solo lectura: no puedes crear ni editar órdenes ahora.</p>
        )}

        <label htmlFor="filtro-estado" style={{ display: 'block', fontSize: '13px', color: '#555', marginBottom: '4px', fontWeight: 'bold' }}>Estado</label>
        <select id="filtro-estado" value={filtro} onChange={(e) => cambiarFiltro(e.target.value)} style={{ width: '100%', minHeight: '48px', borderRadius: '12px', border: '1px solid #CCC', fontSize: '15px', padding: '0 12px', marginBottom: '14px', backgroundColor: '#fff' }}>
          <option value="todos">Todos los estados</option>
          {ESTADOS_ORDEN.map((e) => <option key={e} value={e}>{NOMBRE_ESTADO_ORDEN[e]}</option>)}
        </select>

        {error && <p role="alert" style={{ color: '#B3261E', fontSize: '14px' }}>{error}</p>}
        {cargando && <p style={{ color: '#555' }}>Cargando...</p>}
        {!cargando && !error && items.length === 0 && (
          <p style={{ color: '#555', fontSize: '15px' }}>{filtro === 'todos' ? 'No tienes órdenes todavía.' : 'No tienes órdenes en este estado.'}</p>
        )}

        {items.map((o) => (
          <button
            key={o.folio}
            onClick={() => router.push(`/panel/taller/ordenes/${o.folio}`)}
            style={{ display: 'block', width: '100%', textAlign: 'left', backgroundColor: '#fff', borderRadius: '14px', border: 'none', padding: '14px 16px', marginBottom: '10px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '13px', color: '#888' }}>{o.folio}</span>
              <span style={{ fontSize: '12px', color: '#E8720C', fontWeight: 'bold' }}>{NOMBRE_ESTADO_ORDEN[o.estado] ?? textoPlano(o.estado, 30)}</span>
            </div>
            <p style={{ margin: '4px 0', fontSize: '16px', color: '#1A3C5E', fontWeight: 'bold' }}>
              {[textoPlano(o.vehiculo?.marca, 60), textoPlano(o.vehiculo?.modelo, 60), textoPlano(o.vehiculo?.anio, 4)].filter(Boolean).join(' ')}
            </p>
            {o.fallaReportada && (
              <p style={{ margin: '0 0 6px', fontSize: '14px', color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {textoPlano(o.fallaReportada, 120)}
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: '#888' }}>Se eliminará el {fecha(o.expiraAt)}</span>
              {/* totalCentavos se guarda sin IVA; aquí se muestra con IVA */}
              <span style={{ textAlign: 'right' }}>
                <strong style={{ color: '#1A3C5E', fontSize: '16px' }}>{formatearPesos(totalConIvaCentavos(Number.isInteger(o.totalCentavos) ? o.totalCentavos : 0))}</strong>
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
