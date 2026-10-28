'use client';

// Parte cliente del layout del panel (la de servidor, layout.js, pone el manifest y los datos de
// la app instalable). Aquí van la sesión, la guarda de talleres, el aviso "Instalar app" y, arriba
// de todo el panel del yonke, el aviso de reaceptación de Términos (AvisoTerminosYonke). El
// contador del botón "Pedidos" (ConteoPedidosProvider) vive aquí para conectarse una vez por sesión.
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from './AuthContext';
import AvisoInstalarApp from './AvisoInstalarApp';
import AvisoTerminosYonke from './AvisoTerminosYonke';
import { ConteoPedidosProvider } from './ConteoPedidos';
import EnlaceIrAMecanix from './EnlaceIrAMecanix';

// Una cuenta de taller solo puede estar en /panel/taller, y una de refaccionaria solo en
// /panel/refaccionaria: si intentan abrir el panel de yonkes (u otro), las mandamos a su pantalla.
// Yonke y admin no pasan por aquí.
const SECCION_DEL_ROL = { taller: '/panel/taller', refaccionaria: '/panel/refaccionaria' };
function GuardaTaller({ children }) {
  const { loading, userRole } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const seccion = SECCION_DEL_ROL[userRole];
  const debeIrse = !loading && Boolean(seccion) && !pathname.startsWith(seccion);

  useEffect(() => {
    if (debeIrse) router.replace(seccion);
  }, [debeIrse, seccion]); // eslint-disable-line react-hooks/exhaustive-deps

  if (debeIrse) return null;
  return <>{children}</>;
}

export default function PanelLayoutCliente({ children }) {
  return (
    <AuthProvider>
      <ConteoPedidosProvider>
        <GuardaTaller>
          <EnlaceIrAMecanix />
          <AvisoTerminosYonke />
          <AvisoInstalarApp />
          {children}
        </GuardaTaller>
      </ConteoPedidosProvider>
    </AuthProvider>
  );
}