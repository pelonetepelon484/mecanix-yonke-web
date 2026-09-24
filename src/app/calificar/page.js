import CalificarClient from './CalificarClient';

// Wrapper servidor solo para poder tener metadata propia — la página en sí (buscar el pedido
// por número, calificar) es 100% interactiva y no depende de ningún parámetro de la URL, así
// que no hace falta leer Firestore aquí (CalificarClient.js sigue siendo el único que lee/
// escribe, sin cambios de lógica).
export const metadata = {
  title: 'Califica tu experiencia',
  description: 'Califica tu experiencia de compra con un yonke afiliado a Mecanix Yonke Virtual usando tu número de pedido.',
  alternates: { canonical: '/calificar' },
  robots: { index: true, follow: true },
};

export default function CalificarPage() {
  return <CalificarClient />;
}
