import { CIUDADES_BC } from './lib/ciudades';
import { getYonkesActivosParaSitemap } from './lib/yonkesServerData';
import { SITIO_OFICIAL } from '../lib/sitioOficial';

export default async function sitemap() {
  let yonkes = [];
  try {
    yonkes = await getYonkesActivosParaSitemap();
  } catch (error) {
    // Fail-open: el sitemap no debe romperse por un error de Firestore — se publica sin las
    // URLs de detalle de yonke en vez de tumbar /sitemap.xml completo.
    console.error('[sitemap] No se pudieron leer los yonkes activos', { code: error?.code, message: error?.message });
  }

  return [
    {
      url: SITIO_OFICIAL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${SITIO_OFICIAL}/yonkes`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...CIUDADES_BC.map((c) => ({
      url: `${SITIO_OFICIAL}/yonkes/${c.key}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    })),
    ...yonkes.map((y) => ({
      url: `${SITIO_OFICIAL}/yonkes/${y.ciudad}/${y.id}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    })),
    {
      url: `${SITIO_OFICIAL}/panel`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${SITIO_OFICIAL}/panel/registro`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITIO_OFICIAL}/calificar`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${SITIO_OFICIAL}/nosotros`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${SITIO_OFICIAL}/compra-segura`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${SITIO_OFICIAL}/privacidad`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${SITIO_OFICIAL}/terminos`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}