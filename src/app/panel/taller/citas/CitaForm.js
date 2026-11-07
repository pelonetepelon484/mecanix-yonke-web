'use client';

import { useState } from 'react';
import {
  ADVERTENCIA_MOTIVO_CITA, ESTADOS_CITA, MAX_MOTIVO_CITA, MAX_NOMBRE_CITA, MAX_VEHICULO_CITA, NOMBRES_ESTADO_CITA, fechaDeCita, inputsDeFecha,
  validarCita,
} from '../../../../lib/citasTaller';

// Formulario de alta y edición. Valida en pantalla (lib/citasTaller.ts) y llama onGuardar con los
// datos limpios; si onGuardar falla, el mensaje se muestra y lo escrito sigue en pantalla.
export default function CitaForm({ inicial = null, textoBoton = 'Agendar cita', onGuardar }) {
  const fechaInicial = inicial ? fechaDeCita(inicial) : null;
  const inputs = fechaInicial ? inputsDeFecha(fechaInicial) : { fecha: '', hora: '' };
  const [fecha, setFecha] = useState(inputs.fecha);
  const [hora, setHora] = useState(inputs.hora);
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [telefono, setTelefono] = useState(inicial?.telefono ?? '');
  const [vehiculo, setVehiculo] = useState(inicial?.vehiculo ?? '');
  const [placas, setPlacas] = useState(inicial?.placas ?? '');
  const [motivo, setMotivo] = useState(inicial?.motivo ?? '');
  const [estado, setEstado] = useState(inicial?.estado ?? 'pendiente');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    const r = validarCita({ fecha, hora, nombre, telefono, vehiculo, placas, motivo, estado });
    if (!r.ok) { setError(r.mensaje); return; }
    setError('');
    setGuardando(true);
    try {
      await onGuardar(r.datos);
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <label htmlFor="ci-fecha" style={etiqueta}>Fecha *</label>
          <input id="ci-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={campo} />
        </div>
        <div>
          <label htmlFor="ci-hora" style={etiqueta}>Hora *</label>
          <input id="ci-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={campo} />
        </div>
      </div>
      <label htmlFor="ci-nombre" style={etiqueta}>Nombre del cliente *</label>
      <input id="ci-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={MAX_NOMBRE_CITA} autoComplete="off" style={campo} />
      <label htmlFor="ci-telefono" style={etiqueta}>WhatsApp (10 dígitos)</label>
      <input id="ci-telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" autoComplete="off" placeholder="6641234567" style={campo} />
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
        <div>
          <label htmlFor="ci-vehiculo" style={etiqueta}>Vehículo</label>
          <input id="ci-vehiculo" value={vehiculo} onChange={(e) => setVehiculo(e.target.value)} maxLength={MAX_VEHICULO_CITA} placeholder="Nissan Versa 2018" autoComplete="off" style={campo} />
        </div>
        <div>
          <label htmlFor="ci-placas" style={etiqueta}>Placas</label>
          <input id="ci-placas" value={placas} onChange={(e) => setPlacas(e.target.value)} maxLength={14} autoCapitalize="characters" autoComplete="off" style={campo} />
        </div>
      </div>
      <label htmlFor="ci-motivo" style={etiqueta}>Motivo</label>
      <p style={{ fontSize: '12px', color: '#8A2A1A', margin: '0 0 6px' }}>⚠️ {ADVERTENCIA_MOTIVO_CITA}</p>
      <textarea id="ci-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={MAX_MOTIVO_CITA} rows={2} placeholder="Afinación, revisión de frenos..." style={{ ...campo, resize: 'vertical' }} />
      {inicial && (
        <>
          <label htmlFor="ci-estado" style={etiqueta}>Estado</label>
          <select id="ci-estado" value={estado} onChange={(e) => setEstado(e.target.value)} style={campo}>
            {ESTADOS_CITA.map((s) => <option key={s} value={s}>{NOMBRES_ESTADO_CITA[s]}</option>)}
          </select>
        </>
      )}

      {error && <p role="alert" style={{ color: '#B3261E', fontSize: '14px' }}>{error}</p>}
      <button type="submit" disabled={guardando} style={principal}>{guardando ? 'Guardando...' : textoBoton}</button>
    </form>
  );
}

const etiqueta = { display: 'block', fontSize: '14px', color: '#1A3C5E', fontWeight: 'bold', margin: '10px 0 4px' };
const campo = { width: '100%', boxSizing: 'border-box', padding: '12px', fontSize: '16px', borderRadius: '10px', border: '1px solid #CCC', backgroundColor: '#fff', minHeight: '48px' };
const principal = { width: '100%', minHeight: '52px', borderRadius: '12px', border: 'none', backgroundColor: '#E8720C', color: '#fff', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '16px' };
