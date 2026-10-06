'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../AuthContext';

// Guarda de /panel/taller: solo entra una cuenta con rol 'taller'. Visitantes, yonkes y admin
// se van al login del panel. El registro de taller es público y no pasa por la guarda.
function GuardaTallerPaneles({ children }) {
  const { user, userRole, loading, rolListo } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const esRegistro = pathname === '/panel/taller/registro';
  // Mientras no se sepa el rol (usuario ya autenticado pero sin leer usuarios/{uid}), no se
  // decide nada: se muestra carga neutra. Así no se manda al login ni aparece el menú de yonke.
  const cargando = loading || (user && !rolListo);
  const noAutorizado = !user || userRole !== 'taller';
  const bloquear = !esRegistro && !cargando && noAutorizado;

  useEffect(() => {
    if (bloquear) router.replace('/panel');
  }, [bloquear]);

  if (esRegistro) return <>{children}</>;
  if (cargando) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F5F5' }}>
        <p style={{ color: '#555', fontSize: '16px' }}>Cargando...</p>
      </main>
    );
  }
  if (bloquear) return null;
  return <>{children}</>;
}

export default function TallerLayout({ children }) {
  return <GuardaTallerPaneles>{children}</GuardaTallerPaneles>;
}
