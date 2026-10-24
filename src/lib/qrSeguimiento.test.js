import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import { MARGEN_QR, matrizQr, tramosQr } from './qrSeguimiento';
import { enlaceSeguimiento, generarTokenSeguimiento } from './seguimiento';

// Pinta la matriz (con su margen blanco) en un RGBA de `px` píxeles por cuadrito, para leerla con jsQR.
function aImagen(matriz, px = 4) {
  const lado = (matriz.tamano + 2 * MARGEN_QR) * px;
  const datos = new Uint8ClampedArray(lado * lado * 4).fill(255);
  for (let f = 0; f < matriz.tamano; f++) {
    for (let c = 0; c < matriz.tamano; c++) {
      if (!matriz.oscuro(f, c)) continue;
      for (let y = 0; y < px; y++) {
        for (let x = 0; x < px; x++) {
          const i = (((f + MARGEN_QR) * px + y) * lado + (c + MARGEN_QR) * px + x) * 4;
          datos[i] = 0; datos[i + 1] = 0; datos[i + 2] = 0;
        }
      }
    }
  }
  return { datos, lado };
}

describe('QR de la liga de seguimiento', () => {
  const liga = enlaceSeguimiento(generarTokenSeguimiento());

  it('la liga siempre es la de www (unos 87 caracteres) y sale en la versión 6 con corrección M (41 × 41)', () => {
    expect(liga.startsWith('https://www.mecanixyonkevirtual.com/seguimiento/')).toBe(true);
    expect(liga).toHaveLength(91);
    const m = matrizQr(liga);
    expect(m.version).toBe(6);
    expect(m.tamano).toBe(41);
    expect(MARGEN_QR).toBe(4);
  });

  it('el código se lee y da EXACTAMENTE la liga', () => {
    const m = matrizQr(liga);
    const { datos, lado } = aImagen(m);
    expect(jsQR(datos, lado, lado)?.data).toBe(liga);
  });

  it('los tramos cubren exactamente los cuadritos oscuros (y son muchos menos rectángulos)', () => {
    const m = matrizQr(liga);
    const tramos = tramosQr(m);
    const pintados = new Set();
    for (const t of tramos) for (let c = t.columna; c < t.columna + t.largo; c++) pintados.add(`${t.fila},${c}`);
    let oscuros = 0;
    for (let f = 0; f < m.tamano; f++) {
      for (let c = 0; c < m.tamano; c++) {
        if (m.oscuro(f, c)) oscuros += 1;
        expect(pintados.has(`${f},${c}`)).toBe(m.oscuro(f, c));
      }
    }
    expect(tramos.length).toBeLessThan(oscuros);
  });
});
