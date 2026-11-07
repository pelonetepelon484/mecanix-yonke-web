'use client';

import { NOMBRES_ESTADO_CITA, fechaDeCita, textoDia, textoHora } from '../../../../lib/citasTaller';

const COLORES_ESTADO = {
  pendiente: { fondo: '#FFF4E5', texto: '#8A4B00' },
  confirmada: { fondo: '#E6F4EA', texto: '#1E6B34' },
  atendida: { fondo: '#E8EEF5', texto: '#1A3C5E' },
  cancelada: { fondo: '#FDECEA', texto: '#B3261E' },
};

// Renglón de una cita en la lista: hora (y día si no es de hoy), cliente, vehículo y estado.
export default function TarjetaCita({ cita, conDia = true, onAbrir }) {
  const f = fechaDeCita(cita);
  const color = COLORES_ESTADO[cita.estado] ?? COLORES_ESTADO.pendiente;
  return (
    <button type="button" onClick={onAbrir} style={tarjeta}>
      <span style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
        <strong style={{ color: '#1A3C5E', fontSize: '16px' }}>
          {f ? `${conDia ? `${textoDia(f)}, ` : ''}${textoHora(f)}` : ''}
        </strong>
        <span style={{ fontSize: '12px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '999px', backgroundColor: color.fondo, color: color.texto, whiteSpace: 'nowrap' }}>
          {NOMBRES_ESTADO_CITA[cita.estado] ?? cita.estado}
        </span>
      </span>
      <span style={{ display: 'block', color: '#333', marginTop: '4px' }}>{cita.nombre}</span>
      {(cita.vehiculo || cita.placas) && (
        <span style={{ display: 'block', fontSize: '13px', color: '#555' }}>🚗 {[cita.vehiculo, cita.placas].filter(Boolean).join(' · ')}</span>
      )}
      {cita.motivo && <span style={{ display: 'block', fontSize: '13px', color: '#555' }}>{cita.motivo}</span>}
    </button>
  );
}

const tarjeta = { display: 'block', width: '100%', textAlign: 'left', backgroundColor: '#fff', border: '1px solid #E3E3E3', borderRadius: '14px', padding: '14px', marginBottom: '10px', cursor: 'pointer', fontSize: '14px' };
