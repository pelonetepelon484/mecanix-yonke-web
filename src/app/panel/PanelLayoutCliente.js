'use client';

// Parte cliente del layout del panel (la de servidor, layout.js, pone el manifest y los datos de
// la app instalable). Aquí van la sesión, la guarda de talleres y el aviso "Instalar app".
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from './AuthContext';
import AvisoInstalarApp from './AvisoInstalarApp';

// Una cuenta de taller solo puede estar en /panel/taller: si intenta abrir el panel de yonkes,
// la mandamos a su pantalla. Yonke y admin no pasan por aquí.
function GuardaTaller({ children }) {
  const { loading, userRole } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const esRutaDeTaller = pathname.startsWith('/panel/taller');
  const debeIrseATaller = !loading && userRole === 'taller' && !esRutaDeTaller;

  useEffect(() => {
    if (debeIrseATaller) router.replace('/panel/taller');
  }, [debeIrseATaller]);

  if (debeIrseATaller) return null;
  return <>{children}</>;
}

export default function PanelLayoutCliente({ children }) {
  return (
    <AuthProvider>
      <GuardaTaller>
        <AvisoInstalarApp />
        {children}
      </GuardaTaller>
    </AuthProvider>
  );
}