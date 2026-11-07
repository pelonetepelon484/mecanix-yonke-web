'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCitas } from './contexto';
import { listarPasadas, listarProximas } from './datos';
import TarjetaCita from './TarjetaCita';
import { TEXTO_RETENCION_CITA, inicioDelDia, separarHoy } from '../../../../lib/citasTaller';

// Agenda: "Hoy" y "Próximas" (de la más cercana a la más lejana). Las pasadas solo se cargan al
// tocar "Ver citas pasadas" (para no gastar lecturas).
export default function CitasPage() {
  const router = useRouter();
  const { tallerId, puedeEscribir } = useCitas();
  const [proximas, setProximas] = useState(null);
  const [pasadas, setPasadas] = useState(null);
  const [error, setError] = useState('');
  const [cargandoPasadas, setCargandoPasadas] = useState(false);

  useEffect(() => {
    let cancelado = false;
    listarProximas(tallerId, inicioDelDia())
      .then((r) => { if (!cancelado) setProximas(r); })
      .catch((err) => { console.error(err); if (!cancelado) setError('No pudimos cargar tus citas. Intenta de nuevo.'); });
    return () => { cancelado = true; };
  }, [tallerId]);

  async function verPasadas() {
    setCargandoPasadas(true);
    try {
      setPasadas(await listarPasadas(tallerId, inicioDelDia()));
    } catch (err) {
      console.error(err);
      setError('No pudimos cargar las citas pasadas. Intenta de nuevo.');
    } finally {
      setCargandoPasadas(false);
    }
  }

  const abrir = (c) => () => router.push(`/panel/taller/citas/${c.id}`);
  const grupos = proximas ? separarHoy(proximas) : null;

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '16px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <button type="button" onClick={() => router.push('/panel/taller')} style={volver}>← Inicio del taller</button>
        <h1 style={{ fontSize: '22px', color: '#1A3C5E', margin: '8px 0 6px' }}>Citas</h1>
        <p style={{ fontSize: '13px', color: '#555', margin: '0 0 12px' }}>{TEXTO_RETENCION_CITA}</p>
        {puedeEscribir && (
          <button type="button" onClick={() => router.push('/panel/taller/citas/nueva')} style={agregar}>＋ Agendar cita</button>
        )}

        {error && <p role="alert" style={{ color: '#B3261E' }}>{error}</p>}
        {!error && grupos === null && <p style={{ color: '#555' }}>Cargando...</p>}
        {grupos && (
          <>
            <h2 style={subtitulo}>Hoy</h2>
            {grupos.hoy.length === 0 && <p style={vacio}>No tienes citas hoy.</p>}
            {grupos.hoy.map((c) => <TarjetaCita key={c.id} cita={c} conDia={false} onAbrir={abrir(c)} />)}
            <h2 style={subtitulo}>Próximas</h2>
            {grupos.proximas.length === 0 && <p style={vacio}>No tienes citas próximas.</p>}
            {grupos.proximas.map((c) => <TarjetaCita key={c.id} cita={c} onAbrir={abrir(c)} />)}
          </>
        )}

        {pasadas === null ? (
          <button type="button" onClick={verPasadas} disabled={cargandoPasadas} style={secundario}>{cargandoPasadas ? 'Cargando...' : 'Ver citas pasadas'}</button>
        ) : (
          <>
            <h2 style={subtitulo}>Pasadas</h2>
            {pasadas.length === 0 && <p style={vacio}>No hay citas pasadas.</p>}
            {pasadas.map((c) => <TarjetaCita key={c.id} cita={c} onAbrir={abrir(c)} />)}
          </>
        )}
      </div>
    </main>
  );
}

const volver = { background: 'none', border: 'none', color: '#1A3C5E', fontWeight: '600', cursor: 'pointer', padding: 0, fontSize: '14px' };
const agregar = { width: '100%', minHeight: '52px', borderRadius: '12px', border: 'none', backgroundColor: '#E8720C', color: '#fff', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '6px' };
const subtitulo = { fontSize: '16px', color: '#1A3C5E', margin: '18px 0 8px' };
const vacio = { color: '#555', fontSize: '14px', margin: '0 0 8px' };
const secundario = { width: '100%', minHeight: '48px', borderRadius: '12px', border: '1px solid #1A3C5E', backgroundColor: '#fff', color: '#1A3C5E', fontWeight: 'bold', cursor: 'pointer', marginTop: '18px' };
