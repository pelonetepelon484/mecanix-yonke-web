'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../AuthContext';
import { talleresHabilitados } from '../../../../lib/talleresHabilitados';
import { leerConfigCotizaciones, leerTaller } from './datos';
import { CotizacionesContext } from './contexto';
import AvisoVersion from '../AvisoVersion';

// Con la función de talleres apagada, las cotizaciones no se abren (ni por botón ni por dirección).
// Encendida: carga el taller y la configuración una vez y los reparte a las pantallas.
export default function CotizacionesLayout({ children }) {
  const router = useRouter();
  const { tallerId } = useAuth();
  const activo = talleresHabilitados();
  const [recarga, setRecarga] = useState(0);
  const [estado, setEstado] = useState({ cargando: true, taller: null, config: null, error: '' });

  useEffect(() => {
    if (!activo) router.replace('/panel/taller');
  }, [activo]);

  useEffect(() => {
    if (!tallerId || !activo) return;
    let cancelado = false;
    Promise.all([leerTaller(tallerId), leerConfigCotizaciones()])
      .then(([taller, config]) => {
        if (!cancelado) setEstado({ cargando: false, taller, config, error: '' });
      })
      .catch((err) => {
        console.error(err);
        if (!cancelado) setEstado({ cargando: false, taller: null, config: null, error: 'No pudimos cargar tu taller. Intenta de nuevo.' });
      });
    return () => { cancelado = true; };
  }, [tallerId, activo, recarga]);

  if (!activo) return null;
  if (estado.cargando) {
    return <main style={{ minHeight: '100vh', padding: '24px' }}><p style={{ color: '#555' }}>Cargando...</p></main>;
  }
  if (estado.error) {
    return <main style={{ minHeight: '100vh', padding: '24px' }}><p role="alert" style={{ color: '#B3261E' }}>{estado.error}</p></main>;
  }

  const { taller, config } = estado;
  const versionVigente = Boolean(config && taller && taller.aceptacionVersion === config.terminosVersion);
  const puedeEditar = versionVigente && taller?.activo === true;
  const valor = {
    tallerId,
    taller,
    config,
    versionVigente,
    puedeEditar,
    datosClienteHabilitados: config?.datosClienteHabilitados === true,
    avisoVersion: taller?.avisoPrivacidad?.versionPlantilla ?? '',
    recargar: () => setRecarga((n) => n + 1),
  };

  return (
    <CotizacionesContext.Provider value={valor}>
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '16px 16px 0' }}>
        {!config && (
          <p role="alert" style={{ color: '#B3261E', fontSize: '14px' }}>Las cotizaciones no están disponibles por ahora. Solo puedes ver tus cotizaciones.</p>
        )}
        {config && !versionVigente && (
          <AvisoVersion
            tallerId={tallerId}
            versionVigente={{ version: config.terminosVersion }}
            resumen={config.resumenCambios}
            onAceptada={() => setRecarga((n) => n + 1)}
          />
        )}
        {config && versionVigente && taller && taller.activo !== true && (
          <p role="alert" style={{ color: '#8A2A1A', fontSize: '14px' }}>Tu taller está desactivado: solo puedes ver tus cotizaciones y quitar datos de tus clientes.</p>
        )}
      </div>
      {children}
    </CotizacionesContext.Provider>
  );
}
