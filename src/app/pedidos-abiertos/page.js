import PedidosAbiertosCliente from './PedidosAbiertosCliente';

// Página pública para yonkes (con o sin cuenta): solo vehículo, pieza, estado y fecha de los
// pedidos de clientes. No se indexa en buscadores.
export const metadata = {
  title: 'Pedidos de piezas abiertos | Mecanix Yonke Virtual',
  robots: { index: false, follow: false },
};

export default function PedidosAbiertosPage() {
  return <PedidosAbiertosCliente />;
}
