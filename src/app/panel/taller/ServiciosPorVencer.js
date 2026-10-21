'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { enlaceWhatsappHistorial, mensajeWhatsappRecordatorio, nombreVehiculo, pendientesPorAvisar } from '../../../lib/historialTaller';
import { listarPorBorrarse, listarPorVencer, recordatoriosDe, telefonoDeOrden } from './historial/datos';
import { fechaLarga } from './historial/formato';

// Inicio del taller (con config/historialTaller): "Servicios por vencer" (proximoAviso <= hoy) y
// "Se borrarán pronto" (expiraAt <= hoy + 30 días). Solo avisa al taller: Mecanix nunca contacta a
// los clientes. WhatsApp: el teléfono se lee de la orden ultimoFolio EN ESE MOMENTO (si ya no
// existe, wa.me sin número); nunca se guarda en el historial.
export default function ServiciosPorVencer({ tallerId, nombreTaller }) {
  const router = useRouter();
  const [porVencer, setPorVencer] = useState(null);
  const [porBorrarse, setPorBorrarse] = useState(null);
  const [error, setError] = useState('');
  const [abriendo, setAbriendo] = useState(null);
  // Hora de la carga (no durante el dibujo): decide qué recordatorios ya tocan.
  const [ahora, setAhora] = useState(0);

  useEffect(() => {
    if (!tallerId) return undefined;
    let cancelado = false;
    Promise.all([listarPorVencer(tallerId), listarPorBorrarse(tallerId)])
      .then(([v, b]) => { if (!cancelado) { setAhora(Date.now()); setPorVencer(v); setPorBorrarse(b); } })
      .catch((err) => { console.error(err); if (!cancelado) setError('No pudimos cargar tus servicios por vencer.'); });
    return () => { cancelado = true; };
  }, [tallerId]);

  async function whatsapp(v, pendientes) {
    setAbriendo(v.id);
    try {
      const telefono = await telefonoDeOrden(tallerId, v.ultimoFolio);
      const mensaje = mensajeWhatsappRecordatorio(nombreTaller, v, pendientes.map((r) => r.tipo), fechaLarga(new Date(pendientes[0].fecha)));
      // Misma pestaña: abrir una ventana nueva después de esperar la lectura lo bloquean los celulares.
      window.location.href = enlaceWhatsappHistorial(telefono, mensaje);
    } finally {
      setAbriendo(null);
    }
  }

  if (error) return <p role="alert" style={{ color: '#B3261E', fontSize: '14px' }}>{error}</p>;
  if (porVencer === null) return null;

  return (
    <div style={{ margin: '0 0 24px' }}>
      <section aria-label="Servicios por vencer">
        <h2 style={titulo}>🔔 Servicios por vencer</h2>
        {porVencer.length === 0 && <p style={vacio}>No tienes servicios por vencer.</p>}
        {porVencer.map((v) => {
          const pendientes = pendientesPorAvisar(recordatoriosDe(v), ahora);
          return (
            <div key={v.id} style={tarjeta}>
              <button type="button" onClick={() => router.push(`/panel/taller/historial/${v.id}`)} style={enlace}>
                <strong>{v.placas}</strong> · {nombreVehiculo(v)}
              </button>
              {pendientes.map((r) => (
                <p key={r.id} style={{ margin: '2px 0', fontSize: '14px', color: '#333' }}>{r.tipo} · {fechaLarga(new Date(r.fecha))}</p>
              ))}
              <button type="button" onClick={() => whatsapp(v, pendientes)} disabled={abriendo === v.id || pendientes.length === 0} style={botonWhatsapp}>
                {abriendo === v.id ? 'Abriendo...' : '💬 Recordar por WhatsApp'}
              </button>
            </div>
          );
        })}
      </section>
      {porBorrarse && porBorrarse.length > 0 && (
        <section aria-label="Se borrarán pronto">
          <h2 style={titulo}>🗑️ Se borrarán pronto</h2>
          <p style={vacio}>Se borran solos 18 meses después de su último servicio. Agrega un servicio para conservarlos.</p>
          {porBorrarse.map((v) => (
            <button key={v.id} type="button" onClick={() => router.push(`/panel/taller/historial/${v.id}`)} style={{ ...tarjeta, ...enlace, display: 'block', width: '100%', textAlign: 'left' }}>
              <strong>{v.placas}</strong> · {nombreVehiculo(v)}
              <span style={{ display: 'block', fontSize: '13px', color: '#8A2A1A' }}>Se borrará el {fechaLarga(v.expiraAt)}</span>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}

const titulo = { fontSize: '17px', color: '#1A3C5E', margin: '8px 0 8px' };
const vacio = { fontSize: '14px', color: '#555', margin: '0 0 10px' };
const tarjeta = { backgroundColor: '#fff', border: '1px solid #E3E3E3', borderRadius: '14px', padding: '12px 14px', marginBottom: '10px' };
const enlace = { background: 'none', border: 'none', padding: 0, color: '#1A3C5E', cursor: 'pointer', fontSize: '15px', textAlign: 'left' };
const botonWhatsapp = { width: '100%', minHeight: '44px', marginTop: '8px', borderRadius: '10px', border: 'none', backgroundColor: '#25D366', color: '#fff', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' };
