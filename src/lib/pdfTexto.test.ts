import { describe, expect, it } from 'vitest';
import { protegerTextos, textoPdf } from './pdfTexto';

describe('texto seguro para el PDF', () => {
  it('respeta acentos, ñ, ¿¡, °, $ y signos comunes', () => {
    const texto = 'Señor Núñez: ¿cambió el aceite? ¡Sí! 5° · $1,500.50 – “original” • ü Ü € …';
    expect(textoPdf(texto)).toBe(texto);
  });
  it('cambia emojis y símbolos raros por "?" (un emoji = un "?")', () => {
    expect(textoPdf('Frenos 🔧 listos 🚗')).toBe('Frenos ? listos ?');
    expect(textoPdf('👍🏽 ok')).toBe('?? ok');
    expect(textoPdf('❤️ cliente')).toBe('? cliente');
    expect(textoPdf('ok ✓ ★ → ∞')).toBe('ok ? ? ? ?');
    expect(textoPdf('中文 Привет')).toBe('?? ??????');
  });
  it('acentos escritos "por partes" (e + ´) se conservan', () => {
    expect(textoPdf('é')).toBe('é');
    expect(textoPdf('ñ')).toBe('ñ');
  });
  it('tolera null, números y saltos de línea', () => {
    expect(textoPdf(null)).toBe('');
    expect(textoPdf(undefined)).toBe('');
    expect(textoPdf(1500)).toBe('1500');
    expect(textoPdf('a\r\nb\tc')).toBe('a\nb c');
  });
  it('protegerTextos limpia todo lo que se escribe en el documento', () => {
    const escrito: unknown[] = [];
    const doc = {
      text: (t: unknown, ..._resto: unknown[]) => escrito.push(t),
      splitTextToSize: (t: unknown, ..._resto: unknown[]) => [t],
    };
    protegerTextos(doc);
    doc.text('Hola 😀', 10, 10);
    doc.text(['línea 🚗', 'otra'], 10, 20);
    expect(escrito).toEqual(['Hola ?', ['línea ?', 'otra']]);
    expect(doc.splitTextToSize('Pieza 🔧', 50)).toEqual(['Pieza ?']);
  });
});
