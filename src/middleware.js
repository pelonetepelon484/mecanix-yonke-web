import { NextResponse } from 'next/server';

const ROOT_DOMAIN = 'mecanixyonkevirtual.com';

export function middleware(req) {
  const host = (req.headers.get('host') || '').split(':')[0];

  let sub = '';
  if (host.endsWith(`.${ROOT_DOMAIN}`)) {
    const prefix = host.slice(0, -(ROOT_DOMAIN.length + 1));
    if (prefix && prefix !== 'www') {
      sub = prefix;
    }
  }

  if (!sub) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  // Todas las rutas de un tenant caen en la misma página (/tenant-demo) — la única sub-ruta real
  // hoy es /politicas (garantía y políticas del yonke, ver tenant-demo/politicas/page.js).
  // Cualquier otra ruta bajo el subdominio (incluida la raíz) sigue yendo al sitio principal.
  url.pathname = url.pathname === '/politicas' ? '/tenant-demo/politicas' : '/tenant-demo';

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-tenant-sub', sub);

  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)'],
};
