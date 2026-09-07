'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import mexicoMap from '@svg-maps/mexico';

// @svg-maps/mexico usa como `id` el código ISO 3166-2:MX en minúsculas (agu, bcn, ..., zac) —
// el mismo esquema que resolverGeoIp() ya guarda en `estadoGeografico` (ver
// lib/busqueda/geolocalizarIp.js). Nombres en español para mostrar (el paquete trae "Mexico
// City" sin acentos en varios casos).
const NOMBRES_ESTADO = {
  agu: 'Aguascalientes', bcn: 'Baja California', bcs: 'Baja California Sur',
  cam: 'Campeche', chp: 'Chiapas', chh: 'Chihuahua', coa: 'Coahuila', col: 'Colima',
  cmx: 'Ciudad de México', dur: 'Durango', gua: 'Guanajuato', gro: 'Guerrero',
  hid: 'Hidalgo', jal: 'Jalisco', mex: 'Estado de México', mic: 'Michoacán',
  mor: 'Morelos', nay: 'Nayarit', nle: 'Nuevo León', oax: 'Oaxaca', pue: 'Puebla',
  que: 'Querétaro', roo: 'Quintana Roo', slp: 'San Luis Potosí', sin: 'Sinaloa',
  son: 'Sonora', tab: 'Tabasco', tam: 'Tamaulipas', tla: 'Tlaxcala', ver: 'Veracruz',
  yuc: 'Yucatán', zac: 'Zacatecas',
};

const RANGOS = [
  { key: '7', label: '7 días', dias: 7 },
  { key: '30', label: '30 días', dias: 30 },
  { key: '90', label: '90 días', dias: 90 },
  { key: 'todo', label: 'Todo', dias: null },
];

const FILTROS_RESULTADO = [
  { key: 'todos', label: 'Todas' },
  { key: 'con', label: '✓ Con resultado' },
  { key: 'sin', label: '✗ Sin resultado' },
];

// conResultado es un campo nuevo (ver registrarBusqueda.js) — para docs escritos antes de este
// cambio, se infiere del `estado` de búsqueda ya existente, para no dejar vacío el mapa con
// datos históricos.
function tieneResultado(d) {
  return typeof d.conResultado === 'boolean' ? d.conResultado : d.estado === 'ok';
}

// Igual: docs viejos no tienen estadoGeografico — cuentan como "sin ubicación identificada",
// no se pierden, solo no se pueden ubicar en el mapa.
function claveEstado(d) {
  return d.estadoGeografico && d.estadoGeografico !== 'desconocido' ? d.estadoGeografico : null;
}

function queBuscaba(d) {
  const vehiculo = [d.marca, d.modelo, d.anio].filter(Boolean).join(' ');
  return [d.pieza, vehiculo].filter(Boolean).join(' — ') || d.textoOriginal || '(sin detalle)';
}

// Interpolación lineal de un azul claro (sin búsquedas) al azul de marca (#1A3C5E, máxima
// intensidad) — mismo tono que el header del panel, no se introduce una paleta nueva.
function colorPorIntensidad(valor, maximo) {
  if (!valor || maximo <= 0) return '#E6ECF2';
  const t = Math.min(1, valor / maximo);
  const de = [214, 226, 237];
  const a = [26, 60, 94];
  const mezcla = de.map((c, i) => Math.round(c + (a[i] - c) * t));
  return `rgb(${mezcla.join(',')})`;
}

export default function MapaBusquedasPage() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [rango, setRango] = useState('30');
  const [filtroResultado, setFiltroResultado] = useState('todos');
  const [docs, setDocs] = useState([]);
  const [estadoActivo, setEstadoActivo] = useState(null);

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      try {
        const ref = collection(db, 'busquedas');
        const rangoInfo = RANGOS.find((r) => r.key === rango);
        const restricciones = [orderBy('fecha', 'desc'), limit(5000)];
        if (rangoInfo?.dias) {
          const desde = new Date();
          desde.setDate(desde.getDate() - rangoInfo.dias);
          restricciones.push(where('fecha', '>=', Timestamp.fromDate(desde)));
        }
        const snap = await getDocs(query(ref, ...restricciones));
        setDocs(snap.docs.map((d) => d.data()));
      } catch (e) {
        console.error('[admin/busquedas/mapa] Error cargando datos', e);
      }
      setCargando(false);
    }
    cargar();
  }, [rango]);

  const docsFiltrados = useMemo(() => {
    if (filtroResultado === 'todos') return docs;
    return docs.filter((d) => (filtroResultado === 'con') === tieneResultado(d));
  }, [docs, filtroResultado]);

  const { conteoPorEstado, maximo, sinUbicacion } = useMemo(() => {
    const mapa = new Map();
    let sin = 0;
    for (const d of docsFiltrados) {
      const clave = claveEstado(d);
      if (!clave) { sin++; continue; }
      mapa.set(clave, (mapa.get(clave) || 0) + 1);
    }
    return { conteoPorEstado: mapa, maximo: Math.max(0, ...mapa.values()), sinUbicacion: sin };
  }, [docsFiltrados]);

  const piezasEnEstado = useMemo(() => {
    if (!estadoActivo) return [];
    const mapa = new Map();
    for (const d of docsFiltrados) {
      if (claveEstado(d) !== estadoActivo) continue;
      const clave = queBuscaba(d);
      const actual = mapa.get(clave) || { clave, conteo: 0, conResultado: 0 };
      actual.conteo++;
      if (tieneResultado(d)) actual.conResultado++;
      mapa.set(clave, actual);
    }
    return [...mapa.values()].sort((a, b) => b.conteo - a.conteo).slice(0, 15);
  }, [docsFiltrados, estadoActivo]);

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F0F2F5', fontFamily: "'Inter', sans-serif", paddingBottom: '40px' }}>
      <div style={{ backgroundColor: '#1A3C5E', padding: '20px 16px', paddingTop: '24px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <button onClick={() => router.push('/admin/busquedas')} style={{ background: 'none', border: 'none', color: '#E8720C', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold', padding: 0 }}>
            ← Volver a búsquedas
          </button>
          <h1 style={{ color: '#fff', fontSize: '18px', margin: '4px 0 0', fontWeight: '700' }}>Mapa de búsquedas</h1>
          <p style={{ color: '#cdd9e4', fontSize: '12px', margin: '2px 0 0' }}>
            Qué piezas se buscan y en dónde — {docsFiltrados.length} búsqueda{docsFiltrados.length === 1 ? '' : 's'}
            {sinUbicacion > 0 ? `, ${sinUbicacion} sin ubicación identificada` : ''}
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '16px' }}>
        {/* Filtros */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {RANGOS.map((r) => (
              <button key={r.key} onClick={() => setRango(r.key)} style={chipStyle(rango === r.key)}>{r.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {FILTROS_RESULTADO.map((f) => (
              <button key={f.key} onClick={() => setFiltroResultado(f.key)} style={chipStyle(filtroResultado === f.key)}>{f.label}</button>
            ))}
          </div>
        </div>

        {cargando ? (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '32px' }}>Cargando...</p>
        ) : (
          <>
            {/* Mapa */}
            <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '16px' }}>
              <svg viewBox={mexicoMap.viewBox} style={{ width: '100%', height: 'auto', maxHeight: '480px' }}>
                {mexicoMap.locations.map((loc) => {
                  const valor = conteoPorEstado.get(loc.id) || 0;
                  const activo = estadoActivo === loc.id;
                  return (
                    <path
                      key={loc.id}
                      d={loc.path}
                      fill={colorPorIntensidad(valor, maximo)}
                      stroke={activo ? '#E8720C' : '#fff'}
                      strokeWidth={activo ? 2 : 1}
                      onClick={() => setEstadoActivo(activo ? null : loc.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <title>{`${NOMBRES_ESTADO[loc.id] || loc.name}: ${valor} búsqueda${valor === 1 ? '' : 's'}`}</title>
                    </path>
                  );
                })}
              </svg>
              <p style={{ color: '#888', fontSize: '12px', textAlign: 'center', margin: '8px 0 0' }}>
                Haz clic en un estado para ver las piezas más buscadas ahí
              </p>
            </div>

            {/* Detalle del estado activo */}
            {estadoActivo && (
              <div style={{ marginBottom: '20px' }}>
                <h2 style={{ color: '#1A3C5E', fontSize: '15px', margin: '0 0 2px' }}>
                  {NOMBRES_ESTADO[estadoActivo] || estadoActivo}
                </h2>
                <p style={{ color: '#888', fontSize: '12px', margin: '0 0 10px' }}>
                  Piezas/vehículos más buscados — {conteoPorEstado.get(estadoActivo) || 0} búsqueda{(conteoPorEstado.get(estadoActivo) || 0) === 1 ? '' : 's'} en el periodo
                </p>
                {piezasEnEstado.length === 0 ? (
                  <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '14px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', color: '#aaa', fontSize: '13px', textAlign: 'center' }}>
                    Sin datos en este periodo
                  </div>
                ) : (
                  <div style={{ overflow: 'hidden', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#1A3C5E' }}>
                          <th style={thStyle}>Pieza / vehículo</th>
                          <th style={thStyle}>Veces buscado</th>
                          <th style={thStyle}>Con resultado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {piezasEnEstado.map((r, i) => (
                          <tr key={r.clave} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#F0F2F5' }}>
                            <td style={tdStyle}>{r.clave}</td>
                            <td style={tdStyle}>{r.conteo}</td>
                            <td style={tdStyle}>{r.conResultado} / {r.conteo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Ranking de estados */}
            <div>
              <h2 style={{ color: '#1A3C5E', fontSize: '15px', margin: '0 0 2px' }}>Estados con más búsquedas</h2>
              <p style={{ color: '#888', fontSize: '12px', margin: '0 0 10px' }}>En el periodo seleccionado</p>
              <div style={{ overflow: 'hidden', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#1A3C5E' }}>
                      <th style={thStyle}>Estado</th>
                      <th style={thStyle}>Búsquedas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...conteoPorEstado.entries()].sort((a, b) => b[1] - a[1]).map(([id, valor], i) => (
                      <tr
                        key={id}
                        onClick={() => setEstadoActivo(estadoActivo === id ? null : id)}
                        style={{ backgroundColor: estadoActivo === id ? '#FEF3EC' : (i % 2 === 0 ? '#fff' : '#F0F2F5'), cursor: 'pointer' }}
                      >
                        <td style={tdStyle}>{NOMBRES_ESTADO[id] || id}</td>
                        <td style={tdStyle}>{valor}</td>
                      </tr>
                    ))}
                    {conteoPorEstado.size === 0 && (
                      <tr><td colSpan={2} style={{ ...tdStyle, textAlign: 'center', color: '#aaa' }}>Sin datos todavía</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function chipStyle(activo) {
  return {
    padding: '7px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer',
    fontSize: '12px', fontWeight: '700', fontFamily: "'Inter', sans-serif",
    backgroundColor: activo ? '#E8720C' : '#fff', color: activo ? '#fff' : '#1A3C5E',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  };
}

const thStyle = { color: '#fff', textAlign: 'left', padding: '10px 12px', fontSize: '12px', fontWeight: '600' };
const tdStyle = { padding: '10px 12px', fontSize: '13px', color: '#333' };
