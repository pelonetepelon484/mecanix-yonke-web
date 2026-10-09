import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./PanelLayoutCliente', () => ({ default: ({ children }) => children }));

const { metadata, viewport } = await import('./layout.js');
const { GET } = await import('./manifest.webmanifest/route.js');

// Ancho y alto reales de un PNG (bytes 16-23 del encabezado IHDR).
function medidas(rutaPublica) {
  const buf = readFileSync(join(process.cwd(), 'public', rutaPublica));
  return `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`;
}

describe('app instalable (PWA) del panel', () => {
  it('el manifest trae lo pedido: nombre, inicio en /panel, standalone, colores e íconos', async () => {
    const res = GET();
    expect(res.headers.get('Content-Type')).toContain('application/manifest+json');
    const m = await res.json();
    expect(m).toMatchObject({
      name: 'Mecanix', short_name: 'Mecanix', start_url: '/panel', scope: '/', display: 'standalone',
      background_color: '#F4F5F5', theme_color: '#1A3C5E',
    });
    expect(m.icons.map((i) => [i.sizes, i.purpose])).toEqual([['192x192', 'any'], ['512x512', 'any'], ['512x512', 'maskable']]);
  });
  it('los íconos existen y miden lo que dice el manifest; el apple-icon mide 180', async () => {
    const m = await GET().json();
    for (const icono of m.icons) expect(medidas(icono.src)).toBe(icono.sizes);
    expect(medidas('/icons/apple-icon-180.png')).toBe('180x180');
  });
  it('el layout del panel enlaza el manifest y trae appleWebApp, apple-icon y themeColor', () => {
    expect(metadata.manifest).toBe('/panel/manifest.webmanifest');
    expect(metadata.appleWebApp).toEqual({ capable: true, title: 'Mecanix', statusBarStyle: 'default' });
    expect(metadata.icons.apple[0]).toMatchObject({ url: '/icons/apple-icon-180.png', sizes: '180x180' });
    expect(viewport.themeColor).toBe('#1A3C5E');
  });
  it('el layout raíz (páginas públicas y subdominios) NO enlaza manifest ni appleWebApp', () => {
    const raiz = readFileSync(join(process.cwd(), 'src/app/layout.js'), 'utf8');
    expect(raiz).not.toMatch(/manifest|appleWebApp|themeColor/);
  });
});
