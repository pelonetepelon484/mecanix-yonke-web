import { describe, expect, it, vi } from 'vitest';
import { copyFile, mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// El layout y las páginas de /yonkes importan cosas de Next y de Firestore que no hacen falta para
// leer sus metadatos.
vi.mock('next/font/google', () => ({ Geist: () => ({ variable: 'g' }), Geist_Mono: () => ({ variable: 'gm' }) }));
vi.mock('next/script', () => ({ default: () => null }));
vi.mock('../lib/yonkesServerData', () => ({ getConteoYonkesPorCiudad: vi.fn(), getYonkesPorCiudad: vi.fn(), getCiudadesConYonkesActivos: vi.fn(async () => []) }));

const { FRASE_PORTADA, imagenPortada, leerRecursosPortada, lineasFrase } = await import('./imagenPortada');
const ruta = await import('../og/mecanix-portada.png/route.js');
const { IMAGEN_PORTADA } = await import('../../lib/imagenPortada');

async function pngDe(respuesta) {
  const b = Buffer.from(await respuesta.arrayBuffer());
  expect(b.subarray(1, 4).toString()).toBe('PNG');
  return { ancho: b.readUInt32BE(16), alto: b.readUInt32BE(20), bytes: b.length };
}

describe('imagen de vista previa de la portada (logo nuevo, 1200 × 630)', () => {
  it('GET /og/mecanix-portada.png: 200, PNG de 1200 × 630, menos de 300 KB y estática (se genera al compilar)', async () => {
    expect(ruta.dynamic).toBe('force-static');
    const r = await ruta.GET();
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('image/png');
    const png = await pngDe(r);
    expect([png.ancho, png.alto]).toEqual([1200, 630]);
    expect(png.bytes).toBeLessThan(300 * 1024);
  }, 30000);

  it('la frase debajo del logo', () => {
    expect(FRASE_PORTADA).toBe('Encuentra la refacción que necesitas, directo con el yonke que la tiene');
    // En dos líneas, partida después de la coma, sin perder ningún carácter.
    expect(lineasFrase(FRASE_PORTADA)).toEqual(['Encuentra la refacción que necesitas,', 'directo con el yonke que la tiene']);
    expect(lineasFrase(FRASE_PORTADA).join(' ')).toBe(FRASE_PORTADA);
    expect(lineasFrase('Sin coma')).toEqual(['Sin coma']);
  });

  it('solo necesita el logo nuevo y la tipografía Inter (nada de los logos viejos)', async () => {
    const raiz = await mkdtemp(path.join(tmpdir(), 'portada-'));
    await mkdir(path.join(raiz, 'public'));
    await mkdir(path.join(raiz, 'src', 'assets', 'fuentes'), { recursive: true });
    const real = process.cwd();
    await copyFile(path.join(real, 'public', 'logo-mecanix-red-yonkes.png'), path.join(raiz, 'public', 'logo-mecanix-red-yonkes.png'));
    for (const f of ['inter-regular.ttf', 'inter-semibold.ttf']) {
      await copyFile(path.join(real, 'src', 'assets', 'fuentes', f), path.join(raiz, 'src', 'assets', 'fuentes', f));
    }
    const recursos = await leerRecursosPortada(raiz);
    expect(recursos.logo).toMatch(/^data:image\/png;base64,/);
    expect(recursos.fuentes.map((f) => [f.name, f.weight])).toEqual([['Inter', 400], ['Inter', 600]]);
    const png = await pngDe(imagenPortada(recursos));
    expect([png.ancho, png.alto]).toEqual([1200, 630]);
  }, 30000);

  it('metadatos: la portada, /yonkes y /yonkes/[ciudad] apuntan a la imagen nueva con 1200 × 630 (nunca al logo viejo)', async () => {
    expect(IMAGEN_PORTADA).toMatchObject({ url: '/og/mecanix-portada.png', width: 1200, height: 630, type: 'image/png' });
    const { metadata: layout } = await import('../layout.js');
    const { metadata: yonkes } = await import('../yonkes/page.js');
    const { generateMetadata } = await import('../yonkes/[ciudad]/page.js');
    const ciudad = await generateMetadata({ params: Promise.resolve({ ciudad: 'tijuana' }) });
    for (const m of [layout, yonkes, ciudad]) {
      expect(m.openGraph.images[0]).toMatchObject({ url: '/og/mecanix-portada.png', width: 1200, height: 630, type: 'image/png' });
      expect(m.twitter.images[0]).toMatchObject({ url: '/og/mecanix-portada.png' });
      expect(m.twitter.card).toBe('summary_large_image');
      expect(JSON.stringify(m)).not.toContain('mecanix-logo');
    }
  }, 30000);
});
