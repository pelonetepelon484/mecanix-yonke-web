'use client';

import { useBanderaPedidosClientes } from './lib/banderaPedidosClientes';

// Campo viejo "Tu WhatsApp (opcional...)" del buscador con IA. Con el pedido de piezas de
// clientes encendido (config/pedidosClientes) desaparece: en su lugar, cuando no hay
// resultados, aparece "Avisar a los yonkes". Apagado, es exactamente el mismo campo de antes.
export default function CampoWhatsappBusqueda({ value, onChange }) {
  const pedidosClientesActivos = useBanderaPedidosClientes();
  if (pedidosClientesActivos) return null;
  return (
    <input
      className="mecanix-input"
      type="text"
      placeholder="Tu WhatsApp (opcional, para avisarte si no hay stock)"
      value={value}
      onChange={onChange}
    />
  );
}
