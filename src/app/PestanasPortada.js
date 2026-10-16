'use client';

// Pestañas de la portada: "Busco una pieza", "¿Tienes un yonke?" y "¿Tienes un taller?". Con
// config/portada.botonPanel encendido y una sesión iniciada (yonke, taller o admin), las dos de
// negocio se cambian por "Ir a mi panel" (/panel ya manda a cada quien a su panel según su cuenta).
// Sin parpadeo: mientras Firebase recupera la sesión (unas décimas de segundo), esos botones
// ocupan su lugar pero no se ven. Con la bandera apagada no se consulta la sesión: igual que hoy.
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase';

export const TEXTO_IR_A_MI_PANEL = '🔑 Ir a mi panel';

// 'visitante' | 'sesion' | 'cargando'. Apagado: siempre 'visitante', sin escuchar la sesión.
// (La bandera llega del servidor y no cambia durante la visita.)
export function useSesionPortada(activo) {
  const [estado, setEstado] = useState('cargando');
  useEffect(() => {
    if (!activo) return undefined;
    return onAuthStateChanged(auth, (usuario) => setEstado(usuario ? 'sesion' : 'visitante'));
  }, [activo]);
  return activo ? estado : 'visitante';
}

export function estiloPestana(activa) {
  return {
    flex: 1, padding: '14px 12px', borderRadius: '14px', border: '2px solid',
    borderColor: activa ? '#1A3C5E' : '#ddd',
    backgroundColor: activa ? '#1A3C5E' : '#fff',
    color: activa ? '#fff' : '#888',
    fontWeight: '700', fontSize: '15px', cursor: 'pointer', textAlign: 'center',
    transition: 'all 0.2s', fontFamily: "'Inter', sans-serif",
  };
}

export default function PestanasPortada({ pestanaActiva, setPestanaActiva, conTalleres, botonPanel }) {
  const sesion = useSesionPortada(botonPanel === true);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
      <button onClick={() => setPestanaActiva('cliente')} style={estiloPestana(pestanaActiva === 'cliente')}>
        🔍 Busco una pieza
      </button>
      {sesion === 'sesion' ? (
        <a href="/panel" style={{ ...estiloPestana(false), textDecoration: 'none', color: '#1A3C5E', borderColor: '#1A3C5E' }}>
          {TEXTO_IR_A_MI_PANEL}
        </a>
      ) : (
        <>
          <button
            onClick={() => setPestanaActiva('yonke')} style={{ ...estiloPestana(pestanaActiva === 'yonke'), ...(sesion === 'cargando' ? oculto : {}) }}
            aria-hidden={sesion === 'cargando' ? true : undefined} tabIndex={sesion === 'cargando' ? -1 : undefined}
          >
            🏪 ¿Tienes un yonke?
          </button>
          {conTalleres && (
            <button
              onClick={() => setPestanaActiva('taller')} style={{ ...estiloPestana(pestanaActiva === 'taller'), ...(sesion === 'cargando' ? oculto : {}) }}
              aria-hidden={sesion === 'cargando' ? true : undefined} tabIndex={sesion === 'cargando' ? -1 : undefined}
            >
              🔧 ¿Tienes un taller?
            </button>
          )}
        </>
      )}
    </div>
  );
}

// Ocupa su lugar sin verse ni poder tocarse.
const oculto = { visibility: 'hidden', pointerEvents: 'none' };
