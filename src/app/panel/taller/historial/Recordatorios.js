'use client';

import { useState } from 'react';
import { MAX_AVISAR_DIAS_ANTES, MENSAJES_RECORDATORIO, diasValidos } from '../../../../lib/historialTaller';
import { cambiarRecordatorioDelVehiculo, quitarRecordatorioDelVehiculo, recordatoriosDe } from './datos';
import { fechaLarga } from './formato';

// Recordatorios del vehículo (etapa 3). Con puedeEscribir (Premium vigente, términos vigentes,
// taller activo y bandera): adelantar o cambiar la fecha, cambiar los días de aviso, marcar
// atendido y quitar. Sin eso, solo se ven. Ningún cambio mueve la fecha de borrado del vehículo.
const aCampo = (msFecha) => {
  const f = new Date(msFecha);
  const p = (n) => String(n).padStart(2, '0');
  return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}`;
};

function Fila({ r, puedeEscribir, onCambio, onQuitar }) {
  const [fecha, setFecha] = useState(aCampo(r.fecha));
  const [dias, setDias] = useState(String(r.avisarDiasAntes));
  const pendiente = r.estado === 'pendiente';
  return (
    <div style={tarjeta}>
      <p style={{ margin: 0, fontWeight: 'bold', color: pendiente ? '#1A3C5E' : '#888' }}>
        {r.tipo} {pendiente ? '' : '· atendido'}
      </p>
      <p style={{ margin: '2px 0', fontSize: '13px', color: '#555' }}>
        {fechaLarga(new Date(r.fecha))} · avisar {r.avisarDiasAntes} día(s) antes · orden {r.folio}
      </p>
      {puedeEscribir && pendiente && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px', alignItems: 'center' }}>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label={`Fecha de ${r.tipo}`} style={campo} />
          <button type="button" style={boton} onClick={() => onCambio(r.id, { fecha: new Date(`${fecha}T12:00:00`).getTime() })} disabled={!fecha}>
            Cambiar fecha
          </button>
          <input
            type="number" min={0} max={MAX_AVISAR_DIAS_ANTES} value={dias} onChange={(e) => setDias(e.target.value)}
            aria-label={`Días de aviso de ${r.tipo}`} style={{ ...campo, width: '64px' }}
          />
          <button type="button" style={boton} onClick={() => onCambio(r.id, { avisarDiasAntes: Number(dias) })}>Guardar días</button>
          <button type="button" style={boton} onClick={() => onCambio(r.id, { estado: 'atendido' })}>Atendido</button>
        </div>
      )}
      {puedeEscribir && (
        <button type="button" style={{ ...boton, color: '#B3261E', borderColor: '#B3261E', marginTop: '6px' }} onClick={() => onQuitar(r)}>
          Quitar
        </button>
      )}
    </div>
  );
}

export default function Recordatorios({ tallerId, vehiculo, puedeEscribir, onGuardado }) {
  const [error, setError] = useState('');
  const lista = recordatoriosDe(vehiculo);
  const ordenada = [...lista].sort((a, b) => (a.estado === b.estado ? a.fecha - b.fecha : a.estado === 'pendiente' ? -1 : 1));

  async function cambiar(id, cambios) {
    setError('');
    if (cambios.avisarDiasAntes !== undefined && !diasValidos(cambios.avisarDiasAntes)) { setError(MENSAJES_RECORDATORIO.dias); return; }
    try {
      await cambiarRecordatorioDelVehiculo(tallerId, vehiculo, id, cambios);
      onGuardado();
    } catch (err) {
      console.error(err);
      setError(MENSAJES_RECORDATORIO.guardarFallo);
    }
  }
  async function quitar(r) {
    if (!window.confirm(`¿Quitar el recordatorio "${r.tipo}"?`)) return;
    setError('');
    try {
      await quitarRecordatorioDelVehiculo(tallerId, vehiculo, r.id);
      onGuardado();
    } catch (err) {
      console.error(err);
      setError(MENSAJES_RECORDATORIO.guardarFallo);
    }
  }

  return (
    <section aria-label="Recordatorios">
      <h2 style={{ fontSize: '16px', color: '#1A3C5E', margin: '18px 0 8px' }}>Recordatorios</h2>
      {error && <p role="alert" style={{ color: '#B3261E', fontSize: '14px' }}>{error}</p>}
      {ordenada.length === 0 && <p style={{ fontSize: '14px', color: '#555' }}>Sin recordatorios. Se agregan al pasar una orden al historial.</p>}
      {ordenada.map((r) => (
        <Fila key={`${r.id}-${r.fecha}-${r.avisarDiasAntes}-${r.estado}`} r={r} puedeEscribir={puedeEscribir} onCambio={cambiar} onQuitar={quitar} />
      ))}
    </section>
  );
}

const tarjeta = { backgroundColor: '#fff', border: '1px solid #E3E3E3', borderRadius: '14px', padding: '12px 14px', marginBottom: '10px' };
const campo = { minHeight: '40px', borderRadius: '10px', border: '1px solid #CCC', padding: '0 8px', fontSize: '15px' };
const boton = { minHeight: '40px', borderRadius: '10px', border: '1px solid #1A3C5E', backgroundColor: '#fff', color: '#1A3C5E', fontWeight: 'bold', cursor: 'pointer', padding: '0 12px' };
