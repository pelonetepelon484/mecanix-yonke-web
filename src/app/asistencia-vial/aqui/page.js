import AquiClient from './AquiClient';

// Enlace privado de cada proveedor de asistencia vial ("Estoy aquí"). El secreto va después del
// "#" de la dirección: el navegador nunca lo manda al servidor al abrir la página. Sin indexar.
export const metadata = {
  title: 'Estoy aquí · Asistencia vial',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function AquiPage() {
  return <AquiClient />;
}
