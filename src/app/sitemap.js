import { CIUDADES_BC } from './lib/ciudades';
import { getYonkesActivosParaSitemap } from './lib/yonkesServerData';

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
      url: 'https://mecanixyonkevirtual.com',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: 'https://mecanixyonkevirtual.com/yonkes',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...CIUDADES_BC.map((c) => ({
      url: `https://mecanixyonkevirtual.com/yonkes/${c.key}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    })),
    ...yonkes.map((y) => ({
      url: `https://mecanixyonkevirtual.com/yonkes/${y.ciudad}/${y.id}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    })),
    {
      url: 'https://mecanixyonkevirtual.com/panel',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: 'https://mecanixyonkevirtual.com/panel/registro',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://mecanixyonkevirtual.com/calificar',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: 'https://mecanixyonkevirtual.com/nosotros',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: 'https://mecanixyonkevirtual.com/compra-segura',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: 'https://mecanixyonkevirtual.com/privacidad',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: 'https://mecanixyonkevirtual.com/terminos',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}