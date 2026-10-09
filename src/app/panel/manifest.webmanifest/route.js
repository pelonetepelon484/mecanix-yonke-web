import { manifestPanel } from '../../../lib/manifestPanel';

// /panel/manifest.webmanifest: manifest de la app instalable, enlazado solo desde el panel.
export const dynamic = 'force-static';

export function GET() {
  return new Response(JSON.stringify(manifestPanel()), {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
