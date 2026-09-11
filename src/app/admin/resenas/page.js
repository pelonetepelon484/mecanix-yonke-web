'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

// "Reseñas de la plataforma" (resenasPlataforma): opinión sobre MECANIX como buscador — NO
// confundir con "calificaciones" (reseñas de yonkes, ligadas a una venta, sin moderación, ya
// existentes y sin tocar). Aquí SÍ hay moderación: nada se publica en /
// hasta que el admin aprueba (aprobada=true), y el admin puede responder cada una.

function formatearFecha(fecha) {
  const f = fecha?.toDate ? fecha.toDate() : new Date(fecha);
  return f.toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminResenasPage() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [resenas, setResenas] = useState([]);
  // Texto de la respuesta EN EDICIÓN por reseña — separado de r.respuestaAdmin para no guardar
  // en Firestore en cada tecla; solo al hacer clic en "Guardar respuesta".
  const [borradores, setBorradores] = useState({});
  const [guardandoId, setGuardandoId] = useState(null);

  useEffect(() => {
    async function cargar() {
      try {
        const snap = await getDocs(collection(db, 'resenasPlataforma'));
        const lista = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0));
        setResenas(lista);
        const iniciales = {};
        lista.forEach((r) => { iniciales[r.id] = r.respuestaAdmin || ''; });
        setBorradores(iniciales);
      } catch (e) {
        console.error('[admin/resenas] Error cargando reseñas', e);
      }
      setCargando(false);
    }
    cargar();
  }, []);

  const total = resenas.length;
  const promedioEstrellas = total > 0
    ? (resenas.reduce((suma, r) => suma + (r.estrellas || 0), 0) / total).toFixed(1)
    : '—';
  const pctRecomienda = total > 0
    ? Math.round((resenas.filter((r) => r.recomendaria === true).length / total) * 100)
    : 0;
  const pctFacil = total > 0
    ? Math.round((resenas.filter((r) => r.facilidad === true).length / total) * 100)
    : 0;
  const totalAprobadas = resenas.filter((r) => r.aprobada).length;

  async function toggleAprobada(resena) {
    setGuardandoId(resena.id);
    try {
      await updateDoc(doc(db, 'resenasPlataforma', resena.id), { aprobada: !resena.aprobada });
      setResenas((prev) => prev.map((r) => (r.id === resena.id ? { ...r, aprobada: !r.aprobada } : r)));
    } catch (e) {
      console.error('[admin/resenas] No se pudo actualizar aprobada', e);
      alert('No se pudo actualizar, intenta de nuevo.');
    }
    setGuardandoId(null);
  }

  async function guardarRespuesta(resenaId) {
    setGuardandoId(resenaId);
    try {
      const texto = (borradores[resenaId] || '').trim();
      await updateDoc(doc(db, 'resenasPlataforma', resenaId), { respuestaAdmin: texto });
      setResenas((prev) => prev.map((r) => (r.id === resenaId ? { ...r, respuestaAdmin: texto } : r)));
    } catch (e) {
      console.error('[admin/resenas] No se pudo guardar la respuesta', e);
      alert('No se pudo guardar la respuesta, intenta de nuevo.');
    }
    setGuardandoId(null);
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F0F2F5', fontFamily: "'Inter', sans-serif", paddingBottom: '40px' }}>
      <div style={{ backgroundColor: '#1A3C5E', padding: '20px 16px', paddingTop: '24px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: '#E8720C', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold', padding: 0 }}>
            ← Volver
          </button>
          <h1 style={{ color: '#fff', fontSize: '18px', margin: '4px 0 0', fontWeight: '700' }}>Reseñas de Mecanix</h1>
          <p style={{ color: '#cdd9e4', fontSize: '13px', margin: '2px 0 0' }}>
            Termómetro de calidad del buscador — {total} reseñas, {totalAprobadas} publicadas
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '16px' }}>
        {cargando ? (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '32px' }}>Cargando...</p>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '24px' }}>
              <MetricaCard label="Promedio de estrellas" valor={`${promedioEstrellas} ⭐`} />
              <MetricaCard label="Recomendaría Mecanix" valor={`${pctRecomienda}%`} />
              <MetricaCard label="Le pareció fácil de usar" valor={`${pctFacil}%`} />
              <MetricaCard label="Publicadas" valor={`${totalAprobadas} / ${total}`} />
            </div>

            {resenas.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#aaa', marginTop: '32px' }}>Aún no hay reseñas de la plataforma</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {resenas.map((r) => (
                  <div key={r.id} style={{
                    backgroundColor: '#fff', borderRadius: '12px', padding: '16px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    borderLeft: r.aprobada ? '4px solid #2E7D32' : '4px solid #ccc',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <span style={{ color: '#E8720C', fontSize: '16px' }}>
                          {'★'.repeat(r.estrellas || 0)}{'☆'.repeat(5 - (r.estrellas || 0))}
                        </span>
                        <p style={{ color: '#888', fontSize: '12px', margin: '2px 0 0' }}>{formatearFecha(r.fecha)}</p>
                      </div>
                      <button
                        onClick={() => toggleAprobada(r)}
                        disabled={guardandoId === r.id}
                        style={{
                          backgroundColor: r.aprobada ? '#F4F5F5' : '#2E7D32',
                          color: r.aprobada ? '#888' : '#fff',
                          border: 'none', borderRadius: '8px', padding: '8px 14px',
                          fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                        }}
                      >
                        {r.aprobada ? 'Ocultar (desaprobar)' : '✓ Aprobar y publicar'}
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', margin: '10px 0', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', color: '#555' }}>
                        ¿Fácil de usar? {r.facilidad === true ? '✅ Sí' : r.facilidad === false ? '❌ No' : '—'}
                      </span>
                      <span style={{ fontSize: '12px', color: '#555' }}>
                        ¿Recomienda? {r.recomendaria === true ? '✅ Sí' : r.recomendaria === false ? '❌ No' : '—'}
                      </span>
                    </div>

                    {r.comentario && (
                      <p style={{ color: '#333', fontSize: '13px', lineHeight: '1.5', margin: '0 0 10px', fontStyle: 'italic' }}>
                        “{r.comentario}”
                      </p>
                    )}

                    <p style={{ fontSize: '12px', fontWeight: '700', color: '#1A3C5E', margin: '0 0 6px' }}>
                      Respuesta de Mecanix (opcional)
                    </p>
                    <textarea
                      value={borradores[r.id] ?? ''}
                      onChange={(e) => setBorradores((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      rows={2}
                      placeholder="Escribe una respuesta pública para esta reseña..."
                      style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '13px', marginBottom: '8px', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
                    />
                    <button
                      onClick={() => guardarRespuesta(r.id)}
                      disabled={guardandoId === r.id || (borradores[r.id] ?? '') === (r.respuestaAdmin || '')}
                      style={{
                        backgroundColor: '#1A3C5E', color: '#fff', border: 'none', borderRadius: '8px',
                        padding: '8px 14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                        opacity: (borradores[r.id] ?? '') === (r.respuestaAdmin || '') ? 0.5 : 1,
                      }}
                    >
                      {guardandoId === r.id ? 'Guardando...' : 'Guardar respuesta'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function MetricaCard({ label, valor }) {
  return (
    <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '12px 16px', minWidth: '140px', flex: '1 1 140px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <p style={{ color: '#888', fontSize: '12px', margin: '0 0 4px' }}>{label}</p>
      <p style={{ color: '#1A3C5E', fontSize: '20px', fontWeight: '700', margin: 0 }}>{valor}</p>
    </div>
  );
}
