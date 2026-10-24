import { describe, expect, it, vi } from 'vitest';

// Ficha pública de un yonke: imagen de vista previa con y sin logo.
let yonke = null;
vi.mock('../../../lib/yonkesServerData', () => ({ getYonkeById: vi.fn(async () => yonke) }));
vi.mock('../../../lib/busqueda/estadosServer', () => ({ obtenerEstadosCombinado: vi.fn(async () => [{ id: 'baja-california', nombre: 'Baja California' }]) }));

const { generateMetadata } = await import('./page.js');
const params = (id) => ({ params: Promise.resolve({ ciudad: 'tijuana', yonkeId: id }) });

describe('vista previa de la ficha de un yonke', () => {
  it('sin logo: la imagen de la portada con el logo nuevo (1200 × 630), nunca el logo viejo', async () => {
    yonke = { nombre: 'Yonke Norte', estado: 'baja-california' };
    const m = await generateMetadata(params('Y1'));
    expect(m.openGraph.images).toEqual([{ url: '/og/mecanix-portada.png', width: 1200, height: 630, type: 'image/png', alt: 'Yonke Norte' }]);
    expect(m.twitter.images).toEqual(m.openGraph.images);
    expect(JSON.stringify(m)).not.toContain('mecanix-logo');
  });
  it('con logo: su logo, sin medidas inventadas', async () => {
    yonke = { nombre: 'Yonke Sur', estado: 'baja-california', logoUrl: 'https://firebasestorage.googleapis.com/logo.png' };
    const m = await generateMetadata(params('Y2'));
    expect(m.openGraph.images).toEqual([{ url: 'https://firebasestorage.googleapis.com/logo.png', alt: 'Yonke Sur' }]);
    expect(m.twitter.images).toEqual(m.openGraph.images);
  });
});
