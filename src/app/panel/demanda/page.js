'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useAuth } from '../AuthContext';
import BottomNav from '../BottomNav';

const PERIODOS = [
  { key: '7', label: '7 días' },
  { key: '30', label: '30 días' },
];

// Pestaña "Demanda": versión reducida del Mapa de búsquedas de admin, solo para el estado del
// propio yonke (ver /api/demanda-yonke, commit 4). A propósito NUNCA calcula ni muestra ningún
// número — ni conteos, ni porcentajes, ni un badge de posición (1º, 2º...): el ORDEN de la lista
// ya comunica qué se busca más, tal como lo entrega el endpoint.
export default function DemandaPanel() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [periodo, setPeriodo] = useState('7');
  const [intento, setIntento] = useState(0);
  // 'cargando' | 'ok' | 'vacio' | 'no-autorizado' | 'error'
  const [estadoCarga, setEstadoCarga] = useState('cargando');
  const [filas, setFilas] = useState([]);
  // Cuenta la petición vigente -- si el periodo cambia antes de que responda una anterior, esa
  // respuesta tardía se descarta en vez de pisar el estado de la petición nueva (condición de
  // carrera al cambiar de periodo rápido).
  const peticionVigente = useRef(0);

  useEffect(() => {
    if (!loading && !user) {
      const timer = setTimeout(() => router.push('/panel'), 1500);
      return () => clearTimeout(timer);
    }
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;
    const idPeticion = ++peticionVigente.current;
    setEstadoCarga('cargando');

    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/demanda-yonke?periodo=${periodo}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (idPeticion !== peticionVigente.current) return; // llegó tarde, ya no aplica

        if (res.status === 401 || res.status === 403) {
          setEstadoCarga('no-autorizado');
          return;
        }
        if (!res.ok) {
          setEstadoCarga('error');
          return;
        }

        const data = await res.json();
        if (idPeticion !== peticionVigente.current) return;

        const filasRecibidas = Array.isArray(data?.filas) ? data.filas : [];
        setFilas(filasRecibidas);
        setEstadoCarga(filasRecibidas.length > 0 ? 'ok' : 'vacio');
      } catch (error) {
        if (idPeticion !== peticionVigente.current) return;
        console.error('[panel/demanda] Error consultando /api/demanda-yonke', error);
        setEstadoCarga('error');
      }
    })();
  }, [user, periodo, intento]);

  async function handleLogout() {
    await signOut(auth);
    router.push('/panel');
  }

  if (loading || !user) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A3C5E' }}>
        <p style={{ color: '#fff' }}>Cargando...</p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', paddingBottom: '70px' }}>
      <div style={{ backgroundColor: '#1A3C5E', padding: '20px 16px', paddingTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '600px', margin: '0 auto' }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: '20px', margin: 0, fontWeight: 'bold' }}>Demanda</h1>
            <p style={{ color: '#ccc', fontSize: '13px', margin: '2px 0 0' }}>Qué buscan los clientes en tu estado</p>
          </div>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#E8720C', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
        {/* Selector de período — mismo patrón visual que panel/ventas y panel/reciclaje. */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {PERIODOS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriodo(p.key)}
              style={{
                flex: 1, padding: '10px', borderRadius: '8px', border: '2px solid',
                borderColor: periodo === p.key ? '#1A3C5E' : '#ddd',
                backgroundColor: periodo === p.key ? '#1A3C5E' : '#fff',
                color: periodo === p.key ? '#fff' : '#888',
                fontWeight: 'bold', fontSize: '13px', cursor: 'pointer',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div style={sectionStyle}>
          {estadoCarga === 'cargando' && (
            <p style={{ textAlign: 'center', color: '#888', margin: 0, padding: '16px 0' }}>Cargando...</p>
          )}

          {estadoCarga === 'vacio' && (
            <p style={{ textAlign: 'center', color: '#888', fontSize: '14px', lineHeight: '1.5', margin: 0, padding: '16px 0' }}>
              Aún no hay suficiente demanda en tu estado para mostrar resultados. Vuelve a revisar pronto.
            </p>
          )}

          {estadoCarga === 'no-autorizado' && (
            <p style={{ textAlign: 'center', color: '#C62828', fontSize: '14px', lineHeight: '1.5', margin: 0, padding: '16px 0' }}>
              No pudimos verificar tu cuenta o tu yonke. Cierra sesión y vuelve a entrar; si el problema sigue, contáctanos.
            </p>
          )}

          {estadoCarga === 'error' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <p style={{ color: '#888', fontSize: '14px', lineHeight: '1.5', margin: '0 0 12px' }}>
                Hubo un problema al cargar la demanda de tu estado.
              </p>
              <button onClick={() => setIntento((i) => i + 1)} style={reintentarBotonStyle}>
                Reintentar
              </button>
            </div>
          )}

          {estadoCarga === 'ok' && (
            <>
              <p style={{ fontSize: '12px', color: '#aaa', margin: '0 0 10px' }}>
                De más a menos buscado en tu estado
              </p>
              {filas.map((fila, i) => (
                <div
                  key={`${fila.clave}-${i}`}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px',
                    padding: '12px 0', borderBottom: i < filas.length - 1 ? '1px solid #F4F5F5' : 'none',
                  }}
                >
                  <p style={{ fontSize: '14px', color: '#333', margin: 0, flex: 1 }}>{fila.clave}</p>
                  <span style={estadoBadgeStyle(fila.estado)}>{fila.estado}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <BottomNav />
    </main>
  );
}

function estadoBadgeStyle(estado) {
  const esConResultado = estado === 'Con resultado';
  return {
    fontSize: '11px', fontWeight: 'bold', padding: '4px 10px', borderRadius: '12px', flexShrink: 0,
    backgroundColor: esConResultado ? '#E8F5E9' : '#FFF3E0',
    color: esConResultado ? '#2E7D32' : '#B26A00',
  };
}

const sectionStyle = {
  backgroundColor: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
};
const reintentarBotonStyle = {
  padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#E8720C',
  color: '#fff', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer',
};
