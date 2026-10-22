'use client';

// Página pública del seguimiento: pide /api/seguimiento/{token} y muestra SOLO lo que devuelve
// (taller, vehículo, estado, nota y última actualización). Todo como texto, nunca como HTML.
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { MENSAJES_SEGUIMIENTO, enlaceWhatsappAlTaller } from '../../../lib/seguimiento';

const fondo = { minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '16px', boxSizing: 'border-box' };
const tarjeta = { maxWidth: '520px', margin: '24px auto', backgroundColor: '#fff', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' };
const fechaHora = (iso) => new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function SeguimientoCliente() {
  const { token } = useParams();
  const [estado, setEstado] = useState({ cargando: true, seguimiento: null, mensaje: '' });

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/seguimiento/${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async (r) => {
        const cuerpo = await r.json().catch(() => ({}));
        if (cancelado) return;
        if (r.ok && cuerpo.ok && cuerpo.seguimiento) setEstado({ cargando: false, seguimiento: cuerpo.seguimiento, mensaje: '' });
        else setEstado({ cargando: false, seguimiento: null, mensaje: cuerpo.mensaje || MENSAJES_SEGUIMIENTO.noEncontrado });
      })
      .catch(() => { if (!cancelado) setEstado({ cargando: false, seguimiento: null, mensaje: MENSAJES_SEGUIMIENTO.noDisponible }); });
    return () => { cancelado = true; };
  }, [token]);

  if (estado.cargando) return <main style={fondo}><p style={{ ...tarjeta, color: '#555' }}>Cargando...</p></main>;
  if (!estado.seguimiento) {
    return (
      <main style={fondo}>
        <div style={tarjeta}>
          <h1 style={{ fontSize: '20px', color: '#1A3C5E', margin: '0 0 8px' }}>Seguimiento de tu orden</h1>
          <p role="alert" style={{ color: '#8A2A1A', fontSize: '15px', margin: 0 }}>{estado.mensaje}</p>
        </div>
      </main>
    );
  }

  const s = estado.seguimiento;
  const vehiculo = [s.marca, s.modelo, s.anio].filter((x) => x !== null && x !== undefined && x !== '').join(' ');
  const whatsapp = enlaceWhatsappAlTaller(s);
  return (
    <main style={fondo}>
      <div style={tarjeta}>
        <p style={{ fontSize: '14px', color: '#555', margin: '0 0 4px' }}>{s.tallerNombre}</p>
        <h1 style={{ fontSize: '22px', color: '#1A3C5E', margin: '0 0 14px' }}>{vehiculo || 'Tu vehículo'}</h1>
        <p style={{ fontSize: '14px', color: '#555', margin: 0 }}>Estado</p>
        <p data-testid="estado" style={{ fontSize: '24px', fontWeight: 'bold', color: '#E8720C', margin: '0 0 14px' }}>{s.estadoNombre}</p>
        {s.nota && (
          <>
            <p style={{ fontSize: '14px', color: '#555', margin: 0 }}>Nota del taller</p>
            <p data-testid="nota" style={{ fontSize: '16px', color: '#222', margin: '0 0 14px', whiteSpace: 'pre-wrap' }}>{s.nota}</p>
          </>
        )}
        {s.actualizadoAt && <p style={{ fontSize: '13px', color: '#777', margin: '0 0 16px' }}>Última actualización: {fechaHora(s.actualizadoAt)}</p>}
        {whatsapp && (
          <a
            href={whatsapp} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '52px', borderRadius: '12px', backgroundColor: '#1E7E34', color: '#fff', fontSize: '16px', fontWeight: 'bold', textDecoration: 'none' }}
          >
            Escribir al taller por WhatsApp
          </a>
        )}
      </div>
    </main>
  );
}
