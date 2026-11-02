'use client';

// Evidencias de "Sugerir yonke" (evidenciasSugerir): autorización escrita del yonke, separada del
// pedido porque este se borra a los 5 días. Duran 30 días naturales y las borra una política TTL.
// Si hay una reclamación dentro del plazo se conservan; al atenderla, el admin las borra de aquí.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MAX_MOTIVO_CONSERVACION, nombreMedio } from '../../../lib/evidenciaSugerir';
import { borrarEvidenciaConservada, conservarEvidencia, listarEvidencias } from '../pedidos/datos';

function formatearFecha(fecha) {
  if (!fecha?.toDate) return '—';
  return fecha.toDate().toLocaleString('es-MX', { timeZone: 'America/Tijuana', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Evidencia({ e, onCambio }) {
  const [motivo, setMotivo] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState('');
  const conservada = !e.expiraAt;

  async function ejecutar(accion) {
    setTrabajando(true);
    setError('');
    try {
      await accion();
      onCambio();
    } catch (err) {
      console.error(err);
      setError('No se pudo guardar. Revisa tu conexión y tus permisos de admin.');
      setTrabajando(false);
    }
  }

  function borrar() {
    if (!window.confirm('¿Borrar esta evidencia? Hazlo solo si la reclamación ya se atendió. No se puede deshacer.')) return;
    ejecutar(() => borrarEvidenciaConservada(e.id));
  }

  return (
    <article style={tarjeta}>
      <p style={{ margin: '0 0 4px', fontWeight: 'bold', color: '#1A3C5E' }}>{e.yonkeNombre} · {e.yonkeWhatsapp}</p>
      <p style={linea}><strong>Búsqueda:</strong> {e.busqueda}</p>
      <p style={linea}><strong>Medio:</strong> {nombreMedio(e.medio)}</p>
      <p style={linea}><strong>Recibido:</strong> {formatearFecha(e.recibidoAt)}</p>
      <p style={linea}><strong>Registrado:</strong> {formatearFecha(e.creadoAt)} por {e.adminEmail || e.adminUid}</p>
      <p style={{ ...linea, whiteSpace: 'pre-wrap', padding: '8px', borderRadius: '8px', backgroundColor: '#F5F5F5' }}>{e.mensaje}</p>
      {conservada ? (
        <>
          <p style={linea}><strong>Conservada por reclamación</strong> desde {formatearFecha(e.conservadaAt)}: {e.motivoConservacion}</p>
          <button type="button" disabled={trabajando} onClick={borrar} style={boton('#B3261E')}>Borrar: reclamación atendida</button>
        </>
      ) : (
        <>
          <p style={linea}><strong>Se borra el:</strong> {formatearFecha(e.expiraAt)}</p>
          <label style={{ display: 'block', fontSize: '13px', color: '#555' }}>
            Motivo de la reclamación
            <input
              type="text"
              maxLength={MAX_MOTIVO_CONSERVACION}
              value={motivo}
              onChange={(ev) => setMotivo(ev.target.value)}
              style={{ display: 'block', width: '100%', boxSizing: 'border-box', minHeight: '40px', borderRadius: '10px', border: '1px solid #CCC', padding: '0 10px', fontSize: '14px' }}
            />
          </label>
          <button type="button" disabled={trabajando || motivo.trim() === ''} onClick={() => ejecutar(() => conservarEvidencia(e.id, motivo.trim()))} style={boton('#E8720C')}>
            Conservar por reclamación
          </button>
        </>
      )}
      {error && <p role="alert" style={{ margin: '6px 0 0', color: '#B3261E', fontSize: '13px' }}>{error}</p>}
    </article>
  );
}

export default function AdminEvidenciasPage() {
  const router = useRouter();
  const [evidencias, setEvidencias] = useState(null);
  const [error, setError] = useState('');

  function cargar() {
    listarEvidencias()
      .then(setEvidencias)
      .catch((err) => { console.error(err); setEvidencias([]); setError('No pudimos cargar las evidencias.'); });
  }
  useEffect(cargar, []);

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F6F8', padding: '24px 16px' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        <button type="button" onClick={() => router.push('/admin')} style={boton('#1A3C5E')}>← Volver al admin</button>
        <h1 style={{ color: '#1A3C5E', fontSize: '22px' }}>Evidencias de Sugerir yonke</h1>
        <p style={{ color: '#555', fontSize: '14px' }}>Se borran solas a los 30 días naturales, salvo las que conserves por una reclamación.</p>
        {error && <p role="alert" style={{ color: '#B3261E' }}>{error}</p>}
        {evidencias === null ? <p>Cargando...</p>
          : evidencias.length === 0 ? <p style={{ color: '#888' }}>No hay evidencias guardadas.</p>
            : evidencias.map((e) => <Evidencia key={e.id} e={e} onCambio={cargar} />)}
      </div>
    </main>
  );
}

const tarjeta = { backgroundColor: '#fff', borderRadius: '12px', padding: '14px', marginBottom: '12px', border: '1px solid #E0E0E0' };
const linea = { margin: '0 0 6px', fontSize: '13px', color: '#333' };
function boton(color) {
  return { marginTop: '6px', minHeight: '34px', padding: '0 12px', borderRadius: '10px', border: 'none', backgroundColor: color, color: '#fff', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' };
}
