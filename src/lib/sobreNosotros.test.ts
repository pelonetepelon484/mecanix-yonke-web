import { describe, expect, it } from 'vitest';
import {
  SOBRE_NOSOTROS_TEXTO_MAX, esUrlDeNuestroStorage, sanearSobreNosotros, validarSobreNosotrosParaGuardar,
} from './sobreNosotros';

const BUCKET = 'mecanix-yonke-virtual.firebasestorage.app';
const URL_OK = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/branding%2Fy1%2Fsobre-nosotros.webp?alt=media&token=t`;

describe('esUrlDeNuestroStorage', () => {
  it('acepta una URL real de descarga de nuestro bucket', () => {
    expect(esUrlDeNuestroStorage(URL_OK, BUCKET)).toBe(true);
  });
  it('rechaza otro bucket, otro host, http o gs://', () => {
    expect(esUrlDeNuestroStorage('https://firebasestorage.googleapis.com/v0/b/otro-bucket/o/x.webp', BUCKET)).toBe(false);
    expect(esUrlDeNuestroStorage('https://evil.com/x.webp', BUCKET)).toBe(false);
    expect(esUrlDeNuestroStorage('http://firebasestorage.googleapis.com/v0/b/' + BUCKET + '/o/x.webp', BUCKET)).toBe(false);
    expect(esUrlDeNuestroStorage(`gs://${BUCKET}/x.webp`, BUCKET)).toBe(false);
  });
  it('no-string o URL inválida -> false, sin lanzar', () => {
    expect(esUrlDeNuestroStorage(undefined, BUCKET)).toBe(false);
    expect(esUrlDeNuestroStorage('no es una url', BUCKET)).toBe(false);
  });
});

describe('sanearSobreNosotros', () => {
  it('sin texto -> null (la sección no se muestra)', () => {
    expect(sanearSobreNosotros(undefined)).toBeNull();
    expect(sanearSobreNosotros({})).toBeNull();
    expect(sanearSobreNosotros({ texto: '   ' })).toBeNull();
    expect(sanearSobreNosotros({ fotoUrl: URL_OK })).toBeNull();
  });
  it('con texto -> objeto completo, campos ausentes en null', () => {
    expect(sanearSobreNosotros({ texto: 'Somos un yonke familiar.' })).toEqual({
      texto: 'Somos un yonke familiar.', aniosExperiencia: null, direccion: null, horario: null, fotoUrl: null,
    });
  });
  it('recorta el texto a 800 y descarta fotoUrl que no sea https', () => {
    const largo = sanearSobreNosotros({ texto: 'a'.repeat(SOBRE_NOSOTROS_TEXTO_MAX + 50), fotoUrl: 'gs://bucket/x.webp' });
    expect(largo?.texto).toHaveLength(SOBRE_NOSOTROS_TEXTO_MAX);
    expect(largo?.fotoUrl).toBeNull();
  });
  it('aniosExperiencia inválido (negativo, no numérico) -> null', () => {
    expect(sanearSobreNosotros({ texto: 't', aniosExperiencia: -1 })?.aniosExperiencia).toBeNull();
    expect(sanearSobreNosotros({ texto: 't', aniosExperiencia: 'diez' })?.aniosExperiencia).toBeNull();
    expect(sanearSobreNosotros({ texto: 't', aniosExperiencia: 12 })?.aniosExperiencia).toBe(12);
  });
});

describe('validarSobreNosotrosParaGuardar', () => {
  it('acepta texto válido, con o sin campos extra', () => {
    expect(validarSobreNosotrosParaGuardar({ texto: 'Hola' }).ok).toBe(true);
    expect(validarSobreNosotrosParaGuardar({ texto: 'Hola', aniosExperiencia: 5, direccion: 'x', horario: 'y', fotoUrl: URL_OK }, BUCKET).ok).toBe(true);
  });
  it('rechaza texto vacío, muy largo, con < o >, o años negativos', () => {
    expect(validarSobreNosotrosParaGuardar({ texto: '' }).ok).toBe(false);
    expect(validarSobreNosotrosParaGuardar({ texto: 'a'.repeat(SOBRE_NOSOTROS_TEXTO_MAX + 1) }).ok).toBe(false);
    expect(validarSobreNosotrosParaGuardar({ texto: '<b>hola</b>' }).ok).toBe(false);
    expect(validarSobreNosotrosParaGuardar({ texto: 'Hola', aniosExperiencia: -3 }).ok).toBe(false);
  });
  it('rechaza fotoUrl que no sea de nuestro bucket cuando se valida contra uno', () => {
    expect(validarSobreNosotrosParaGuardar({ texto: 'Hola', fotoUrl: 'https://evil.com/x.webp' }, BUCKET).ok).toBe(false);
  });
});
