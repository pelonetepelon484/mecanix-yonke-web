// Scroll suave hacia el encabezado de "Esto es lo que hay en otros estados" (solo navegador).
// El margen es MARGEN_SCROLL_OTROS_ESTADOS (src/lib/otrosEstadosPantalla.js) más la altura de
// cualquier barra fija o pegada arriba de la página.
import { MARGEN_SCROLL_OTROS_ESTADOS } from '../../lib/otrosEstadosPantalla';

// Hasta dónde llegan, desde arriba, las barras fijas o pegadas que tapan la parte de arriba de la
// pantalla (0 si no hay). Cuenta cualquier header o nav con position fixed/sticky pegado arriba, y
// cualquier elemento marcado con data-barra-fija-arriba (para una barra futura con otra etiqueta).
// Hoy la portada no tiene ninguna.
export function alturaBarrasFijasArriba(doc = document) {
  let alto = 0;
  for (const el of doc.querySelectorAll('[data-barra-fija-arriba], header, nav')) {
    const posicion = doc.defaultView.getComputedStyle(el).position;
    if (posicion !== 'fixed' && posicion !== 'sticky') continue;
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.top <= 1 && r.bottom > 0) alto = Math.max(alto, r.bottom);
  }
  return alto;
}

// Desplaza la página para que `el` quede `margen` px debajo de las barras fijas. No hace nada si el
// encabezado ya se ve completo. Con "reducir movimiento" activado, salta sin animación.
// Devuelve true si desplazó.
export function desplazarHaciaOtrosEstados(el, { margen = MARGEN_SCROLL_OTROS_ESTADOS, win = window } = {}) {
  if (!el) return false;
  const barras = alturaBarrasFijasArriba(win.document);
  const r = el.getBoundingClientRect();
  if (r.top >= barras && r.bottom <= win.innerHeight) return false;
  const reducir = typeof win.matchMedia === 'function' && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  win.scrollTo({ top: Math.max(0, r.top + win.scrollY - barras - margen), behavior: reducir ? 'auto' : 'smooth' });
  return true;
}
