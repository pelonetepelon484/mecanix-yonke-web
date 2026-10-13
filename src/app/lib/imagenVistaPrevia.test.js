import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { imagenDeYonke, imagenGenerica } from './imagenVistaPrevia';

const dataUri = (archivo) => `data:image/png;base64,${readFileSync(path.join(process.cwd(), 'public', archivo)).toString('base64')}`;
const logos = { solo: dataUri('logo-mecanix-solo.png'), blanco: dataUri('logo-mecanix-blanco.png') };

// Ancho y alto del PNG (encabezado IHDR).
async function medidasPng(respuesta) {
  const b = Buffer.from(await respuesta.arrayBuffer());
  expect(b.subarray(1, 4).toString()).toBe('PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe('imagen de vista previa (PNG 1200 × 630, caché de 1 día)', () => {
  it('yonke sin logo y genérica de Mecanix', async () => {
    const r = imagenDeYonke({ nombre: 'Deshuesadero Norte', lugar: '', colorPrimario: '#FFD54F', logo: null }, logos);
    expect(r.headers.get('content-type')).toBe('image/png');
    expect(r.headers.get('cache-control')).toBe('public, max-age=86400, s-maxage=86400');
    expect(await medidasPng(r)).toEqual([1200, 630]);
    expect(await medidasPng(imagenGenerica(logos))).toEqual([1200, 630]);
  }, 30000);
});
