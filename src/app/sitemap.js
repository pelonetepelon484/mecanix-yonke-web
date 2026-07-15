import { CIUDADES_BC } from './lib/ciudades';

export default function sitemap() {
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