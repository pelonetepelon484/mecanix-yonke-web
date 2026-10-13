// Vista previa al compartir el enlace del subdominio de un yonke (WhatsApp, Facebook): textos,
// color del texto de la imagen y si el yonke califica para su propia imagen. Lógica pura, sin
// Firestore: la usan las páginas del subdominio (tenant-demo) y /api/vista-previa/[sub].
import { CIUDADES_BC } from '../app/lib/ciudades';

export const SITIO_PRINCIPAL = 'https://mecanixyonkevirtual.com';
export const DOMINIO_RAIZ = 'mecanixyonkevirtual.com';
// Caché de la imagen: 1 día (WhatsApp y Facebook además guardan su propia copia).
export const CACHE_VISTA_PREVIA_SEGUNDOS = 24 * 60 * 60;

// Mismo formato que genera generarSubdominio.js: minúsculas, números y guiones (no al inicio ni
// al final), máx. 63 caracteres. Se revisa ANTES de leer Firestore.
export function esSubdominioValido(sub) {
  return typeof sub === 'string' && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(sub) && sub !== 'www';
}

// Ciudad (solo las de CIUDADES_BC tienen nombre bonito); si no, el nombre del estado; si no, ''.
export function lugarDeYonke(tenant, estados = []) {
  const ciudad = CIUDADES_BC.find((c) => c.key === tenant?.ciudad)?.label;
  if (ciudad) return ciudad;
  return estados.find((e) => e.id === tenant?.estado)?.nombre || '';
}

export function tituloVistaPrevia(nombre, lugar) {
  return lugar ? `${nombre} · Autopartes usadas en ${lugar}` : nombre;
}

export function descripcionVistaPrevia(lugar) {
  const inicio = lugar ? `Refacciones y autopartes usadas en ${lugar}.` : 'Refacciones y autopartes usadas.';
  return `${inicio} Consulta su inventario y contáctalo directo por WhatsApp. Con tecnología Mecanix.`;
}

// Blanco u oscuro según qué contraste más con el color principal del yonke (luminancia WCAG).
export function colorTextoSobre(hex) {
  const limpio = typeof hex === 'string' ? hex.replace('#', '') : '';
  const largo = limpio.length === 3 ? limpio.split('').map((c) => c + c).join('') : limpio;
  if (!/^[0-9a-fA-F]{6}$/.test(largo)) return '#FFFFFF';
  const canal = (i) => {
    const c = parseInt(largo.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4);
  // Contraste contra blanco (1.05/(l+0.05)) vs contra #1A1A1A (l≈0.0103).
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.0603 ? '#FFFFFF' : '#1A1A1A';
}

// Solo se aceptan logos guardados en Firebase Storage (los que sube el panel): nunca se descarga
// una dirección cualquiera escrita en el documento.
export function esLogoPermitido(url) {
  return typeof url === 'string' && url.startsWith('https://firebasestorage.googleapis.com/');
}

// Huella corta del contenido de la imagen: va en la dirección (?v=) para que WhatsApp y Facebook
// pidan la imagen nueva cuando el yonke cambia nombre, logo o color.
export function huellaVistaPrevia({ nombre, logoUrl, colorPrimario, lugar }) {
  const texto = `${nombre}|${logoUrl || ''}|${colorPrimario || ''}|${lugar || ''}`;
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// Etiquetas de la vista previa para la página del subdominio (y su /politicas). El título de la
// pestaña del navegador no se toca aquí: lo sigue poniendo cada página como hoy.
// titulo (opcional): para /politicas; si no, "{Nombre} · Autopartes usadas en {Lugar}".
export function metadataVistaPrevia({ sub, nombre, lugar, logoUrl, colorPrimario, ruta = '', titulo: tituloPropio = '' }) {
  const url = `https://${sub}.${DOMINIO_RAIZ}${ruta}`;
  const titulo = tituloPropio || tituloVistaPrevia(nombre, lugar);
  const descripcion = descripcionVistaPrevia(lugar);
  const imagen = `${SITIO_PRINCIPAL}/api/vista-previa/${sub}?v=${huellaVistaPrevia({ nombre, logoUrl, colorPrimario, lugar })}`;
  return {
    description: descripcion,
    alternates: { canonical: url },
    openGraph: {
      title: titulo, description: descripcion, url, siteName: nombre, locale: 'es_MX', type: 'website',
      images: [{ url: imagen, width: 1200, height: 630, alt: nombre, type: 'image/png' }],
    },
    twitter: { card: 'summary_large_image', title: titulo, description: descripcion, images: [imagen] },
  };
}
