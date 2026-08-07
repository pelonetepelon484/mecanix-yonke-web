'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const DIAS_ATRASO = 30;

const CIUDADES_BC = [
  { key: 'tijuana', label: 'Tijuana' },
  { key: 'mexicali', label: 'Mexicali' },
  { key: 'ensenada', label: 'Ensenada' },
  { key: 'tecate', label: 'Tecate' },
  { key: 'rosarito', label: 'Playas de Rosarito' },
  { key: 'sanquintin', label: 'San Quintín' },
];

function diasDesde(fecha) {
  if (!fecha) return null;
  const f = fecha?.toDate ? fecha.toDate() : new Date(fecha);
  return Math.floor((Date.now() - f.getTime()) / (1000 * 60 * 60 * 24));
}

function formatearFecha(fecha) {
  if (!fecha) return 'Nunca visitado';
  const f = fecha?.toDate ? fecha.toDate() : new Date(fecha);
  return f.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CapturaDomicilioPage() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [yonkes, setYonkes] = useState([]);
  const [marcandoId, setMarcandoId] = useState(null);

  async function cargar() {
    setCargando(true);
    try {
      const q = query(collection(db, 'yonkes'), where('capturaADomicilio', '==', true));
      const snap = await getDocs(q);
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Sin visita nunca (ultimaVisitaCaptura ausente) se trata como infinitamente atrasado,
      // así siempre queda arriba del todo — es al que le urge más una primera visita.
      lista.sort((a, b) => {
        const diasA = diasDesde(a.ultimaVisitaCaptura) ?? Infinity;
        const diasB = diasDesde(b.ultimaVisitaCaptura) ?? Infinity;
        return diasB - diasA;
      });
      setYonkes(lista);
    } catch (e) {
      console.error('[admin/captura-domicilio] Error cargando yonkes', e);
    }
    setCargando(false);
  }

  useEffect(() => { cargar(); }, []);

  async function marcarVisitaHoy(id) {
    setMarcandoId(id);
    try {
      await updateDoc(doc(db, 'yonkes', id), { ultimaVisitaCaptura: Timestamp.now() });
      setYonkes((prev) => {
        const actualizada = prev.map((y) => (y.id === id ? { ...y, ultimaVisitaCaptura: Timestamp.now() } : y));
        actualizada.sort((a, b) => {
          const diasA = diasDesde(a.ultimaVisitaCaptura) ?? Infinity;
          const diasB = diasDesde(b.ultimaVisitaCaptura) ?? Infinity;
          return diasB - diasA;
        });
        return actualizada;
      });
    } catch (e) {
      console.error('[admin/captura-domicilio] No se pudo marcar la visita', e);
      alert('No se pudo marcar la visita, intenta de nuevo.');
    }
    setMarcandoId(null);
  }

  const atrasados = yonkes.filter((y) => (diasDesde(y.ultimaVisitaCaptura) ?? Infinity) > DIAS_ATRASO).length;

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F0F2F5', fontFamily: "'Inter', sans-serif", paddingBottom: '40px' }}>
      <div style={{ backgroundColor: '#1A3C5E', padding: '20px 16px', paddingTop: '24px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: '#E8720C', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold', padding: 0 }}>
            ← Volver
          </button>
          <h1 style={{ color: '#fff', fontSize: '18px', margin: '4px 0 0', fontWeight: '700' }}>Captura a domicilio</h1>
        </div>
      </div>

      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '16px' }}>
        {cargando ? (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '32px' }}>Cargando...</p>
        ) : (
          <>
            <p style={{ color: '#666', fontSize: '13px', margin: '0 0 16px' }}>
              {yonkes.length} yonke(s) con el complemento activo — {atrasados} con más de {DIAS_ATRASO} días sin visita.
            </p>

            {yonkes.length === 0 ? (
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', textAlign: 'center', color: '#aaa', fontSize: '13px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                Ningún yonke tiene el complemento activo todavía. Actívalo desde la ficha del yonke.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {yonkes.map((y) => {
                  const dias = diasDesde(y.ultimaVisitaCaptura);
                  const atrasado = (dias ?? Infinity) > DIAS_ATRASO;
                  return (
                    <div key={y.id} style={{
                      backgroundColor: '#fff', borderRadius: '12px', padding: '14px 16px',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                      borderLeft: atrasado ? '4px solid #C62828' : '4px solid #2E7D32',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <p style={{ fontWeight: '700', color: '#1A3C5E', fontSize: '15px', margin: 0 }}>{y.nombre}</p>
                          <p style={{ color: '#888', fontSize: '12px', margin: '3px 0 0' }}>
                            📌 {CIUDADES_BC.find((c) => c.key === y.ciudad)?.label || y.ciudad || 'Sin ciudad'}
                          </p>
                          <p style={{ color: '#666', fontSize: '13px', margin: '6px 0 0' }}>
                            Última visita: {formatearFecha(y.ultimaVisitaCaptura)}
                            {dias != null && ` · hace ${dias} día${dias === 1 ? '' : 's'}`}
                          </p>
                        </div>
                        {atrasado && (
                          <span style={{ backgroundColor: '#FDECEA', color: '#C62828', fontSize: '11px', fontWeight: '700', padding: '3px 9px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
                            ⚠️ Le toca visita
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => marcarVisitaHoy(y.id)}
                        disabled={marcandoId === y.id}
                        style={{
                          marginTop: '10px', backgroundColor: '#1A3C5E', color: '#fff', fontSize: '13px',
                          fontWeight: '700', padding: '8px 14px', borderRadius: '8px', border: 'none',
                          cursor: marcandoId === y.id ? 'default' : 'pointer',
                        }}
                      >
                        {marcandoId === y.id ? 'Guardando...' : '✅ Marcar visita de hoy'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
