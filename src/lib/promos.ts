import { whatsappHref } from './whatsapp';

// Imágenes de ofertas/publicidad de un yonke con subdominio: yonkes/{id}.promoImagenes =
// [{ url, titulo }] (máx. 3). `url` es la URL de descarga de Storage (https, nunca gs://) y
// `titulo` (obligatorio, máx. 60 caracteres) se usa también en el mensaje de WhatsApp.
export const PROMOS_MAX = 3;
export const PROMO_TITULO_MAX = 60;
export const PROMO_PESO_MAX_BYTES = 300 * 1024;
export const PROMO_ANCHO_MAX_PX = 1200;

export interface PromoImagen {
  url: string;
  titulo: string;
}

export type ResultadoTitulo = { ok: true; titulo: string } | { ok: false; error: string };

export function validarTituloPromo(titulo: unknown): ResultadoTitulo {
  const t = typeof titulo === 'string' ? titulo.trim() : '';
  if (!t) return { ok: false, error: 'Escribe un título para la promoción (ej. “20% en alternadores”).' };
  if (t.length > PROMO_TITULO_MAX) {
    return { ok: false, error: `El título puede tener máximo ${PROMO_TITULO_MAX} caracteres.` };
  }
  return { ok: true, titulo: t };
}

// Lo que se lee del documento (dato no confiable): solo elementos con url https y título válido,
// hasta PROMOS_MAX; el título se recorta a su máximo. Un dato corrupto nunca rompe la página.
export function sanearPromoImagenes(valor: unknown): PromoImagen[] {
  if (!Array.isArray(valor)) return [];
  const resultado: PromoImagen[] = [];
  for (const item of valor) {
    if (resultado.length >= PROMOS_MAX) break;
    if (!item || typeof item !== 'object') continue;
    const { url, titulo } = item as { url?: unknown; titulo?: unknown };
    if (typeof url !== 'string' || !url.startsWith('https://')) continue;
    if (typeof titulo !== 'string' || !titulo.trim()) continue;
    resultado.push({ url, titulo: titulo.trim().slice(0, PROMO_TITULO_MAX) });
  }
  return resultado;
}

export function mensajePromoWhatsapp(titulo: string, nombreComercial: string): string {
  return `Hola, vi la promoción «${titulo}» de ${nombreComercial} y me interesa. ¿Sigue disponible?`;
}

// Enlace wa.me para tocar una promoción; null si el yonke no tiene WhatsApp válido.
export function whatsappHrefPromo(numero: unknown, titulo: string, nombreComercial: string): string | null {
  return whatsappHref(numero, mensajePromoWhatsapp(titulo, nombreComercial));
}

// Validación de lo que se va a GUARDAR (mismas reglas que las reglas de Firestore).
export function validarPromosParaGuardar(promos: PromoImagen[]): { ok: true } | { ok: false; error: string } {
  if (promos.length > PROMOS_MAX) return { ok: false, error: `Máximo ${PROMOS_MAX} imágenes de promoción.` };
  for (const p of promos) {
    const t = validarTituloPromo(p.titulo);
    if (!t.ok) return t;
    if (typeof p.url !== 'string' || !p.url.startsWith('https://')) {
      return { ok: false, error: 'La imagen no tiene una URL de descarga válida.' };
    }
  }
  return { ok: true };
}
