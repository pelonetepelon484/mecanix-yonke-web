'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../AuthContext';
import { talleresHabilitados } from '../../../../lib/talleresHabilitados';
import { esPremiumVigente } from '../../../../lib/planes';
import { leerConfigCotizaciones, leerTaller } from '../cotizaciones/datos';
import { leerConfigContactos } from './config';
import { ContactosContext } from './contexto';
import AvisoVersion from '../AvisoVersion';

// Marco de la libreta de contactos (mismo patrón que historial). Falla cerrada: con la función de
// talleres apagada, o sin config/contactos.habilitado == true, no se abre y regresa al inicio del
// taller. Con términos viejos o taller desactivado: solo ver, escribir por WhatsApp y borrar.
// El límite de 25 del plan Básico lo muestra la lista (contactos/page.js).
export default function ContactosLayout({ children }) {
  const router = useRouter();
  const { tallerId } = useAuth();
  const activo = talleresHabilitados();
  const [recarga, setRecarga] = useState(0);
  const [estado, setEstado] = useState({ cargando: true, taller: null, config: null, configContactos: null, error: '' });
  const apagada = !activo || (!estado.cargando && !estado.error && estado.configContactos?.habilitado !== true);

  useEffect(() => {
    if (apagada) router.replace('/panel/taller');
  }, [apagada, router]);

  useEffect(() => {
    if (!tallerId || !activo) return undefined;
    let cancelado = false;
    Promise.all([leerTaller(tallerId), leerConfigCotizaciones(), leerConfigContactos()])
      .then(([taller, config, configContactos]) => {
        if (!cancelado) setEstado({ cargando: false, taller, config, configContactos, error: '' });
      })
      .catch((err) => {
        console.error(err);
        if (!cancelado) setEstado({ cargando: false, taller: null, config: null, configContactos: null, error: 'No pudimos cargar tu taller. Intenta de nuevo.' });
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
  const puedeEscribir = versionVigente && taller?.activo === true;
  const valor = { tallerId, taller, versionVigente, premium, puedeEscribir };

  return (
    <ContactosContext.Provider value={valor}>
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
          <p role="alert" style={{ color: '#8A2A1A', fontSize: '14px' }}>Tu taller está desactivado: solo puedes ver, escribir y borrar tus contactos.</p>
        )}
      </div>
      {children}
    </ContactosContext.Provider>
  );
}
