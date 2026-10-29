import { describe, expect, it } from 'vitest';
import {
  AL_VENCER_PREMIUM_TALLER, INCLUYE_PREMIUM_TALLER, banderaPremiumGratis, estadoPromoTaller, normalizarCorreo, normalizarWhatsapp,
  sumarMeses, textoPromoRegistro, textosBannerPromo,
} from './premiumGratis';

describe('bandera config/talleres', () => {
  it('solo true exacto la enciende; sin meses usa 3', () => {
    expect(banderaPremiumGratis(null)).toEqual({ habilitado: false, meses: 3 });
    expect(banderaPremiumGratis({ premiumGratisHabilitado: 'true' }).habilitado).toBe(false);
    expect(banderaPremiumGratis({ premiumGratisHabilitado: true })).toEqual({ habilitado: true, meses: 3 });
    expect(banderaPremiumGratis({ premiumGratisHabilitado: true, mesesPremiumGratis: 6 })).toEqual({ habilitado: true, meses: 6 });
  });
  it('meses inválidos (0, 13, texto, decimales): apagada (falla cerrada)', () => {
    for (const m of [0, 13, '3', 2.5, null, -1]) {
      expect(banderaPremiumGratis({ premiumGratisHabilitado: true, mesesPremiumGratis: m }).habilitado).toBe(false);
    }
  });
});

describe('sumarMeses (meses de calendario)', () => {
  it('29 oct + 3 = 29 ene, misma hora', () => {
    expect(sumarMeses(new Date('2026-10-29T18:30:00Z'), 3).toISOString()).toBe('2027-01-29T18:30:00.000Z');
  });
  it('si el día no existe, el último del mes (incluido bisiesto)', () => {
    expect(sumarMeses(new Date('2026-11-30T12:00:00Z'), 3).toISOString()).toBe('2027-02-28T12:00:00.000Z');
    expect(sumarMeses(new Date('2027-11-30T12:00:00Z'), 3).toISOString()).toBe('2028-02-29T12:00:00.000Z');
    expect(sumarMeses(new Date('2027-01-31T12:00:00Z'), 3).toISOString()).toBe('2027-04-30T12:00:00.000Z');
  });
  it('cruza el año', () => {
    expect(sumarMeses(new Date('2026-12-15T00:00:00Z'), 12).toISOString()).toBe('2027-12-15T00:00:00.000Z');
  });
});

describe('normalizar para las huellas', () => {
  it('WhatsApp: solo los últimos 10 dígitos', () => {
    expect(normalizarWhatsapp('664 123 4567')).toBe('6641234567');
    expect(normalizarWhatsapp('+52 1 664-123-4567')).toBe('6641234567');
    expect(normalizarWhatsapp('12345')).toBe('');
    expect(normalizarWhatsapp(null)).toBe('');
  });
  it('correo: minúsculas, sin espacios, sin +alias', () => {
    expect(normalizarCorreo('  Taller.Uno+pruebas@Hotmail.com ')).toBe('taller.uno@hotmail.com');
    expect(normalizarCorreo('a b@x.mx')).toBe('ab@x.mx');
  });
  it('Gmail: sin puntos en la parte local (googlemail también es Gmail)', () => {
    const mismo = 'jperez@gmail.com';
    for (const c of ['J.Perez@gmail.com', 'j.p.e.r.e.z+promo@GMAIL.COM', 'jperez@googlemail.com', 'j.perez+1+2@gmail.com']) {
      expect(normalizarCorreo(c)).toBe(mismo);
    }
    // Fuera de Gmail los puntos sí cuentan.
    expect(normalizarCorreo('j.perez@outlook.com')).not.toBe(normalizarCorreo('jperez@outlook.com'));
  });
  it('lo que no parece correo queda vacío', () => {
    for (const c of ['', 'sinarroba', '@x.mx', 'a@', '+solo@gmail.com']) expect(normalizarCorreo(c)).toBe('');
  });
});

describe('banner del panel (estadoPromoTaller)', () => {
  const ahora = new Date('2026-10-29T18:00:00Z');
  const promo = (hasta, extra = {}) => ({ plan: 'premium', premiumOrigen: 'promo', premiumHasta: hasta, ...extra });

  it('promoción vigente: fecha, días y sin "por vencer" con más de 15 días', () => {
    const e = estadoPromoTaller(promo(new Date('2027-01-29T18:00:00Z')), ahora);
    expect(e).toMatchObject({ dias: 92, porVencer: false });
    const t = textosBannerPromo(e);
    expect(t.titulo).toBe('Tienes Premium gratis hasta el 29 de enero de 2027 · te quedan 92 días');
    expect(t.texto).toBe(INCLUYE_PREMIUM_TALLER);
  });

  it('con 15 días o menos cambia y explica qué pasa al vencer', () => {
    const e = estadoPromoTaller(promo(new Date('2026-11-13T18:00:00Z')), ahora);
    expect(e).toMatchObject({ dias: 15, porVencer: true });
    const t = textosBannerPromo(e);
    expect(t.titulo).toMatch(/^Tu Premium gratis vence el 13 de noviembre de 2026 · te quedan 15 días/);
    expect(t.texto).toBe(AL_VENCER_PREMIUM_TALLER);
    expect(textosBannerPromo(estadoPromoTaller(promo(new Date('2026-10-30T10:00:00Z')), ahora)).titulo).toMatch(/te queda 1 día$/);
  });

  it('nunca para un Premium sin fecha ("sin vencimiento"), vencido, del admin o Básico', () => {
    expect(estadoPromoTaller(promo(''), ahora)).toBeNull();
    expect(estadoPromoTaller(promo(null), ahora)).toBeNull();
    expect(estadoPromoTaller(promo(undefined), ahora)).toBeNull();
    expect(estadoPromoTaller(promo(new Date('2026-10-01T00:00:00Z')), ahora)).toBeNull();
    expect(estadoPromoTaller(promo(new Date('2027-01-29T00:00:00Z'), { premiumOrigen: 'admin' }), ahora)).toBeNull();
    expect(estadoPromoTaller({ premiumHasta: new Date('2027-01-29T00:00:00Z') }, ahora)).toBeNull();
    expect(estadoPromoTaller(promo(new Date('2027-01-29T00:00:00Z'), { plan: 'freemium' }), ahora)).toBeNull();
  });

  it('acepta el Timestamp de Firestore', () => {
    const ts = { toDate: () => new Date('2027-01-29T18:00:00Z') };
    expect(estadoPromoTaller(promo(ts), ahora)?.dias).toBe(92);
  });
});

describe('texto público', () => {
  it('singular y plural', () => {
    expect(textoPromoRegistro(3)).toBe('3 meses de Premium gratis al registrarte');
    expect(textoPromoRegistro(1)).toBe('1 mes de Premium gratis al registrarte');
  });
});
