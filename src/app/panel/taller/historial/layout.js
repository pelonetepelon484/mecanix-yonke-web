'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../AuthContext';
import { talleresHabilitados } from '../../../../lib/talleresHabilitados';
import { esPremiumVigente, URL_QUIERO_PREMIUM_TALLER } from '../../../../lib/planes';
import { ADVERTENCIA_HISTORIAL } from '../../../../lib/historialTaller';
import { leerConfigCotizaciones, leerTaller } from '../cotizaciones/datos';
import { leerConfigHistorial } from './datos';
import { AvisoPremium } from '../../CandadoPremium';
import { HistorialContext } from './contexto';
import AvisoVersion from '../AvisoVersion';

// Marco del "Historial de servicios" (mismo patrón que órdenes). Falla cerrada: con la función de
// talleres apagada, o sin config/historialTaller.habilitado == true, no se abre y regresa al
// inicio del taller. Con términos viejos, taller desactivado o sin Premium: solo ver y borrar.
export default function HistorialLayout({ children }) {
  const router = useRouter();
  const { tallerId } = useAuth();
  const activo = talleresHabilitados();
  const [recarga, setRecarga] = useState(0);
  const [estado, setEstado] = useState({ cargando: true, taller: null, config: null, configHistorial: null, error: '' });
  const apagada = !activo || (!estado.cargando && !estado.error && estado.configHistorial?.habilitado !== true);

  useEffect(() => {
    if (apagada) router.replace('/panel/taller');
  }, [apagada, router]);

  useEffect(() => {
    if (!tallerId || !activo) return undefined;
    let cancelado = false;
    Promise.all([leerTaller(tallerId), leerConfigCotizaciones(), leerConfigHistorial()])
      .then(([taller, config, configHistorial]) => {
        if (!cancelado) setEstado({ cargando: false, taller, config, configHistorial, error: '' });
      })
      .catch((err) => {
        console.error(err);
        if (!cancelado) setEstado({ cargando: false, taller: null, config: null, configHistorial: null, error: 'No pudimos cargar tu taller. Intenta de nuevo.' });
      });
    return () => { cancelado = true; };
  }, [tallerId, activo, recarga]);

  if (apagada) return null;
  if (estado.cargando) {
    return <main style={{ minHeight: '100vh', padding: '24px' }}><p style={{ color: '#555' }}>Cargando...</p></main>;
  }
  if (estado.error) {
    return <main style={{ minHeight: '100vh', padding: '24px' }}><p role="alert" style={{ color: '#B3261E' }}>{estado.error}</p></main>;
  }

  const { taller, config } = estado;
  const versionVigente = Boolean(config && taller && taller.aceptacionVersion === config.terminosVersion);
  const premium = esPremiumVigente(taller);
  const puedeEscribir = versionVigente && taller?.activo === true && premium;
  const valor = { tallerId, taller, versionVigente, premium, puedeEscribir };

  return (
    <HistorialContext.Provider value={valor}>
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '16px 16px 0' }}>
        {config && !versionVigente && (
          <AvisoVersion
            tallerId={tallerId}
            versionVigente={{ version: config.terminosVersion }}
            resumen={config.resumenCambios}
            onAceptada={() => setRecarga((n) => n + 1)}
            tallerActivo={taller?.activo === true}
          />
        )}
        {config && versionVigente && taller && taller.activo !== true && (
          <p role="alert" style={{ color: '#8A2A1A', fontSize: '14px' }}>Tu taller está desactivado: solo puedes ver y borrar tu historial.</p>
        )}
        {!premium && (
          <AvisoPremium
            descripcion="Agregar servicios al historial es del plan Premium. Puedes ver y borrar lo que ya tienes."
            ubicacion="historial_taller" url={URL_QUIERO_PREMIUM_TALLER}
          />
        )}
        <p role="note" style={{ fontSize: '13px', color: '#8A2A1A', backgroundColor: '#FFF6E8', borderRadius: '10px', padding: '10px', margin: '8px 0 0' }}>
          ⚠️ {ADVERTENCIA_HISTORIAL}
        </p>
      </div>
      {children}
    </HistorialContext.Provider>
  );
}
