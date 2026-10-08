'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePedirPieza } from './contexto';
import { escucharMisSolicitudes } from './datos';

const ETIQUETA_ESTADO = { abierta: 'Abierta', cerrada: 'Cerrada', cancelada: 'Cancelada' };
const COLOR_ESTADO = { abierta: '#E8720C', cerrada: '#2E7D32', cancelada: '#888' };

export default function ListaSolicitudesPiezas() {
  const router = useRouter();
  const { tallerId, taller } = usePedirPieza();
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!tallerId) return;
    const dejarDeEscuchar = escucharMisSolicitudes(tallerId, (lista) => {
      setItems(lista);
      setCargando(false);
      setError('');
    });
    return dejarDeEscuchar;
  }, [tallerId]);

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '16px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <button onClick={() => router.push('/panel/taller')} style={{ background: 'none', border: 'none', color: '#1A3C5E', fontSize: '15px', cursor: 'pointer', padding: '8px 0' }}>
          ← Mi taller
        </button>
        <h1 style={{ fontSize: '22px', color: '#1A3C5E', margin: '4px 0 14px' }}>Pedir una pieza</h1>

        {taller && !taller.activo ? (
          <p role="alert" style={{ fontSize: '14px', color: '#8A2A1A', margin: '0 0 14px' }}>
            Tu taller está desactivado: solo puedes ver tus pedidos anteriores.
          </p>
        ) : (
          <button onClick={() => router.push('/panel/taller/pedir-pieza/nueva')} style={{ width: '100%', minHeight: '56px', borderRadius: '14px', border: 'none', backgroundColor: '#E8720C', color: '#fff', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '14px' }}>
            + Pedir una pieza
          </button>
        )}

        {error && <p role="alert" style={{ color: '#B3261E', fontSize: '14px' }}>{error}</p>}
        {cargando && <p style={{ color: '#555' }}>Cargando...</p>}
        {!cargando && items.length === 0 && (
          <p style={{ color: '#555', fontSize: '15px' }}>Todavía no has pedido ninguna pieza.</p>
        )}

        {items.map((s) => (
          <button
            key={s.id}
            onClick={() => router.push(`/panel/taller/pedir-pieza/${s.id}`)}
            style={{ display: 'block', width: '100%', textAlign: 'left', backgroundColor: '#fff', borderRadius: '14px', border: 'none', padding: '14px 16px', marginBottom: '10px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '16px', color: '#1A3C5E', fontWeight: 'bold' }}>{s.pieza}</span>
              <span style={{ fontSize: '12px', color: COLOR_ESTADO[s.estadoSolicitud] || '#888', fontWeight: 'bold' }}>
                {ETIQUETA_ESTADO[s.estadoSolicitud] || s.estadoSolicitud}
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#555' }}>
              {[s.vehiculo?.marca, s.vehiculo?.modelo, s.vehiculo?.anio].filter(Boolean).join(' ')}
            </p>
          </button>
        ))}
      </div>
    </main>
  );
}
