'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { esPremiumVigente } from '../../../../lib/planes';
import { MAX_PLACAS, normalizarPlacas, MENSAJES_HISTORIAL, ADVERTENCIA_HISTORIAL } from '../../../../lib/historialTaller';
import { agregarOrdenAlHistorial, leerConfigHistorial, ordenEnHistorial } from '../historial/datos';

// "Agregar al historial" en el detalle de una orden (debajo de "Descargar PDF"). Solo aparece si:
// la orden está entregada, el taller puede editar (puedeEditar), tiene Premium vigente y
// config/historialTaller.habilitado == true. Placas obligatorias: se precargan de la orden y, si no
// las tiene, el taller las escribe. Nunca copia nombre ni teléfono del cliente.
export default function AgregarAlHistorial({ tallerId, taller, folio, orden, puedeEditar }) {
  const router = useRouter();
  const [habilitado, setHabilitado] = useState(false);
  const [vehiculoId, setVehiculoId] = useState(null);
  const [placas, setPlacas] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const visible = orden?.estado === 'entregado' && puedeEditar && esPremiumVigente(taller);

  useEffect(() => {
    if (!visible) return undefined;
    let cancelado = false;
    leerConfigHistorial()
      .then(async (c) => {
        if (cancelado || c?.habilitado !== true) return;
        const id = await ordenEnHistorial(tallerId, folio);
        if (!cancelado) { setVehiculoId(id); setHabilitado(true); }
      })
      .catch(() => {});
    return () => { cancelado = true; };
  }, [visible, tallerId, folio]);

  if (!visible || !habilitado) return null;

  if (vehiculoId) {
    return (
      <div style={caja}>
        <p style={{ margin: 0, fontSize: '14px', color: '#2E7D32', fontWeight: 'bold' }}>✅ {MENSAJES_HISTORIAL.yaEnHistorial}</p>
        <button type="button" onClick={() => router.push(`/panel/taller/historial/${vehiculoId}`)} style={enlace}>Ver en el historial</button>
      </div>
    );
  }

  const placasOrden = normalizarPlacas(orden.vehiculo?.placas);
  async function agregar() {
    setError('');
    if (!placasOrden && !normalizarPlacas(placas)) { setError(MENSAJES_HISTORIAL.placas); return; }
    setGuardando(true);
    try {
      const id = await agregarOrdenAlHistorial({ tallerId, folio, placasEscritas: placas });
      setVehiculoId(id);
    } catch (err) {
      setError(err.message || MENSAJES_HISTORIAL.guardarFallo);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={caja}>
      {placasOrden ? (
        <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#333' }}>Placas: <strong>{placasOrden}</strong></p>
      ) : (
        <label style={{ display: 'block', fontSize: '14px', color: '#333', marginBottom: '8px' }}>
          Placas del vehículo (obligatorias)
          <input
            value={placas} maxLength={MAX_PLACAS + 4} onChange={(e) => setPlacas(e.target.value)}
            placeholder="Ej. ABC123" style={campo} aria-label="Placas del vehículo"
          />
        </label>
      )}
      <button type="button" onClick={agregar} disabled={guardando} style={boton}>
        {guardando ? 'Agregando...' : 'Agregar al historial'}
      </button>
      <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#8A2A1A' }}>⚠️ {ADVERTENCIA_HISTORIAL}. Se guardan placas, vehículo, fecha, kilometraje, trabajos y piezas; nunca el nombre ni el teléfono.</p>
      {error && <p role="alert" style={{ margin: '6px 0 0', fontSize: '14px', color: '#B3261E' }}>{error}</p>}
    </div>
  );
}

const caja = { backgroundColor: '#fff', border: '1px solid #E3E3E3', borderRadius: '12px', padding: '12px', marginBottom: '14px' };
const campo = { display: 'block', width: '100%', boxSizing: 'border-box', minHeight: '44px', borderRadius: '10px', border: '1px solid #CCC', padding: '0 12px', fontSize: '16px', marginTop: '4px', textTransform: 'uppercase' };
const boton = { width: '100%', minHeight: '52px', borderRadius: '12px', border: 'none', backgroundColor: '#1A3C5E', color: '#fff', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' };
const enlace = { background: 'none', border: 'none', padding: 0, marginTop: '6px', color: '#1A3C5E', textDecoration: 'underline', cursor: 'pointer', fontSize: '14px' };
