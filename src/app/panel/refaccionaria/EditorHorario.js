'use client';

import { useState } from 'react';
import { DIAS_HORARIO, HORARIO_INICIAL, validarHorario } from '../../../lib/refaccionarias';
import { guardarHorarioRefaccionaria } from './datos';

const NOMBRES_DIA = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' };

// Horario de atención que se ve en la página pública (mismo formato que el de los yonkes). 1
// escritura por "Guardar horario".
export default function EditorHorario({ refaccionariaId, horarioInicial, onGuardado }) {
  const [horario, setHorario] = useState(() => ({ ...HORARIO_INICIAL, ...(horarioInicial || {}) }));
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const cambiar = (dia, campo, valor) => setHorario((h) => ({ ...h, [dia]: { ...h[dia], [campo]: valor } }));

  async function guardar() {
    setMensaje('');
    const v = validarHorario(horario);
    if (!v.ok) { setMensaje(v.mensaje); return; }
    setGuardando(true);
    try {
      await guardarHorarioRefaccionaria(refaccionariaId, v.horario);
      setMensaje('Horario guardado.');
      onGuardado?.(v.horario);
    } catch (err) {
      console.error('[panel/refaccionaria] No se pudo guardar el horario', err);
      setMensaje('No se pudo guardar el horario. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={tarjeta}>
      <h2 style={{ fontSize: '16px', color: '#1A3C5E', margin: '0 0 4px' }}>Horario de atención</h2>
      <p style={{ fontSize: '13px', color: '#666', margin: '0 0 10px' }}>Se muestra en tu página pública. Horas en formato 24 h, por ejemplo 09:00 y 18:30.</p>
      {DIAS_HORARIO.map((dia) => (
        <div key={dia} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '6px 0', borderTop: '1px solid #EEE' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '120px', fontSize: '14px', color: '#1A3C5E', fontWeight: '600' }}>
            <input type="checkbox" checked={horario[dia].abierto} onChange={(e) => cambiar(dia, 'abierto', e.target.checked)} />
            {NOMBRES_DIA[dia]}
          </label>
          {horario[dia].abierto ? (
            <>
              <input aria-label={`${NOMBRES_DIA[dia]} apertura`} value={horario[dia].apertura} maxLength={5}
                onChange={(e) => cambiar(dia, 'apertura', e.target.value.replace(/[^0-9:]/g, ''))} style={hora} />
              <span style={{ color: '#999' }}>a</span>
              <input aria-label={`${NOMBRES_DIA[dia]} cierre`} value={horario[dia].cierre} maxLength={5}
                onChange={(e) => cambiar(dia, 'cierre', e.target.value.replace(/[^0-9:]/g, ''))} style={hora} />
            </>
          ) : <span style={{ fontSize: '13px', color: '#999' }}>Cerrado</span>}
        </div>
      ))}
      <button type="button" onClick={guardar} disabled={guardando} style={boton}>{guardando ? 'Guardando...' : 'Guardar horario'}</button>
      {mensaje && <p role="status" style={{ margin: '8px 0 0', fontSize: '13px', color: '#1A3C5E' }}>{mensaje}</p>}
    </div>
  );
}

const tarjeta = { backgroundColor: '#fff', borderRadius: '14px', padding: '16px', marginBottom: '14px', boxShadow: '0 2px 8px rgba(26,60,94,0.06)' };
const hora = { width: '70px', padding: '8px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '14px', textAlign: 'center' };
const boton = { width: '100%', marginTop: '12px', padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#1A3C5E', color: '#fff', fontWeight: '700', fontSize: '15px', cursor: 'pointer' };
