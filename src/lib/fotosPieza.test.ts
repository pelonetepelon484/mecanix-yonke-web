import { describe, expect, it } from 'vitest';
import { MAX_FOTOS_PIEZA, MENSAJE_MAXIMO_FOTOS, camposFotos, fotosDeItem, reemplazarFoto } from './fotosPieza';

const f = (n: number) => ({ url: `https://img/${n}.webp`, path: `yonkes/Y1/motores/M1-${n}.webp` });

describe('leer las fotos de un motor/transmisión o pieza suelta', () => {
  it('pieza vieja con 1 sola foto: esa foto cuenta como la primera', () => {
    expect(fotosDeItem({ foto: f(1) })).toEqual([f(1)]);
  });
  it('pieza nueva con 3 fotos: foto + fotosExtra, en orden', () => {
    expect(fotosDeItem({ foto: f(1), fotosExtra: [f(2), f(3)] })).toEqual([f(1), f(2), f(3)]);
  });
  it('sin fotos, o con datos raros, no truena', () => {
    expect(fotosDeItem({})).toEqual([]);
    expect(fotosDeItem(null)).toEqual([]);
    expect(fotosDeItem({ foto: null, fotosExtra: 'x' })).toEqual([]);
    expect(fotosDeItem({ foto: { url: '' }, fotosExtra: [null, { url: 5 }, f(2)] })).toEqual([f(2)]);
  });
  it('si se borró la primera (por ejemplo desde un panel viejo), las extra suben de lugar', () => {
    expect(fotosDeItem({ fotosExtra: [f(2), f(3)] })).toEqual([f(2), f(3)]);
  });
  it('nunca regresa más de 3', () => {
    expect(MAX_FOTOS_PIEZA).toBe(3);
    expect(fotosDeItem({ foto: f(1), fotosExtra: [f(2), f(3), f(4), f(5)] })).toHaveLength(3);
  });
});

describe('cambiar una foto', () => {
  it('agrega al final, reemplaza en su lugar o quita', () => {
    expect(reemplazarFoto([f(1)], null, f(2))).toEqual([f(1), f(2)]);
    expect(reemplazarFoto([f(1), f(2), f(3)], f(2).path, f(9))).toEqual([f(1), f(9), f(3)]);
    expect(reemplazarFoto([f(1), f(2), f(3)], f(1).path, null)).toEqual([f(2), f(3)]);
    expect(reemplazarFoto([f(1)], f(1).path, null)).toEqual([]);
  });
  it('límite de 3: una cuarta foto se rechaza con un mensaje claro', () => {
    expect(() => reemplazarFoto([f(1), f(2), f(3)], null, f(4))).toThrow(MENSAJE_MAXIMO_FOTOS);
    expect(MENSAJE_MAXIMO_FOTOS).toBe('Puedes subir hasta 3 fotos.');
  });
  it('reconoce una foto vieja sin path por su url', () => {
    const vieja = { url: 'https://img/vieja.webp' };
    expect(reemplazarFoto([vieja], vieja.url, f(2))).toEqual([f(2)]);
  });
});

describe('qué se guarda en Firestore', () => {
  it('1 foto: solo `foto` (igual que antes), sin fotosExtra', () => {
    expect(camposFotos([f(1)])).toEqual({ foto: f(1), fotosExtra: null });
  });
  it('3 fotos: la primera en `foto` y las otras dos en fotosExtra', () => {
    expect(camposFotos([f(1), f(2), f(3)])).toEqual({ foto: f(1), fotosExtra: [f(2), f(3)] });
  });
  it('sin fotos: borra los dos campos', () => {
    expect(camposFotos([])).toEqual({ foto: null, fotosExtra: null });
  });
});
