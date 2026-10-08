'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { useAuth } from '../AuthContext';
import { talleresHabilitados } from '../../../lib/talleresHabilitados';
import { leerConfigCotizaciones } from './cotizaciones/datos';
import { leerConfigSolicitudesPiezas } from '../solicitudesPiezasDatos';
import AvisoVersion from './AvisoVersion';

export default function PanelTaller() {
  const router = useRouter();
  const { tallerId } = useAuth();
  const [nombre, setNombre] = useState('');
  const [errorCarga, setErrorCarga] = useState('');
  const [versionAceptada, setVersionAceptada] = useState(null);
  const [versionVigente, setVersionVigente] = useState(null);
  const [resumen, setResumen] = useState('');
  const [recarga, setRecarga] = useState(0);
  const [activoTaller, setActivoTaller] = useState(false);
  const [pedirPiezaHabilitado, setPedirPiezaHabilitado] = useState(false);

  useEffect(() => {
    if (!tallerId) return;
    let cancelado = false;
    Promise.all([getDoc(doc(db, 'talleres', tallerId)), leerConfigCotizaciones(), leerConfigSolicitudesPiezas()])
      .then(([snap, config, configPiezas]) => {
        if (cancelado) return;
        if (snap.exists()) {
          setNombre(snap.data().nombre || '');
          setVersionAceptada(snap.data().aceptacionVersion ?? '');
          setActivoTaller(snap.data().activo === true);
        } else {
          setErrorCarga('No encontramos los datos de tu taller.');
        }
        setVersionVigente(config?.terminosVersion ?? null);
        setResumen(config?.resumenCambios ?? '');
        setPedirPiezaHabilitado(configPiezas?.habilitado === true);
      })
      .catch(() => { if (!cancelado) setErrorCarga('No pudimos cargar los datos de tu taller. Intenta recargar la página.'); });
    return () => { cancelado = true; };
  }, [tallerId, recarga]);

  // Con la bandera apagada no hay aviso de términos, aunque exista config/cotizaciones.
  const hayCambios = talleresHabilitados() && versionVigente !== null && versionAceptada !== null && versionAceptada !== versionVigente;

  async function cerrarSesion() {
    await signOut(auth);
    router.push('/panel');
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ maxWidth: '420px', width: '100%', backgroundColor: '#fff', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', textAlign: 'center' }}>
        <p style={{ fontSize: '13px', color: '#E8720C', letterSpacing: '2px', fontWeight: 'bold', marginBottom: '8px' }}>PANEL DEL TALLER</p>
        <h1 style={{ fontSize: '22px', color: '#1A3C5E', margin: '0 0 16px' }}>{nombre || 'Tu taller'}</h1>
        {errorCarga && <p role="alert" style={{ color: '#D85A30', fontSize: '13px' }}>{errorCarga}</p>}
        {hayCambios && (
          <div style={{ textAlign: 'left' }}>
            <AvisoVersion
              tallerId={tallerId}
              versionVigente={{ version: versionVigente }}
              resumen={resumen}
              tallerActivo={activoTaller}
              onAceptada={() => setRecarga((n) => n + 1)}
            />
          </div>
        )}
        {talleresHabilitados() && (
          <>
            <button onClick={() => router.push('/panel/taller/cotizaciones')} style={{ width: '100%', minHeight: '56px', borderRadius: '14px', border: 'none', backgroundColor: '#E8720C', color: '#fff', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', margin: pedirPiezaHabilitado ? '16px 0 10px' : '16px 0 24px' }}>
              Cotizaciones
            </button>
            {pedirPiezaHabilitado && (
              <button onClick={() => router.push('/panel/taller/pedir-pieza')} style={{ width: '100%', minHeight: '56px', borderRadius: '14px', border: '2px solid #1A3C5E', backgroundColor: '#fff', color: '#1A3C5E', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', margin: '0 0 24px' }}>
                Pedir una pieza
              </button>
            )}
          </>
        )}
        <button onClick={cerrarSesion} style={{ background: 'none', border: '1px solid #DDD', borderRadius: '10px', padding: '10px 18px', fontSize: '14px', color: '#555', cursor: 'pointer' }}>
          Cerrar sesión
        </button>
      </div>
    </main>
  );
}
