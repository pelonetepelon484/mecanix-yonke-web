'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { talleresHabilitados } from '../../../../lib/talleresHabilitados';

// Con la función de talleres apagada, las pantallas de cotizaciones no se abren, ni por el
// botón ni por la dirección directa: regresan al inicio del taller. La guarda de rol del taller
// (../layout.js) sigue aplicando debajo de esta.
export default function CotizacionesLayout({ children }) {
  const router = useRouter();
  const activo = talleresHabilitados();

  useEffect(() => {
    if (!activo) router.replace('/panel/taller');
  }, [activo]);

  if (!activo) return null;
  return <>{children}</>;
}
