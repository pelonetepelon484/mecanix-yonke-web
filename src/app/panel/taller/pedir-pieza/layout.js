'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../AuthContext';
import { talleresHabilitados } from '../../../../lib/talleresHabilitados';
import { leerTaller } from '../cotizaciones/datos';
import { leerConfigSolicitudesPiezas } from '../../solicitudesPiezasDatos';
import { PedirPiezaContext } from './contexto';

// Sin config/solicitudesPiezas (función apagada) -- o con la bandera general de talleres
// apagada -- ninguna pantalla de "pedir una pieza" se abre, ni por botón ni por dirección
// directa: se manda de vuelta al inicio del taller, igual que cotizaciones cuando la bandera
// general está apagada. Carga el taller y la bandera una sola vez y los reparte a las pantallas.
export default function PedirPiezaLayout({ children }) {
  const router = useRouter();
  const { tallerId } = useAuth();
  const activo = talleresHabilitados();
  const [estado, setEstado] = useState({ cargando: true, taller: null, habilitado: false });

  useEffect(() => {
    if (!activo) router.replace('/panel/taller');
  }, [activo]);

  useEffect(() => {
    if (!tallerId || !activo) return;
    let cancelado = false;
    Promise.all([leerTaller(tallerId), leerConfigSolicitudesPiezas()])
      .then(([taller, config]) => {
        if (!cancelado) setEstado({ cargando: false, taller, habilitado: config?.habilitado === true });
      })
      .catch(() => { if (!cancelado) setEstado({ cargando: false, taller: null, habilitado: false }); });
    return () => { cancelado = true; };
  }, [tallerId, activo]);

  useEffect(() => {
    if (!estado.cargando && !estado.habilitado) router.replace('/panel/taller');
  }, [estado.cargando, estado.habilitado]);

  if (!activo || estado.cargando || !estado.habilitado) {
    return <main style={{ minHeight: '100vh', padding: '24px' }}><p style={{ color: '#555' }}>Cargando...</p></main>;
  }

  return (
    <PedirPiezaContext.Provider value={{ tallerId, taller: estado.taller }}>
      {children}
    </PedirPiezaContext.Provider>
  );
}
