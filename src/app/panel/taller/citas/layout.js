'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../AuthContext';
import { talleresHabilitados } from '../../../../lib/talleresHabilitados';
import { URL_QUIERO_PREMIUM_TALLER, premiumCitasOk } from '../../../../lib/planes';
import { TEXTO_SIN_PREMIUM_CITA } from '../../../../lib/citasTaller';
import { leerConfigCotizaciones, leerTaller } from '../cotizaciones/datos';
import { leerConfigCitas } from './config';
import { CitasContext } from './contexto';
import AvisoVersion from '../AvisoVersion';
import { AvisoPremium } from '../../CandadoPremium';

// Marco de las citas (mismo patrón que contactos). Falla cerrada: con la función de talleres
// apagada, o sin config/citas.habilitado == true, no se abre y regresa al inicio del taller.
// Con términos viejos, taller desactivado o sin Premium (si config/citas.requierePremium):
// solo ver, escribir por WhatsApp y borrar.
export default function CitasLayout({ children }) {
  const router = useRouter();
  const { tallerId } = useAuth();
  const activo = talleresHabilitados();
  const [recarga, setRecarga] = useState(0);
  const [estado, setEstado] = useState({ cargando: true, taller: null, config: null, configCitas: null, error: '' });
  const apagada = !activo || (!estado.cargando && !estado.error && estado.configCitas?.habilitado !== true);

  useEffect(() => {
    if (apagada) router.replace('/panel/taller');
  }, [apagada, router]);

  useEffect(() => {
    if (!tallerId || !activo) return undefined;
    let cancelado = false;
    Promise.all([leerTaller(tallerId), leerConfigCotizaciones(), leerConfigCitas()])
      .then(([taller, config, configCitas]) => {
        if (!cancelado) setEstado({ cargando: false, taller, config, configCitas, error: '' });
      })
      .catch((err) => {
        console.error(err);
        if (!cancelado) setEstado({ cargando: false, taller: null, config: null, configCitas: null, error: 'No pudimos cargar tu taller. Intenta de nuevo.' });
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

  const { taller, config, configCitas } = estado;
  const versionVigente = Boolean(config && taller && taller.aceptacionVersion === config.terminosVersion);
  const tallerActivo = taller?.activo === true;
  const premiumOk = premiumCitasOk(configCitas, taller);
  const puedeEscribir = versionVigente && tallerActivo && premiumOk;
  const valor = { tallerId, taller, versionVigente, puedeEscribir };

  return (
    <CitasContext.Provider value={valor}>
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '16px 16px 0' }}>
        {config && !versionVigente && (
          <AvisoVersion
            tallerId={tallerId}
            versionVigente={{ version: config.terminosVersion }}
            resumen={config.resumenCambios}
            onAceptada={() => setRecarga((n) => n + 1)}
            tallerActivo={tallerActivo}
          />
        )}
        {config && versionVigente && taller && !tallerActivo && (
          <p role="alert" style={{ color: '#8A2A1A', fontSize: '14px' }}>Tu taller está desactivado: solo puedes ver, escribir y borrar tus citas.</p>
        )}
        {versionVigente && tallerActivo && !premiumOk && (
          <AvisoPremium descripcion={TEXTO_SIN_PREMIUM_CITA} ubicacion="citas_taller" url={URL_QUIERO_PREMIUM_TALLER} />
        )}
      </div>
      {children}
    </CitasContext.Provider>
  );
}
