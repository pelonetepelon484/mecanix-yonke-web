// Manifest de la app instalable (PWA) de yonkes y talleres. Se sirve en
// /panel/manifest.webmanifest y SOLO lo enlazan las páginas del panel (src/app/panel/layout.js):
// así las páginas públicas y los subdominios de los yonkes no se ofrecen como app.
export const COLOR_TEMA = '#1A3C5E';
export const COLOR_FONDO = '#F4F5F5';

export function manifestPanel() {
  return {
    id: '/panel',
    name: 'Mecanix',
    short_name: 'Mecanix',
    description: 'Panel de Mecanix Yonke Virtual para yonkes y talleres.',
    lang: 'es-MX',
    start_url: '/panel',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: COLOR_FONDO,
    theme_color: COLOR_TEMA,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
