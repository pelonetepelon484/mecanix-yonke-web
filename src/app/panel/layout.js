import PanelLayoutCliente from './PanelLayoutCliente';
import { COLOR_TEMA } from '../../lib/manifestPanel';

// App instalable (PWA) de yonkes y talleres: el manifest, los datos para iPhone (appleWebApp,
// apple-touch-icon) y el color de la barra viven SOLO en el panel. Las páginas públicas y los
// subdominios de los yonkes (que nunca llegan aquí: el middleware los manda a /tenant-demo)
// no cambian.
export const metadata = {
  manifest: '/panel/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Mecanix', statusBarStyle: 'default' },
  icons: {
    icon: '/favicon.ico',
    apple: [{ url: '/icons/apple-icon-180.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport = {
  themeColor: COLOR_TEMA,
};

export default function PanelLayout({ children }) {
  return <PanelLayoutCliente>{children}</PanelLayoutCliente>;
}
