'use client';

// Cuentas que entran con WhatsApp: su correo interno no recibe correos, así que el admin restablece
// la contraseña desde aquí. El código temporal se muestra una sola vez, y solo vive en esta pantalla.
import { useState } from 'react';
import { auth } from '../../../lib/firebase';
import { HORAS_CODIGO, mensajeCodigoTemporal } from '../../../../lib/codigoTemporal';

const MENSAJES = {
  noConfigurado: 'Falta configurar la llave en Vercel.',
  limite: 'Se alcanzó el máximo de restablecimientos por hoy.',
  noAplica: 'Esta cuenta no entra con WhatsApp.',
};

export default function RestablecerPassword({ usuarioId }) {
  const [trabajando, setTrabajando] = useState(false);
  const [temporal, setTemporal] = useState('');
  const [error, setError] = useState('');
  const [copiada, setCopiada] = useState(false);

  async function restablecer() {
    if (!window.confirm('¿Restablecer la contraseña de esta cuenta?\n\nHazlo solo si te escribió desde el WhatsApp registrado. Su contraseña actual dejará de servir y se cerrarán sus sesiones.')) return;
    setTrabajando(true);
    setError('');
    setTemporal('');
    setCopiada(false);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/admin/restablecer-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ usuarioId }),
      });
      const datos = await res.json().catch(() => null);
      if (res.ok && datos?.ok && datos.temporal) setTemporal(datos.temporal);
      else setError(MENSAJES[datos?.motivo] || 'No se pudo restablecer. La contraseña no cambió.');
    } catch (err) {
      console.error(err);
      setError('No se pudo restablecer. Revisa tu conexión.');
    } finally {
      setTrabajando(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensajeCodigoTemporal(temporal));
      setCopiada(true);
    } catch {
      setError('No se pudo copiar. Selecciona el texto y cópialo a mano.');
    }
  }

  return (
    <div style={{ flexBasis: '100%' }}>
      <button
        onClick={restablecer}
        disabled={trabajando}
        style={{ background: 'none', border: 'none', color: '#1A3C5E', fontWeight: 'bold', fontSize: '13px', cursor: trabajando ? 'wait' : 'pointer', padding: 0 }}
      >
        {trabajando ? 'Restableciendo...' : 'Restablecer contraseña'}
      </button>
      {temporal && (
        <div style={{ marginTop: '8px', padding: '10px', borderRadius: '8px', backgroundColor: '#FFF8E1', border: '1px solid #FFD54F' }}>
          <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#555' }}>Contraseña temporal, válida {HORAS_CODIGO} horas y de un solo uso. Se muestra solo esta vez: mándala por WhatsApp a ese mismo número.</p>
          <code style={{ display: 'block', fontSize: '16px', fontWeight: 'bold', color: '#1A3C5E', marginBottom: '6px', wordBreak: 'break-all' }}>{temporal}</code>
          <button onClick={copiar} style={{ minHeight: '34px', padding: '0 12px', borderRadius: '8px', border: 'none', backgroundColor: '#1A3C5E', color: '#fff', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>
            {copiada ? 'Mensaje copiado' : 'Copiar mensaje'}
          </button>
        </div>
      )}
      {error && <p role="alert" style={{ margin: '6px 0 0', color: '#C62828', fontSize: '13px' }}>{error}</p>}
    </div>
  );
}
