# Demo: subdominio con marca de yonke (multi-tenant básico)

## Objetivo

Que `demo.mecanixyonkevirtual.com` muestre una versión re-marcada del sitio (logo,
nombre y colores de UN yonke piloto) mostrando solo su inventario — una demo de
ventas para mostrarle a los pilotos "así se vería el tuyo, solo faltan unos
ajustes y tu logo va aquí".

## Decisión de arquitectura

`src/app/page.js` (la home real) es un Client Component completo (`'use client'`,
~1100 líneas) con toda la lógica de búsqueda, estado, Firestore client-side y
GA4 — no es un Server Component y no puede leer `headers()`. Intentar
convertirlo o inyectarle un theme provider significaría editar el archivo que
justo no debemos tocar ("el sitio principal NO debe cambiar").

**Solución:** la demo vive en una ruta completamente separada y nueva, a la que
el middleware redirige (`rewrite`) solo cuando detecta un subdominio de tenant.
`page.js` y `layout.js` nunca se tocan, nunca se ejecutan distinto.

1. **Middleware sin Firestore** (`src/middleware.js`) — lee el header `host`,
   detecta el subdominio, hace `rewrite` a `/tenant-demo` + header
   `x-tenant-sub`. Ninguna consulta a Firestore aquí (Edge runtime).
2. **Lookup del tenant** (`src/app/lib/getTenant.js`) — usa `dbServer` de
   `src/app/lib/firebase-server.js` (Firestore-solo-lectura, sin `getAuth`, ya
   verificado con las páginas SEO `/yonkes/[ciudad]`). Expone
   `getTenantBySub`, `getInventarioDeTenant` (vehículos + motores) y
   `resolveBranding` (fallback campo por campo, nunca todo-o-nada).
3. **Página del tenant** (`src/app/tenant-demo/page.js`) — Server Component
   nuevo e independiente: header con logo/nombre/colores del tenant, aviso de
   "vista previa", grilla de inventario con botón de WhatsApp por ítem,
   `generateMetadata` propio con `robots: noindex` (una demo de ventas no debe
   indexarse en Google).

## Archivos (implementados, ninguno existente se modificó)
- `src/middleware.js`
- `src/app/lib/getTenant.js`
- `src/app/tenant-demo/page.js`

**No se tocó:** `src/app/page.js`, `src/app/layout.js`, `next.config.mjs`,
`src/app/lib/firebase.js`.

## Paso 1 — DNS y Vercel (wildcard real: nameservers, no un CNAME simple)

El wildcard de Vercel requiere delegar los nameservers del dominio a Vercel —
un CNAME con Host `*` no es suficiente para el dominio apex/wildcard completo.

1. **Antes de cambiar nameservers**, revisar en Namecheap si
   `mecanixyonkevirtual.com` tiene registros MX, TXT u otros (aparte del
   sitio) — anotarlos para replicarlos después en Vercel si aplica.
2. **En Namecheap:** Domain List → Manage → Nameservers, cambiar de
   "Namecheap BasicDNS" a "Custom DNS", y poner:
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
3. **En Vercel:** Settings → Domains, agregar el dominio apex
   `mecanixyonkevirtual.com` (si no está ya) y luego agregar el wildcard
   `*.mecanixyonkevirtual.com`.
4. Si había registros MX/TXT del paso 1, recrearlos en la zona DNS de Vercel
   (Settings → Domains → mecanixyonkevirtual.com → DNS Records).

> Este cambio de nameservers lo hace David directamente en Namecheap/Vercel —
> no es algo que se automatice desde el código.

## Datos (manual, en Firestore — no es código)
En el documento del yonke piloto, agregar:
```
subdominio: "demo"
branding: {
  nombreComercial: "Yonke El Camino",   // opcional, cae a tenant.nombre si falta
  logoUrl: "https://.../logo-elcamino.png",
  colorPrimario: "#1A3C5E",
  colorAcento: "#E8720C"
}
```
Todos los campos de `branding` son opcionales — si falta alguno, cae al valor
default de Mecanix (`#1A3C5E`, `#E8720C`, `#F0F2F5`, `/mecanix-logo.webp`).

## Verificación
1. Con el yonke piloto ya con `subdominio`+`branding` en Firestore:
   `npm run build && npm start`, agregar `127.0.0.1 demo.mecanixyonkevirtual.com`
   al archivo `hosts`, abrir `http://demo.mecanixyonkevirtual.com:3000` → debe
   verse el logo/nombre/colores del tenant y solo su inventario.
2. `http://localhost:3000` (sin subdominio) → exactamente igual que siempre.
3. Un subdominio que no exista en Firestore (ej. `noexiste.mecanixyonkevirtual.com`)
   → 404 limpio desde `/tenant-demo`, no rompe nada. **Ya verificado** con
   `curl -H "Host: ..."` simulando el header, incluyendo `www` y el apex
   pasando sin activar el modo tenant.
4. Una vez el DNS/Vercel estén configurados, repetir la prueba 1 desde el
   celular contra `demo.mecanixyonkevirtual.com` real.

## Estado actual
- Código: implementado y verificado (build limpio, middleware enrutando
  correctamente, 404 limpio para subdominios sin tenant registrado).
- Pendiente de David: Paso 1 (DNS/Vercel) y cargar `subdominio`/`branding` del
  yonke piloto en Firestore. Una vez hecho esto, falta confirmar el camino
  feliz completo (branding + inventario reales) — no se insertaron datos de
  prueba en el Firestore de producción sin permiso explícito.
