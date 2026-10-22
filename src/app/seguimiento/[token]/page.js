import { Suspense } from 'react';
import SeguimientoCliente from './SeguimientoCliente';

// Enlace privado de seguimiento (el token va en la dirección): nunca se indexa, y el navegador no
// manda la dirección completa como "referer" al abrir WhatsApp. Título genérico, sin taller ni
// vehículo, para que la vista previa de WhatsApp no muestre datos.
export const metadata = {
  title: 'Seguimiento de tu orden',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function SeguimientoPage() {
  return (
    <Suspense fallback={null}>
      <SeguimientoCliente />
    </Suspense>
  );
}
