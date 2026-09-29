import { describe, expect, it } from 'vitest';
import { esUrlDeFondoValida, sanearFondoUrl } from './fondoTenant';

const URL_OK = 'https://firebasestorage.googleapis.com/v0/b/x/o/branding%2Fy1%2Ffondo%2F123.webp?alt=media';

describe('sanearFondoUrl', () => {
  it('acepta cualquier https', () => {
    expect(sanearFondoUrl(URL_OK)).toBe(URL_OK);
  });
  it('rechaza no-string, gs:// o http', () => {
    expect(sanearFondoUrl(undefined)).toBeNull();
    expect(sanearFondoUrl(null)).toBeNull();
    expect(sanearFondoUrl('gs://bucket/x.webp')).toBeNull();
    expect(sanearFondoUrl('http://x.com/a.webp')).toBeNull();
  });
});

describe('esUrlDeFondoValida', () => {
  it('acepta una URL de descarga en la ruta branding/{yonkeId}/fondo/ de ESE yonke', () => {
    expect(esUrlDeFondoValida(URL_OK, 'y1')).toBe(true);
  });
  it('rechaza la ruta de OTRO yonke', () => {
    expect(esUrlDeFondoValida(URL_OK, 'y2')).toBe(false);
  });
  it('rechaza otro host, otra carpeta (promos/sobre-nosotros) o gs://', () => {
    expect(esUrlDeFondoValida('https://evil.com/branding%2Fy1%2Ffondo%2Fa.webp', 'y1')).toBe(false);
    expect(esUrlDeFondoValida('https://firebasestorage.googleapis.com/v0/b/x/o/branding%2Fy1%2Fpromos%2Fa.webp', 'y1')).toBe(false);
    expect(esUrlDeFondoValida(`gs://x/branding%2Fy1%2Ffondo%2Fa.webp`, 'y1')).toBe(false);
  });
  it('sin yonkeId o url no-string -> false', () => {
    expect(esUrlDeFondoValida(URL_OK, '')).toBe(false);
    expect(esUrlDeFondoValida(undefined, 'y1')).toBe(false);
  });
});
