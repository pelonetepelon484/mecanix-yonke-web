'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, orderBy, limit, getDocs, getCountFromServer } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const ESTADOS = [
  { key: 'ok', label: 'Con resultados', color: '#2E7D32' },
  { key: 'sin_inventario', label: 'Sin inventario', color: '#E8720C' },
  { key: 'fuera_de_catalogo', label: 'Fuera de catálogo', color: '#E8720C' },
  { key: 'parseo_parcial', label: 'Parseo parcial', color: '#C62828' },
  { key: 'fuera_de_giro', label: 'Fuera de giro', color: '#C62828' },
  { key: 'no_interpretada', label: 'No interpretada', color: '#C62828' },
];

function formatearFecha(fecha) {
  const f = fecha?.toDate ? fecha.toDate() : new Date(fecha);
  return f.toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function agruparPorClave(docs, obtenerClave) {
  const mapa = new Map();
  for (const d of docs) {
    const clave = obtenerClave(d);
    if (!clave) continue;
    const actual = mapa.get(clave) || { clave, conteo: 0, ultima: null };
    actual.conteo++;
    const fecha = d.fecha?.toDate ? d.fecha.toDate() : new Date(d.fecha);
    if (!actual.ultima || fecha > actual.ultima) actual.ultima = fecha;
    mapa.set(clave, actual);
  }
  return [...mapa.values()].sort((a, b) => b.conteo - a.conteo).slice(0, 10);
}

export default function AdminBusquedasPage() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [total, setTotal] = useState(0);
  const [conteos, setConteos] = useState({});
  const [conContacto, setConContacto] = useState(0);
  const [tablaFueraCatalogo, setTablaFueraCatalogo] = useState([]);
  const [tablaSinInventario, setTablaSinInventario] = useState([]);
  const [tablaFueraDeGiro, setTablaFueraDeGiro] = useState([]);
  const [tablaNoInterpretadas, setTablaNoInterpretadas] = useState([]);

  useEffect(() => {
    async function cargar() {
      try {
        const ref = collection(db, 'busquedas');

        const [totalSnap, contactoSnap, ...estadoSnaps] = await Promise.all([
          getCountFromServer(ref),
          getCountFromServer(query(ref, where('tieneContacto', '==', true))),
          ...ESTADOS.map((e) => getCountFromServer(query(ref, where('estado', '==', e.key)))),
        ]);
        setTotal(totalSnap.data().count);
        setConContacto(contactoSnap.data().count);
        const nuevoConteos = {};
        ESTADOS.forEach((e, i) => { nuevoConteos[e.key] = estadoSnaps[i].data().count; });
        setConteos(nuevoConteos);

        const [fueraCatalogoSnap, sinInventarioSnap, fueraDeGiroSnap, noInterpretadasSnap] = await Promise.all([
          getDocs(query(ref, where('estado', '==', 'fuera_de_catalogo'), orderBy('fecha', 'desc'), limit(300))),
          getDocs(query(ref, where('estado', '==', 'sin_inventario'), orderBy('fecha', 'desc'), limit(300))),
          getDocs(query(ref, where('estado', '==', 'fuera_de_giro'), orderBy('fecha', 'desc'), limit(30))),
          getDocs(query(ref, where('estado', 'in', ['no_interpretada', 'parseo_parcial']), orderBy('fecha', 'desc'), limit(30))),
        ]);

        setTablaFueraCatalogo(agruparPorClave(
          fueraCatalogoSnap.docs.map((d) => d.data()),
          (d) => `${d.marca || '?'} ${d.modelo || ''}`.trim(),
        ));
        setTablaSinInventario(agruparPorClave(
          sinInventarioSnap.docs.map((d) => d.data()),
          (d) => `${d.pieza || '?'} — ${d.marca || '?'} ${d.modelo || ''}`.trim(),
        ));
        setTablaFueraDeGiro(fueraDeGiroSnap.docs.map((d) => d.data()));
        setTablaNoInterpretadas(noInterpretadasSnap.docs.map((d) => d.data()));
      } catch (e) {
        console.error('[admin/busquedas] Error cargando datos', e);
      }
      setCargando(false);
    }
    cargar();
  }, []);

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F0F2F5', fontFamily: "'Inter', sans-serif", paddingBottom: '40px' }}>
      <div style={{ backgroundColor: '#1A3C5E', padding: '20px 16px', paddingTop: '24px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: '#E8720C', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold', padding: 0 }}>
            ← Volver
          </button>
          <h1 style={{ color: '#fff', fontSize: '18px', margin: '4px 0 0', fontWeight: '700' }}>Búsquedas del Buscador Inteligente</h1>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '16px' }}>
        {cargando ? (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '32px' }}>Cargando...</p>
        ) : (
          <>
            {/* Métricas */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '24px' }}>
              <MetricaCard label="Total de búsquedas" valor={total} />
              {ESTADOS.map((e) => (
                <MetricaCard
                  key={e.key}
                  label={e.label}
                  valor={conteos[e.key] || 0}
                  pct={total > 0 ? Math.round(((conteos[e.key] || 0) / total) * 100) : 0}
                  color={e.color}
                />
              ))}
              <MetricaCard
                label="Con contacto dejado"
                valor={conContacto}
                pct={total > 0 ? Math.round((conContacto / total) * 100) : 0}
              />
            </div>

            <Tabla
              titulo="Modelos fuera de catálogo más buscados"
              subtitulo="Candidatos a agregar al catálogo vivo"
              columnas={['Marca / modelo', 'Veces buscado', 'Última vez']}
              filas={tablaFueraCatalogo.map((r) => [r.clave, r.conteo, formatearFecha(r.ultima)])}
            />

            <Tabla
              titulo="Piezas sin inventario más buscadas"
              subtitulo="Candidatos a inventariar"
              columnas={['Pieza / vehículo', 'Veces buscado', 'Última vez']}
              filas={tablaSinInventario.map((r) => [r.clave, r.conteo, formatearFecha(r.ultima)])}
            />

            <Tabla
              titulo="Búsquedas fuera de giro recientes"
              subtitulo="Para revisar falsos positivos del heurístico"
              columnas={['Texto', 'Categoría', 'Fecha']}
              filas={tablaFueraDeGiro.map((d) => [d.texto, d.categoriaFueraDeGiro || '—', formatearFecha(d.fecha)])}
            />

            <Tabla
              titulo="Búsquedas no interpretadas / parciales recientes"
              subtitulo="Para mejorar la extracción de intención"
              columnas={['Texto', 'Estado', 'Fecha']}
              filas={tablaNoInterpretadas.map((d) => [d.texto, d.estado, formatearFecha(d.fecha)])}
            />
          </>
        )}
      </div>
    </main>
  );
}

function MetricaCard({ label, valor, pct, color }) {
  return (
    <div style={{
      backgroundColor: '#fff', borderRadius: '12px', padding: '12px 16px',
      minWidth: '140px', flex: '1 1 140px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <p style={{ color: '#888', fontSize: '12px', margin: '0 0 4px' }}>{label}</p>
      <p style={{ color: color || '#1A3C5E', fontSize: '22px', fontWeight: '700', margin: 0 }}>
        {valor}{typeof pct === 'number' ? <span style={{ fontSize: '13px', fontWeight: '600', marginLeft: '6px' }}>({pct}%)</span> : null}
      </p>
    </div>
  );
}

function Tabla({ titulo, subtitulo, columnas, filas }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <h2 style={{ color: '#1A3C5E', fontSize: '15px', margin: '0 0 2px' }}>{titulo}</h2>
      <p style={{ color: '#888', fontSize: '12px', margin: '0 0 10px' }}>{subtitulo}</p>
      <div style={{ overflow: 'hidden', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
          <thead>
            <tr style={{ backgroundColor: '#1A3C5E' }}>
              {columnas.map((c) => (
                <th key={c} style={{ color: '#fff', textAlign: 'left', padding: '10px 12px', fontSize: '12px', fontWeight: '600' }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td colSpan={columnas.length} style={{ padding: '14px 12px', color: '#aaa', fontSize: '13px', textAlign: 'center' }}>
                  Sin datos todavía
                </td>
              </tr>
            ) : filas.map((fila, i) => (
              <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#F0F2F5' }}>
                {fila.map((valor, j) => (
                  <td key={j} style={{ padding: '10px 12px', fontSize: '13px', color: '#333' }}>{valor}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
