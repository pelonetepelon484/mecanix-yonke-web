import { notFound } from 'next/navigation';
import { dbServer } from '../lib/firebase-server';
import { leerConfigComparador } from '../../lib/configComparador';
import { talleresHabilitados } from '../../lib/talleresHabilitados';
import ComparadorClient from './ComparadorClient';

// /comparador: comparador de compatibilidad de piezas, detrás de config/comparador.habilitado (solo
// true exacto; apagado o si falla la lectura: 404 y noindex). Fuera del sitemap por ahora.
// Se revisa la bandera cada minuto.
export const revalidate = 60;

const TITULO = 'Comparador de compatibilidad de piezas';
const DESCRIPCION = 'Compara dos VIN o dos números de parte y mira si una pieza usada le queda a tu vehículo. Resultado orientativo, con tecnología Mecanix.';
const NO_INDEXAR = { index: false, follow: false, googleBot: { index: false, follow: false } };

export async function generateMetadata() {
  const { habilitado } = await leerConfigComparador(dbServer);
  if (!habilitado) return { title: 'Comparador', robots: NO_INDEXAR };
  return { title: TITULO, description: DESCRIPCION, alternates: { canonical: '/comparador' } };
}

export default async function ComparadorPage() {
  const { habilitado, requiereLogin } = await leerConfigComparador(dbServer);
  if (!habilitado) notFound();
  return <ComparadorClient requiereLogin={requiereLogin} conTalleres={talleresHabilitados()} />;
}
