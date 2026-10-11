// Texto seguro para los PDF de jsPDF. Las fuentes estándar (helvetica) solo traen los caracteres
// de la codificación WinAnsi (Windows-1252): letras del español con acentos, ñ, ¿¡, °, $, etc.
// Cualquier otro carácter (emojis, símbolos raros, otros alfabetos) se cambia por "?" para que el
// PDF no muestre signos extraños. Un emoji cuenta como UN carácter (no deja dos "??").
const EXTRAS_WINANSI = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');

export function caracterSoportado(c: string): boolean {
  const cp = c.codePointAt(0) ?? 0;
  if (c === '\n') return true;
  if (cp >= 0x20 && cp <= 0x7e) return true;
  if (cp >= 0xa0 && cp <= 0xff) return true;
  return EXTRAS_WINANSI.has(c);
}

export function textoPdf(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  // Las letras con acento "compuestas" (e + ´) se juntan primero para no perderlas.
  const texto = String(valor).normalize('NFC').replace(/\r\n?/g, '\n').replace(/\t/g, ' ');
  let salida = '';
  for (const c of texto) {
    // Selectores de variación y unión de emojis (invisibles): se quitan sin dejar "?".
    if (/[‍︎️]/.test(c)) continue;
    salida += caracterSoportado(c) ? c : '?';
  }
  return salida;
}

// Envuelve un documento de jsPDF para que TODO lo que escriba (text y splitTextToSize) pase por
// textoPdf. Así no hay que acordarse en cada línea del PDF.
type DocPdf = { text: (...a: unknown[]) => unknown; splitTextToSize: (...a: unknown[]) => unknown };
export function protegerTextos<T extends DocPdf>(doc: T): T {
  const limpiar = (t: unknown) => (Array.isArray(t) ? t.map(textoPdf) : textoPdf(t));
  const text = doc.text.bind(doc);
  const split = doc.splitTextToSize.bind(doc);
  doc.text = (t: unknown, ...resto: unknown[]) => text(limpiar(t), ...resto);
  doc.splitTextToSize = (t: unknown, ...resto: unknown[]) => split(textoPdf(t), ...resto);
  return doc;
}
