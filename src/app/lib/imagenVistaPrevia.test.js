import { describe, expect, it } from 'vitest';
import { copyFile, mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FRASE_GENERICA, imagenDeYonke, imagenGenerica } from './imagenVistaPrevia';
import { leerRecursosImagen } from './vistaPreviaTenant';

// Ancho y alto del PNG (encabezado IHDR).
async function medidasPng(respuesta) {
  const b = Buffer.from(await respuesta.arrayBuffer());
  expect(b.subarray(1, 4).toString()).toBe('PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe('imagen de vista previa (PNG 1200 × 630, caché de 1 día)', () => {
  it('yonke sin logo y genérica de Mecanix, con Inter', async () => {
    const logos = await leerRecursosImagen();
    expect(logos.fuentes.map((f) => [f.name, f.weight])).toEqual([['Inter', 400], ['Inter', 600]]);
    expect(logos.solo).toMatch(/^data:image\/png;base64,/);
    const r = imagenDeYonke({ nombre: 'Deshuesadero Norte', lugar: '', colorPrimario: '#FFD54F', logo: null }, logos);
    expect(r.headers.get('content-type')).toBe('image/png');
    expect(r.headers.get('cache-control')).toBe('public, max-age=86400, s-maxage=86400');
    expect(await medidasPng(r)).toEqual([1200, 630]);
    expect(logos.nuevo).toMatch(/^data:image\/png;base64,/);
    expect(await medidasPng(imagenGenerica(logos))).toEqual([1200, 630]);
    expect(FRASE_GENERICA).toBe('Refacciones y autopartes usadas en México');
  }, 30000);

  it('se genera SIN ningún logo viejo en el disco: solo logo-mecanix-solo, logo-mecanix-red-yonkes e Inter', async () => {
    const raiz = await mkdtemp(path.join(tmpdir(), 'vista-previa-'));
    await mkdir(path.join(raiz, 'public'));
    await mkdir(path.join(raiz, 'src', 'assets', 'fuentes'), { recursive: true });
    const real = process.cwd();
    for (const f of ['logo-mecanix-solo.png', 'logo-mecanix-red-yonkes.png']) await copyFile(path.join(real, 'public', f), path.join(raiz, 'public', f));
    for (const f of ['inter-regular.ttf', 'inter-semibold.ttf']) await copyFile(path.join(real, 'src', 'assets', 'fuentes', f), path.join(raiz, 'src', 'assets', 'fuentes', f));
    const logos = await leerRecursosImagen(raiz);
    expect(Object.keys(logos).sort()).toEqual(['fuentes', 'nuevo', 'solo']);
    expect(await medidasPng(imagenGenerica(logos))).toEqual([1200, 630]);
    expect(await medidasPng(imagenDeYonke({ nombre: 'Yonke Norte', lugar: 'Tijuana', colorPrimario: '#1A3C5E', logo: null }, logos))).toEqual([1200, 630]);
  }, 30000);
});
