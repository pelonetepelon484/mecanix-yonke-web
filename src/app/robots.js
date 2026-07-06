export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/panel/', '/admin/'],
      },
    ],
    sitemap: 'https://mecanixyonkevirtual.com/sitemap.xml',
  };
}