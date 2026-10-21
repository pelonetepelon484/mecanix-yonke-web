'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { esPremiumVigente } from '../../../../lib/planes';
import {
  MAX_PLACAS, normalizarPlacas, MENSAJES_HISTORIAL, ADVERTENCIA_HISTORIAL, SERVICIOS_PERIODICOS, MAX_MESES_RECORDATORIO,
  MAX_TIPO_RECORDATORIO, MENSAJES_RECORDATORIO, mesesValidos, tipoValido,
} from '../../../../lib/historialTaller';
import { agregarOrdenAlHistorial, agregarRecordatorios, leerConfigHistorial, ordenEnHistorial } from '../historial/datos';

// "Agregar al historial" en el detalle de una orden (debajo de "Descargar PDF"). Solo aparece si:
// la orden está entregada, el taller puede editar (puedeEditar), tiene Premium vigente y
// config/historialTaller.habilitado == true. Placas obligatorias: se precargan de la orden y, si no
// las tiene, el taller las escribe. Nunca copia nombre ni teléfono del cliente.
// Recordatorios (etapa 3): el taller puede marcar servicios periódicos (intervalo en meses
// editable) o escribir uno propio; se guardan justo después del servicio (fecha = entrega + meses).
export default function AgregarAlHistorial({ tallerId, taller, folio, orden, puedeEditar }) {
  const router = useRouter();
  const [habilitado, setHabilitado] = useState(false);
  const [vehiculoId, setVehiculoId] = useState(null);
  const [placas, setPlacas] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  // { [tipo]: meses } de los servicios periódicos marcados; "otro" aparte.
  const [marcados, setMarcados] = useState({});
  const [otro, setOtro] = useState({ tipo: '', meses: '' });
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
        {aviso && <p role="alert" style={{ margin: '6px 0 0', fontSize: '13px', color: '#8A2A1A' }}>{aviso}</p>}
        <button type="button" onClick={() => router.push(`/panel/taller/historial/${vehiculoId}`)} style={enlace}>Ver en el historial</button>
      </div>
    );
  }

  const placasOrden = normalizarPlacas(orden.vehiculo?.placas);
  function recordatoriosElegidos() {
    const lista = Object.entries(marcados).map(([tipo, meses]) => ({ tipo, meses: Number(meses) }));
    if (otro.tipo.trim() || otro.meses !== '') lista.push({ tipo: otro.tipo.trim(), meses: Number(otro.meses) });
    return lista;
  }

  async function agregar() {
    setError('');
    setAviso('');
    if (!placasOrden && !normalizarPlacas(placas)) { setError(MENSAJES_HISTORIAL.placas); return; }
    const nuevos = recordatoriosElegidos();
    const malo = nuevos.find((n) => !tipoValido(n.tipo) || !mesesValidos(n.meses));
    if (malo) { setError(!tipoValido(malo.tipo) ? MENSAJES_RECORDATORIO.tipo : MENSAJES_RECORDATORIO.meses); return; }
    setGuardando(true);
    try {
      const id = await agregarOrdenAlHistorial({ tallerId, folio, placasEscritas: placas });
      if (nuevos.length) {
        try {
          await agregarRecordatorios(tallerId, id, nuevos, { fechaEntrega: orden.fechaEntrega, folio });
        } catch (err) {
          setAviso(`Se agregó al historial, pero no pudimos guardar los recordatorios: ${err.message || MENSAJES_RECORDATORIO.guardarFallo}`);
        }
      }
      setVehiculoId(id);
    } catch (err) {
      setError(err.message || MENSAJES_HISTORIAL.guardarFallo);
    } finally {
      setGuardando(false);
    }
  }

  const alternar = (tipo, meses) => setMarcados((m) => {
    const copia = { ...m };
    if (tipo in copia) delete copia[tipo]; else copia[tipo] = meses;
    return copia;
  });

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
      <fieldset style={{ border: 'none', padding: 0, margin: '0 0 10px' }}>
        <legend style={{ fontSize: '14px', color: '#333', fontWeight: 'bold', marginBottom: '6px' }}>Recordatorios (opcional)</legend>
        <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#555' }}>El aviso sale en tu panel; Mecanix nunca contacta a tus clientes.</p>
        {SERVICIOS_PERIODICOS.map(({ tipo, meses }) => (
          <div key={tipo} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <label style={{ flex: 1, fontSize: '14px' }}>
              <input type="checkbox" checked={tipo in marcados} onChange={() => alternar(tipo, meses)} /> {tipo}
            </label>
            {tipo in marcados && (
              <label style={{ fontSize: '13px', color: '#555' }}>
                cada{' '}
                <input
                  type="number" min={1} max={MAX_MESES_RECORDATORIO} value={marcados[tipo]} aria-label={`Meses para ${tipo}`}
                  onChange={(e) => setMarcados((m) => ({ ...m, [tipo]: e.target.value }))} style={{ width: '56px' }}
                />{' '}meses
              </label>
            )}
          </div>
        ))}
        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
          <input
            value={otro.tipo} maxLength={MAX_TIPO_RECORDATORIO} placeholder="Otro servicio" aria-label="Otro servicio"
            onChange={(e) => setOtro((o) => ({ ...o, tipo: e.target.value }))} style={{ ...campo, textTransform: 'none', flex: 1, marginTop: 0 }}
          />
          <input
            type="number" min={1} max={MAX_MESES_RECORDATORIO} value={otro.meses} placeholder="Meses" aria-label="Meses del otro servicio"
            onChange={(e) => setOtro((o) => ({ ...o, meses: e.target.value }))} style={{ ...campo, width: '90px', marginTop: 0 }}
          />
        </div>
      </fieldset>
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
