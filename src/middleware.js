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

  console.log('[tenant-middleware]', { host, sub }); // TODO: quitar tras verificar en producción

  const url = req.nextUrl.clone();
  url.pathname = '/tenant-demo';

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-tenant-sub', sub);

  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)'],
};
