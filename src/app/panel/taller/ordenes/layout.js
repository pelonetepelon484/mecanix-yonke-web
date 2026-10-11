'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../AuthContext';
import { talleresHabilitados } from '../../../../lib/talleresHabilitados';
import { leerConfigCotizaciones, leerTaller } from '../cotizaciones/datos';
import { leerConfigOrdenes } from './datos';
import { OrdenesContext } from './contexto';
import AvisoVersion from '../AvisoVersion';

// Marco de "Órdenes de servicio" (copiado del de cotizaciones). Falla cerrada: con la función de
// talleres apagada, o sin config/ordenes con habilitado == true, no se abre (ni por botón ni por
// dirección) y regresa al inicio del taller. Los términos vigentes son los mismos de cotizaciones.
export default function OrdenesLayout({ children }) {
  const router = useRouter();
  const { tallerId } = useAuth();
  const activo = talleresHabilitados();
  const [recarga, setRecarga] = useState(0);
  const [estado, setEstado] = useState({ cargando: true, taller: null, config: null, configOrdenes: null, error: '' });
  const apagada = !activo || (!estado.cargando && !estado.error && estado.configOrdenes?.habilitado !== true);

  useEffect(() => {
    if (apagada) router.replace('/panel/taller');
  }, [apagada]);

  useEffect(() => {
    if (!tallerId || !activo) return;
    let cancelado = false;
    Promise.all([leerTaller(tallerId), leerConfigCotizaciones(), leerConfigOrdenes()])
      .then(([taller, config, configOrdenes]) => {
        if (!cancelado) setEstado({ cargando: false, taller, config, configOrdenes, error: '' });
      })
      .catch((err) => {
        console.error(err);
        if (!cancelado) setEstado({ cargando: false, taller: null, config: null, configOrdenes: null, error: 'No pudimos cargar tu taller. Intenta de nuevo.' });
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

  const { taller, config, configOrdenes } = estado;
  const versionVigente = Boolean(config && taller && taller.aceptacionVersion === config.terminosVersion);
  const puedeEditar = versionVigente && taller?.activo === true;
  const valor = {
    tallerId,
    taller,
    versionVigente,
    puedeEditar,
    avisoVersion: configOrdenes?.avisoOrdenVersion ?? '',
    // Para decidir, orden por orden, si se pueden capturar datos del cliente (datosClienteDisponibles).
    configOrdenes,
  };

  return (
    <OrdenesContext.Provider value={valor}>
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '16px 16px 0' }}>
        {!config && (
          <p role="alert" style={{ color: '#B3261E', fontSize: '14px' }}>Las órdenes no están disponibles por ahora. Solo puedes ver tus órdenes.</p>
        )}
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
          <p role="alert" style={{ color: '#8A2A1A', fontSize: '14px' }}>Tu taller está desactivado: solo puedes ver tus órdenes.</p>
        )}
      </div>
      {children}
    </OrdenesContext.Provider>
  );
}
