'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../AuthContext';

// Guarda de /panel/refaccionaria: solo entra una cuenta con rol 'refaccionaria' (mismo patrón que
// /panel/taller). Visitantes, yonkes, talleres y admin se van al login del panel. El registro es
// público y no pasa por la guarda (él mismo revisa config/refaccionarias.habilitado).
function GuardaRefaccionaria({ children }) {
  const { user, userRole, loading, rolListo } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const esRegistro = pathname === '/panel/refaccionaria/registro';
  const cargando = loading || (user && !rolListo);
  const noAutorizado = !user || userRole !== 'refaccionaria';
  const bloquear = !esRegistro && !cargando && noAutorizado;

  useEffect(() => {
    if (bloquear) router.replace('/panel');
  }, [bloquear]); // eslint-disable-line react-hooks/exhaustive-deps

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

export default function RefaccionariaLayout({ children }) {
  return <GuardaRefaccionaria>{children}</GuardaRefaccionaria>;
}
