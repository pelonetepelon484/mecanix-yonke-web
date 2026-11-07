'use client';

// Mapa de /asistencia-vial (etapa 2, con config/portada.asistenciaVialMapa). Pide las ubicaciones
// vigentes a /api/asistencia-vial/ubicaciones (guardadas 2 minutos en la red: pocas lecturas) y las
// junta con los proveedores activos que ya mandó el servidor.
// "Usar mi ubicación": la posición del cliente se usa SOLO aquí para medir distancias; no se guarda
// ni se manda a ningún lado.
// Mapa: Leaflet 1.9.4 desde unpkg con su huella de seguridad (SRI) y mosaicos de OpenStreetMap. Si
// no carga, la lista sigue funcionando igual.
import { useEffect, useRef, useState } from 'react';
import { MENSAJES_UBICACION, proveedoresEnMapa, textoDistancia, textoHasta } from '../../lib/ubicacionAsistencia';

const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_JS_SRI = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_CSS_SRI = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
const CENTRO_TIJUANA = [32.5149, -117.0382];

let cargaLeaflet = null;
export function cargarLeaflet() {
  if (typeof window === 'undefined') return Promise.reject(new Error('sin navegador'));
  if (window.L) return Promise.resolve(window.L);
  if (!cargaLeaflet) {
    cargaLeaflet = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      Object.assign(css, { rel: 'stylesheet', href: LEAFLET_CSS, integrity: LEAFLET_CSS_SRI, crossOrigin: '' });
      document.head.appendChild(css);
      const js = document.createElement('script');
      Object.assign(js, { src: LEAFLET_JS, integrity: LEAFLET_JS_SRI, crossOrigin: '', async: true });
      js.onload = () => (window.L ? resolve(window.L) : reject(new Error('Leaflet no cargó')));
      js.onerror = () => { cargaLeaflet = null; reject(new Error('Leaflet no cargó')); };
      document.head.appendChild(js);
    });
  }
  return cargaLeaflet;
}

function ubicacionDelCelular() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { reject(new Error(MENSAJES_UBICACION.sinGps)); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(new Error(e?.code === 1 ? MENSAJES_UBICACION.sinPermiso : MENSAJES_UBICACION.sinGps)),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 },
    );
  });
}

// Texto del globo de cada punto, armado con textContent (nunca HTML con el nombre).
function globo(nombre, detalle) {
  const div = document.createElement('div');
  const fuerte = document.createElement('strong');
  fuerte.textContent = nombre;
  const linea = document.createElement('div');
  linea.textContent = detalle;
  div.append(fuerte, linea);
  return div;
}

function Mapa({ puntos, cliente }) {
  const caja = useRef(null);
  const mapa = useRef(null);
  const capa = useRef(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let cancelado = false;
    cargarLeaflet()
      .then((L) => {
        if (cancelado || !caja.current || mapa.current) return;
        mapa.current = L.map(caja.current, { scrollWheelZoom: false }).setView(CENTRO_TIJUANA, 11);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(mapa.current);
        capa.current = L.layerGroup().addTo(mapa.current);
        setFallo(false);
        dibujar(L);
      })
      .catch(() => { if (!cancelado) setFallo(true); });
    return () => { cancelado = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function dibujar(L) {
    if (!mapa.current || !capa.current) return;
    capa.current.clearLayers();
    const limites = [];
    puntos.forEach(({ proveedor, ubicacion, km }) => {
      const detalle = [km !== null ? textoDistancia(km) : null, textoHasta(ubicacion.hastaAt)].filter(Boolean).join(' · ');
      L.circleMarker([ubicacion.lat, ubicacion.lng], { radius: 10, color: '#fff', weight: 2, fillColor: '#E8720C', fillOpacity: 0.95 })
        .bindPopup(globo(proveedor.nombre, detalle)).addTo(capa.current);
      limites.push([ubicacion.lat, ubicacion.lng]);
    });
    if (cliente) {
      L.circleMarker([cliente.lat, cliente.lng], { radius: 8, color: '#fff', weight: 2, fillColor: '#1A73E8', fillOpacity: 1 })
        .bindPopup(globo('Tú', 'Tu ubicación no se guarda')).addTo(capa.current);
      limites.push([cliente.lat, cliente.lng]);
    }
    if (limites.length > 1) mapa.current.fitBounds(limites, { padding: [30, 30], maxZoom: 14 });
    else if (limites.length === 1) mapa.current.setView(limites[0], 13);
  }

  // Se vuelve a dibujar solo si cambian los puntos o la ubicación del cliente (no en cada pantalla).
  const clave = JSON.stringify([puntos.map((x) => [x.proveedor.id, x.ubicacion.lat, x.ubicacion.lng, x.ubicacion.hastaAt]), cliente]);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.L) dibujar(window.L);
  }, [clave]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (mapa.current) { mapa.current.remove(); mapa.current = null; } }, []);

  if (fallo) return <p style={{ fontSize: '13px', color: '#555', margin: '8px 0' }}>No pudimos cargar el mapa. La lista de abajo funciona igual.</p>;
  return <div ref={caja} role="region" aria-label="Mapa de proveedores" style={{ height: '320px', borderRadius: '16px', overflow: 'hidden', margin: '10px 0', backgroundColor: '#E3EAF2' }} />;
}

export default function MapaAsistencia({ proveedores = [], Tarjeta, ahoraMs: ahoraServidor }) {
  const [ubicaciones, setUbicaciones] = useState(null);
  const [ahora, setAhora] = useState(ahoraServidor ?? 0);
  const [cliente, setCliente] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    let cancelado = false;
    fetch('/api/asistencia-vial/ubicaciones')
      .then((r) => (r.ok ? r.json() : { ubicaciones: [] }))
      .then((j) => { if (!cancelado) { setAhora(Date.now()); setUbicaciones(Array.isArray(j.ubicaciones) ? j.ubicaciones : []); } })
      .catch(() => { if (!cancelado) setUbicaciones([]); });
    return () => { cancelado = true; };
  }, []);

  async function usarMiUbicacion() {
    setBuscando(true); setAviso('');
    try {
      setCliente(await ubicacionDelCelular());
    } catch (err) {
      setAviso(err.message);
    } finally {
      setBuscando(false);
    }
  }

  if (ubicaciones === null) return null;
  const puntos = proveedoresEnMapa(proveedores, ubicaciones, cliente, ahora);
  if (puntos.length === 0) {
    return <p role="status" style={nota}>📍 Por ahora ningún proveedor ha marcado dónde está. Usa la lista de abajo.</p>;
  }

  return (
    <section style={{ marginTop: '18px' }} aria-label="En el mapa ahora">
      <h2 style={subtitulo}>📍 En el mapa ahora</h2>
      <button type="button" onClick={usarMiUbicacion} disabled={buscando} style={botonUbicacion}>
        {buscando ? 'Buscando tu ubicación...' : (cliente ? 'Actualizar mi ubicación' : '📍 Usar mi ubicación para ver al más cercano')}
      </button>
      <p style={{ fontSize: '12px', color: '#555', margin: '6px 0 0' }}>Tu ubicación solo se usa en tu celular para medir la distancia: no se guarda. Las distancias son aproximadas.</p>
      {aviso && <p role="alert" style={{ color: '#B3261E', fontSize: '14px' }}>{aviso}</p>}
      <Mapa puntos={puntos} cliente={cliente} />
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '12px' }}>
        {puntos.map(({ proveedor, ubicacion, km }) => (
          <Tarjeta key={proveedor.id} p={proveedor} ahoraMs={ahora} extra={[km !== null ? textoDistancia(km) : null, textoHasta(ubicacion.hastaAt)].filter(Boolean).join(' · ')} />
        ))}
      </ul>
    </section>
  );
}

const subtitulo = { fontSize: '15px', color: '#1A3C5E', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 10px' };
const botonUbicacion = { width: '100%', minHeight: '52px', borderRadius: '14px', border: 'none', backgroundColor: '#E8720C', color: '#fff', fontSize: '16px', fontWeight: '800', cursor: 'pointer' };
const nota = { marginTop: '14px', padding: '12px 14px', borderRadius: '12px', backgroundColor: '#fff', color: '#1A3C5E', fontSize: '14px', lineHeight: '1.5' };
