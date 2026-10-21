'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useHistorial } from './contexto';
import { listarVehiculos } from './datos';
import { nombreVehiculo } from '../../../../lib/historialTaller';
import { fechaLarga, kmTexto } from './formato';
import DescargarHistorial from './DescargarHistorial';

// Lista de vehículos del historial: de 20 en 20 (los actualizados más recientemente primero), con
// placas, vehículo, último servicio, último kilometraje y "Se borrará el…".
export default function HistorialPage() {
  const router = useRouter();
  const { tallerId } = useHistorial();
  const [items, setItems] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [hayMas, setHayMas] = useState(false);
  const [error, setError] = useState('');
  const [cargandoMas, setCargandoMas] = useState(false);

  useEffect(() => {
    let cancelado = false;
    listarVehiculos(tallerId)
      .then((r) => { if (!cancelado) { setItems(r.items); setCursor(r.cursor); setHayMas(r.hayMas); } })
      .catch((err) => { console.error(err); if (!cancelado) setError('No pudimos cargar tu historial. Intenta de nuevo.'); });
    return () => { cancelado = true; };
  }, [tallerId]);

  async function verMas() {
    setCargandoMas(true);
    try {
      const r = await listarVehiculos(tallerId, cursor);
      setItems((prev) => [...prev, ...r.items]);
      setCursor(r.cursor);
      setHayMas(r.hayMas);
    } catch (err) {
      console.error(err);
      setError('No pudimos cargar más vehículos. Intenta de nuevo.');
    } finally {
      setCargandoMas(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '16px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <button type="button" onClick={() => router.push('/panel/taller')} style={volver}>← Inicio del taller</button>
        <h1 style={{ fontSize: '22px', color: '#1A3C5E', margin: '8px 0 6px' }}>Historial de servicios</h1>
        <p style={{ fontSize: '13px', color: '#555', margin: '0 0 14px' }}>
          Se llena desde tus órdenes entregadas con &quot;Agregar al historial&quot;. Cada vehículo se borra solo 18 meses después de su último cambio.
        </p>
        <DescargarHistorial tallerId={tallerId} />
        {error && <p role="alert" style={{ color: '#B3261E' }}>{error}</p>}
        {!error && items === null && <p style={{ color: '#555' }}>Cargando...</p>}
        {items && items.length === 0 && <p style={{ color: '#555' }}>Todavía no tienes vehículos en tu historial.</p>}
        {items && items.map((v) => (
          <button key={v.id} type="button" onClick={() => router.push(`/panel/taller/historial/${v.id}`)} style={tarjeta}>
            <span style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
              <strong style={{ color: '#1A3C5E', fontSize: '16px' }}>{v.placas}</strong>
              <span style={{ fontSize: '12px', color: '#888' }}>{(v.servicios?.length ?? 0)} servicio(s)</span>
            </span>
            <span style={{ display: 'block', color: '#333', margin: '2px 0' }}>{nombreVehiculo(v)}</span>
            <span style={{ display: 'block', fontSize: '13px', color: '#555' }}>
              Último servicio: {fechaLarga(v.ultimoServicioAt) || '—'} · {kmTexto(v.ultimoKm)}
            </span>
            {v.expiraAt && <span style={{ display: 'block', fontSize: '12px', color: '#8A2A1A', marginTop: '4px' }}>Se borrará el {fechaLarga(v.expiraAt)}</span>}
          </button>
        ))}
        {hayMas && (
          <button type="button" onClick={verMas} disabled={cargandoMas} style={verMasStyle}>{cargandoMas ? 'Cargando...' : 'Ver más'}</button>
        )}
      </div>
    </main>
  );
}

const volver = { background: 'none', border: 'none', color: '#1A3C5E', fontWeight: '600', cursor: 'pointer', padding: 0, fontSize: '14px' };
const tarjeta = { display: 'block', width: '100%', textAlign: 'left', backgroundColor: '#fff', border: '1px solid #E3E3E3', borderRadius: '14px', padding: '14px', marginBottom: '10px', cursor: 'pointer', fontSize: '14px' };
const verMasStyle = { width: '100%', minHeight: '48px', borderRadius: '12px', border: '1px solid #1A3C5E', backgroundColor: '#fff', color: '#1A3C5E', fontWeight: 'bold', cursor: 'pointer' };
