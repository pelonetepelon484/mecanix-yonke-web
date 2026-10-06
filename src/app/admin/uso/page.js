'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getCountFromServer, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';

// Uso de talleres y cotizaciones, taller por taller. Solo lectura y solo para admin (admin/layout.js).
// Costo aproximado: 1 lectura por cada taller, y 2 conteos por taller (cada conteo cuesta una
// lectura por cada 1000 cotizaciones contadas, con mínimo 1). Con 50 talleres son ~150 lecturas.
// No usa reglas de grupo de colecciones ni comodines: cada conteo es una ruta fija talleres/{id}/cotizaciones.
async function cargarUso() {
  const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const talleresSnap = await getDocs(collection(db, 'talleres'));
  const lista = await Promise.all(talleresSnap.docs.map(async (t) => {
    const ref = collection(db, 'talleres', t.id, 'cotizaciones');
    const [total, ultimos30] = await Promise.all([
      getCountFromServer(query(ref)),
      getCountFromServer(query(ref, where('creadoAt', '>=', hace30))),
    ]);
    return {
      id: t.id,
      nombre: t.data().nombre || '(sin nombre)',
      activo: t.data().activo === true,
      totalCotizaciones: total.data().count,
      cotizaciones30Dias: ultimos30.data().count,
    };
  }));
  lista.sort((a, b) => b.totalCotizaciones - a.totalCotizaciones);
  return lista;
}

export default function AdminUso() {
  const router = useRouter();
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelado = false;
    cargarUso()
      .then((lista) => {
        if (!cancelado) setFilas(lista);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelado) setError('No pudimos cargar el uso. Intenta recargar la página.');
      });
    return () => { cancelado = true; };
  }, []);

  const totales = filas ? filas.reduce((acc, f) => ({
    talleres: acc.talleres + 1,
    activos: acc.activos + (f.activo ? 1 : 0),
    cotizaciones: acc.cotizaciones + f.totalCotizaciones,
    ultimos30: acc.ultimos30 + f.cotizaciones30Dias,
  }), { talleres: 0, activos: 0, cotizaciones: 0, ultimos30: 0 }) : null;

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '24px' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: '#1A3C5E', cursor: 'pointer', fontSize: '14px', marginBottom: '12px' }}>
          ← Volver al panel
        </button>
        <h1 style={{ fontSize: '22px', color: '#1A3C5E', margin: '0 0 16px' }}>Uso de talleres</h1>

        {error && <p role="alert" style={{ color: '#D85A30' }}>{error}</p>}
        {!filas && !error && <p style={{ color: '#555' }}>Cargando...</p>}

        {totales && (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {[
              ['Talleres', totales.talleres],
              ['Activos', totales.activos],
              ['Cotizaciones (total)', totales.cotizaciones],
              ['Últimos 30 días', totales.ultimos30],
            ].map(([etiqueta, valor]) => (
              <div key={etiqueta} style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '14px 18px', minWidth: '150px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>{etiqueta}</p>
                <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#1A3C5E', margin: '4px 0 0' }}>{valor}</p>
              </div>
            ))}
          </div>
        )}

        {filas && (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', overflowX: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #EEE' }}>
                  <th style={th}>Taller</th>
                  <th style={th}>Estado</th>
                  <th style={th}>Cotizaciones</th>
                  <th style={th}>Últimos 30 días</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id} style={{ borderBottom: '1px solid #F2F2F2' }}>
                    <td style={td}>{f.nombre}</td>
                    <td style={td}>{f.activo ? 'Activo' : 'Desactivado'}</td>
                    <td style={td}>{f.totalCotizaciones}</td>
                    <td style={td}>{f.cotizaciones30Dias}</td>
                  </tr>
                ))}
                {filas.length === 0 && (
                  <tr><td style={td} colSpan={4}>Todavía no hay talleres registrados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

const th = { padding: '10px 12px', fontSize: '12px', color: '#888', fontWeight: 'bold' };
const td = { padding: '10px 12px', color: '#333' };
