'use client';

import { useEffect, useState } from 'react';
import { MENSAJES_UBICACION, MINUTOS_ESTANCIA, esSecretoValido, textoHoraCorta, textoMinutos } from '../../../lib/ubicacionAsistencia';

const RUTA = '/api/asistencia-vial/aqui';

async function llamar(cuerpo) {
  const res = await fetch(RUTA, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo), cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || MENSAJES_UBICACION.fallo);
  return json;
}

function ubicacionDelCelular() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { reject(new Error(MENSAJES_UBICACION.sinGps)); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(new Error(e?.code === 1 ? MENSAJES_UBICACION.sinPermiso : MENSAJES_UBICACION.sinGps)),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  });
}

// Pantalla del proveedor: escoge cuánto tiempo estará en ese lugar y toca "Estoy aquí". Se guarda
// su ubicación redondeada (unos 300 m) hasta esa hora; "Ya me fui" lo quita del mapa antes.
export default function AquiClient() {
  const [secreto, setSecreto] = useState(null);
  const [estado, setEstado] = useState({ cargando: true, nombre: '', hastaMs: null, error: '' });
  const [minutos, setMinutos] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    const s = window.location.hash.slice(1);
    if (!esSecretoValido(s)) { setEstado({ cargando: false, nombre: '', hastaMs: null, error: MENSAJES_UBICACION.enlaceInvalido }); return; }
    setSecreto(s);
    llamar({ secreto: s, accion: 'estado' })
      .then((r) => setEstado({ cargando: false, nombre: r.nombre, hastaMs: r.hastaMs, error: '' }))
      .catch((err) => setEstado({ cargando: false, nombre: '', hastaMs: null, error: err.message }));
  }, []);

  async function llegue() {
    if (!minutos) { setAviso(MENSAJES_UBICACION.tiempo); return; }
    setOcupado(true); setAviso('');
    try {
      const { lat, lng } = await ubicacionDelCelular();
      const r = await llamar({ secreto, accion: 'llegue', lat, lng, minutos });
      setEstado((e) => ({ ...e, hastaMs: r.hastaMs }));
      setMinutos(null);
    } catch (err) {
      setAviso(err.message);
    } finally {
      setOcupado(false);
    }
  }

  async function meFui() {
    setOcupado(true); setAviso('');
    try {
      await llamar({ secreto, accion: 'me-fui' });
      setEstado((e) => ({ ...e, hastaMs: null }));
    } catch (err) {
      setAviso(err.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '16px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        <p style={{ fontSize: '13px', color: '#E8720C', letterSpacing: '2px', fontWeight: 'bold', margin: '8px 0' }}>ASISTENCIA VIAL · RED MECANIX</p>
        {estado.cargando && <p style={{ color: '#555' }}>Cargando...</p>}
        {!estado.cargando && estado.error && <p role="alert" style={{ color: '#B3261E', fontSize: '16px' }}>{estado.error}</p>}
        {!estado.cargando && !estado.error && (
          <>
            <h1 style={{ fontSize: '22px', color: '#1A3C5E', margin: '0 0 6px' }}>{estado.nombre}</h1>
            {estado.hastaMs ? (
              <p role="status" style={enMapa}>✅ Estás en el mapa hasta las {textoHoraCorta(estado.hastaMs)}.</p>
            ) : (
              <p style={{ color: '#555', fontSize: '15px', margin: '0 0 14px' }}>Ahora no apareces en el mapa.</p>
            )}

            <p style={{ fontWeight: 'bold', color: '#1A3C5E', margin: '16px 0 8px' }}>¿Cuánto tiempo estarás aquí?</p>
            <div role="radiogroup" aria-label="¿Cuánto tiempo estarás aquí?" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {MINUTOS_ESTANCIA.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={minutos === m} onClick={() => setMinutos(m)} style={minutos === m ? opcionElegida : opcion}>
                  {textoMinutos(m)}
                </button>
              ))}
            </div>
            <button type="button" onClick={llegue} disabled={ocupado} style={principal}>{ocupado ? 'Guardando...' : '📍 Estoy aquí'}</button>
            {estado.hastaMs && <button type="button" onClick={meFui} disabled={ocupado} style={secundario}>Ya me fui</button>}
            {aviso && <p role="alert" style={{ color: '#B3261E', fontSize: '14px' }}>{aviso}</p>}
            <p style={{ fontSize: '13px', color: '#555', lineHeight: 1.5, marginTop: '18px' }}>
              Tu ubicación se guarda aproximada (unos 300 metros) y solo hasta la hora que escojas. Después dejas de salir en el mapa. Este enlace es solo para ti: no lo compartas.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

const enMapa = { backgroundColor: '#E6F4EA', color: '#1E6B34', borderRadius: '12px', padding: '12px', fontSize: '15px', fontWeight: '600', margin: '0 0 8px' };
const opcion = { minHeight: '52px', borderRadius: '12px', border: '1px solid #1A3C5E', backgroundColor: '#fff', color: '#1A3C5E', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' };
const opcionElegida = { ...opcion, backgroundColor: '#1A3C5E', color: '#fff' };
const principal = { width: '100%', minHeight: '60px', borderRadius: '14px', border: 'none', backgroundColor: '#E8720C', color: '#fff', fontSize: '19px', fontWeight: 'bold', cursor: 'pointer', marginTop: '16px' };
const secundario = { width: '100%', minHeight: '50px', borderRadius: '12px', border: '1px solid #B3261E', backgroundColor: '#fff', color: '#B3261E', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' };
