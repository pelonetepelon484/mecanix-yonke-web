import { describe, expect, it } from 'vitest';
import {
  PROMOS_MAX, PROMO_TITULO_MAX, mensajePromoWhatsapp, sanearPromoImagenes,
  validarPromosParaGuardar, validarTituloPromo, whatsappHrefPromo,
} from './promos';
import { normalizarWhatsapp, whatsappHref } from './whatsapp';
import { dimensionesEscaladas } from './imagenes';

const URL_OK = 'https://firebasestorage.googleapis.com/v0/b/x/o/branding%2Fy1%2Fpromos%2Fa.webp?alt=media&token=t';

describe('validarTituloPromo', () => {
  it('recorta espacios y acepta hasta 60 caracteres', () => {
    expect(validarTituloPromo('  20% en alternadores ')).toEqual({ ok: true, titulo: '20% en alternadores' });
    expect(validarTituloPromo('a'.repeat(PROMO_TITULO_MAX)).ok).toBe(true);
  });
  it('rechaza vacío, solo espacios, no-string y más de 60', () => {
    expect(validarTituloPromo('').ok).toBe(false);
    expect(validarTituloPromo('   ').ok).toBe(false);
    expect(validarTituloPromo(undefined).ok).toBe(false);
    const largo = validarTituloPromo('a'.repeat(PROMO_TITULO_MAX + 1));
    expect(largo.ok).toBe(false);
    if (!largo.ok) expect(largo.error).toMatch(/60/);
  });
});

describe('sanearPromoImagenes', () => {
  it('no-array o basura -> []', () => {
    expect(sanearPromoImagenes(undefined)).toEqual([]);
    expect(sanearPromoImagenes('x')).toEqual([]);
    expect(sanearPromoImagenes([null, 5, {}, { url: 1, titulo: 'a' }])).toEqual([]);
  });
  it('descarta urls no https (incluye gs://) y títulos vacíos', () => {
    const r = sanearPromoImagenes([
      { url: 'gs://bucket/a.webp', titulo: 'a' },
      { url: 'http://x.com/a.webp', titulo: 'b' },
      { url: URL_OK, titulo: '   ' },
      { url: URL_OK, titulo: 'Buena' },
    ]);
    expect(r).toEqual([{ url: URL_OK, titulo: 'Buena' }]);
  });
  it('máximo 3 y recorta el título a 60', () => {
    const r = sanearPromoImagenes(Array.from({ length: 5 }, (_, i) => ({ url: URL_OK, titulo: `p${i}${'x'.repeat(80)}` })));
    expect(r).toHaveLength(PROMOS_MAX);
    expect(r[0].titulo).toHaveLength(PROMO_TITULO_MAX);
  });
});

describe('mensaje y enlace de WhatsApp', () => {
  it('mensaje exacto de la especificación', () => {
    expect(mensajePromoWhatsapp('20% en alternadores', 'Yonke El Camino'))
      .toBe('Hola, vi la promoción «20% en alternadores» de Yonke El Camino en Mecanix Yonke Virtual y me interesa. ¿Sigue disponible?');
  });
  it('enlace wa.me con el texto codificado', () => {
    const href = whatsappHrefPromo('664 123 4567', '20% en alternadores', 'Yonke El Camino');
    expect(href).toBeTruthy();
    expect(href!.startsWith('https://wa.me/526641234567?text=')).toBe(true);
    const texto = decodeURIComponent(href!.split('?text=')[1]);
    expect(texto).toContain('«20% en alternadores»');
    expect(href).not.toContain(' '); // todo codificado (el % del título viaja como %25)
    expect(href).toContain('20%25');
  });
  it('sin número válido -> null (la imagen se muestra sin enlace)', () => {
    expect(whatsappHrefPromo('', 't', 'n')).toBeNull();
    expect(whatsappHrefPromo(undefined, 't', 'n')).toBeNull();
    expect(whatsappHrefPromo('12345', 't', 'n')).toBeNull();
  });
});

describe('normalizarWhatsapp', () => {
  it('10 dígitos -> 52 + número (igual que el código existente)', () => {
    expect(normalizarWhatsapp('6641234567')).toBe('526641234567');
    expect(normalizarWhatsapp('(664) 123-4567')).toBe('526641234567');
  });
  it('no duplica el código de país', () => {
    expect(normalizarWhatsapp('+52 664 123 4567')).toBe('526641234567');
    expect(normalizarWhatsapp('5216641234567')).toBe('526641234567');
  });
  it('inválidos -> null', () => {
    expect(normalizarWhatsapp('123')).toBeNull();
    expect(normalizarWhatsapp('12345678901234')).toBeNull();
    expect(normalizarWhatsapp(null)).toBeNull();
  });
  it('whatsappHref codifica el mensaje', () => {
    expect(whatsappHref('6641234567', 'hola mundo')).toBe('https://wa.me/526641234567?text=hola%20mundo');
  });
});

describe('validarPromosParaGuardar', () => {
  it('acepta hasta 3 válidas', () => {
    expect(validarPromosParaGuardar([{ url: URL_OK, titulo: 'a' }]).ok).toBe(true);
    expect(validarPromosParaGuardar([]).ok).toBe(true);
  });
  it('rechaza 4, título vacío o url no https', () => {
    const p = { url: URL_OK, titulo: 'a' };
    expect(validarPromosParaGuardar([p, p, p, p]).ok).toBe(false);
    expect(validarPromosParaGuardar([{ url: URL_OK, titulo: '' }]).ok).toBe(false);
    expect(validarPromosParaGuardar([{ url: 'gs://b/a', titulo: 'a' }]).ok).toBe(false);
  });
});

describe('dimensionesEscaladas', () => {
  it('logo: cabe en 400x400 conservando proporción', () => {
    expect(dimensionesEscaladas(800, 400, { maxAncho: 400, maxAlto: 400 })).toEqual({ ancho: 400, alto: 200 });
    expect(dimensionesEscaladas(300, 200, { maxAncho: 400, maxAlto: 400 })).toEqual({ ancho: 300, alto: 200 });
  });
  it('promo: solo limita el ancho a 1200', () => {
    expect(dimensionesEscaladas(2400, 1600, { maxAncho: 1200 })).toEqual({ ancho: 1200, alto: 800 });
    expect(dimensionesEscaladas(1000, 5000, { maxAncho: 1200 })).toEqual({ ancho: 1000, alto: 5000 });
  });
});
