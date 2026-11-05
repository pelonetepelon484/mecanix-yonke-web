import { cache } from 'react';
import { notFound } from 'next/navigation';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { dbServer } from '../lib/firebase-server';
import { leerConfigPortada } from '../../lib/configPortada';
import { IMAGEN_PORTADA } from '../../lib/imagenPortada';
import { SITIO_OFICIAL } from '../../lib/sitioOficial';
import { COLECCION_ASISTENCIA, proveedorParaPagina } from '../../lib/asistenciaVial';
import AsistenciaVialClient from './AsistenciaVialClient';

// /asistencia-vial (etapa 1): directorio de grúas, llanteras y ayuda en carretera. Detrás de
// config/portada.asistenciaVialActiva (solo true exacto; apagada o si falla la lectura: 404 y
// noindex, sin leer proveedores). Una sola consulta (activo == true) cada 10 min, como la portada:
// las visitas no leen Firestore y los filtros se hacen en el navegador. Fuera del sitemap por ahora.
export const revalidate = 600;

const leerBanderas = cache(() => leerConfigPortada(dbServer));
const TITULO = 'Grúas y asistencia vial en Baja California';
const DESCRIPCION = 'Grúas, llanteras y ayuda en carretera en Tijuana, Rosarito, Tecate, Ensenada y Mexicali. Llama o escribe directo al proveedor colaborador de la red Mecanix.';
const NO_INDEXAR = { index: false, follow: false, googleBot: { index: false, follow: false } };

export async function generateMetadata() {
  const { asistenciaVialActiva } = await leerBanderas();
  if (!asistenciaVialActiva) return { title: 'Asistencia vial', robots: NO_INDEXAR };
  return {
    title: TITULO,
    description: DESCRIPCION,
    alternates: { canonical: '/asistencia-vial' },
    openGraph: {
      title: TITULO, description: DESCRIPCION, url: `${SITIO_OFICIAL}/asistencia-vial`,
      siteName: 'Red Mecanix', locale: 'es_MX', type: 'website', images: [IMAGEN_PORTADA],
    },
  };
}

async function leerProveedores() {
  try {
    const snap = await getDocs(query(collection(dbServer, COLECCION_ASISTENCIA), where('activo', '==', true)));
    // La hora de la lectura decide qué sellos siguen vigentes (igual en el HTML y en el navegador).
    return { proveedores: snap.docs.map((d) => proveedorParaPagina(d.id, d.data())), ahoraMs: Date.now() };
  } catch (error) {
    console.warn('[asistencia-vial] No se pudieron leer los proveedores.', error?.code || error?.message);
    return { proveedores: [], ahoraMs: Date.now() };
  }
}

export default async function AsistenciaVialPage() {
  const { asistenciaVialActiva } = await leerBanderas();
  if (!asistenciaVialActiva) notFound();
  const { proveedores, ahoraMs } = await leerProveedores();
  return <AsistenciaVialClient proveedores={proveedores} ahoraMs={ahoraMs} />;
}
