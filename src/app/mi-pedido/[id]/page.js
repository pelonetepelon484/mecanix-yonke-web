import { Suspense } from 'react';
import MiPedidoCliente from './MiPedidoCliente';

// Enlace privado del cliente (lleva el código en ?c=): nunca se indexa y el navegador no manda
// la dirección completa como "referer" al abrir los enlaces de WhatsApp de los yonkes.
export const metadata = {
  title: 'Mi pedido de pieza | Mecanix Yonke Virtual',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function MiPedidoPage() {
  return (
    <Suspense fallback={null}>
      <MiPedidoCliente />
    </Suspense>
  );
}
