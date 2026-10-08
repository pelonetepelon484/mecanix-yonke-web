'use client';

// Pestaña "Pedidos de talleres" (solicitudesPiezas): solo lectura de la lista y sus respuestas,
// más "Borrar", que las reglas de talleres ya permiten al admin (sin cambiarlas).
import { useCallback, useEffect, useState } from 'react';
import { borrarSolicitudTaller, leerRespuestasSolicitud, listarSolicitudesTalleres } from './datos';
import { fecha, pesos } from './PestanaClientes';

export default function PestanaTalleres({ estados }) {
  const [solicitudes, setSolicitudes] = useState(null);
  const [abierta, setAbierta] = useState(null);
  const [error, setError] = useState('');

  const cargar = useCallback(() => listarSolicitudesTalleres()
    .then((lista) => { setSolicitudes(lista); setError(''); })
    .catch((err) => { console.error(err); setError('No pudimos cargar los pedidos de talleres.'); }), []);

  useEffect(() => { cargar(); }, [cargar]);

  if (error) return <p role="alert" style={{ color: '#B3261E' }}>{error}</p>;
  if (solicitudes === null) return <p style={{ color: '#555' }}>Cargando...</p>;
  if (solicitudes.length === 0) return <p style={{ color: '#555' }}>No hay pedidos de talleres.</p>;

  const nombreEstado = (id) => estados.find((e) => e.id === id)?.nombre || id;

  return (
    <div>
      {solicitudes.map((s) => (
        <div key={s.id} style={tarjeta}>
          <button type="button" onClick={() => setAbierta(abierta === s.id ? null : s.id)} style={filaBoton}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
              <span style={{ fontWeight: 'bold', color: '#1A3C5E' }}>{s.pieza}</span>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#555' }}>{s.estadoSolicitud}</span>
            </div>
            <div style={{ fontSize: '13px', color: '#555', marginTop: '2px' }}>
              {s.vehiculo?.marca} {s.vehiculo?.modelo} {s.vehiculo?.anio} · {nombreEstado(s.estado)} · Taller: {s.tallerNombre}
            </div>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>Creado: {fecha(s.creadoAt)} · Vence: {fecha(s.expiraAt)}</div>
          </button>
          {abierta === s.id && <DetalleSolicitud solicitud={s} onBorrada={() => { setAbierta(null); cargar(); }} />}
        </div>
      ))}
    </div>
  );
}

function DetalleSolicitud({ solicitud, onBorrada }) {
  const [respuestas, setRespuestas] = useState(null);
  const [error, setError] = useState('');
  const [borrando, setBorrando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    leerRespuestasSolicitud(solicitud.id)
      .then((r) => { if (!cancelado) setRespuestas(r); })
      .catch((err) => { console.error(err); if (!cancelado) setError('No pudimos leer las respuestas.'); });
    return () => { cancelado = true; };
  }, [solicitud.id]);

  async function borrar() {
    if (!window.confirm('¿Borrar este pedido del taller, sus respuestas y el WhatsApp del taller? Esto no se puede deshacer.')) return;
    setBorrando(true);
    try {
      await borrarSolicitudTaller(solicitud.id);
      onBorrada();
    } catch (err) {
      console.error(err);
      setError('No se pudo borrar.');
      setBorrando(false);
    }
  }

  return (
    <div style={{ borderTop: '1px solid #EEE', marginTop: '10px', paddingTop: '10px' }}>
      {solicitud.nota && <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#555' }}>Nota: {solicitud.nota}</p>}
      {solicitud.yonkeElegido && <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#2E7D32' }}>Yonke elegido: {solicitud.yonkeElegido}</p>}
      <p style={{ margin: '0 0 6px', fontWeight: 'bold', color: '#1A3C5E' }}>Respuestas {respuestas ? `(${respuestas.length})` : ''}</p>
      {respuestas === null && !error && <p style={{ fontSize: '13px', color: '#555' }}>Cargando...</p>}
      {respuestas?.length === 0 && <p style={{ margin: 0, fontSize: '13px', color: '#888' }}>Ningún yonke ha respondido.</p>}
      {respuestas?.map((r) => (
        <div key={r.yonkeId} style={{ fontSize: '13px', padding: '8px 0', borderBottom: '1px solid #F2F2F2' }}>
          <strong>{r.yonkeNombre}</strong>
          <div>{r.tieneLaPieza ? `La tiene · ${pesos(r.precio)}` : 'No la tiene'}{r.nota ? ` · ${r.nota}` : ''}</div>
          <div style={{ color: '#555' }}>WhatsApp del yonke: {r.whatsapp || '—'}</div>
        </div>
      ))}
      {error && <p role="alert" style={{ color: '#B3261E', fontSize: '13px' }}>{error}</p>}
      <button type="button" onClick={borrar} disabled={borrando}
        style={{ marginTop: '12px', minHeight: '38px', padding: '0 14px', borderRadius: '10px', border: 'none', backgroundColor: '#B3261E', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
        Borrar
      </button>
    </div>
  );
}

const tarjeta = { backgroundColor: '#fff', borderRadius: '12px', padding: '12px 14px', marginBottom: '10px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' };
const filaBoton = { display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' };
