// Fuzzy matching compartido por el parser de intención (extraerIntencion.js, para marca/modelo/
// pieza) y el motor de sinónimos (sinonimosPiezas.js) — una sola definición de "qué tan parecido
// es lo bastante parecido", para que los dos nunca se desincronicen.

// Distancia de Levenshtein clásica (edición mínima entre dos strings).
export function distanciaLevenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const fila = new Array(n + 1);
  for (let j = 0; j <= n; j++) fila[j] = j;
  for (let i = 1; i <= m; i++) {
    let anterior = fila[0];
    fila[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = fila[j];
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, anterior + costo);
      anterior = temp;
    }
  }
  return fila[n];
}

// Umbral conservador y proporcional: palabras cortas/medianas toleran menos error para
// evitar confundir marcas/modelos distintos que casualmente se parecen (ej. "hola" no debe
// hacer match con "honda" — distancia real 2 — ni "carro" con "camaro" — también distancia 2).
export function umbralMaximo(longitud) {
  if (longitud <= 6) return 1;
  if (longitud <= 9) return 2;
  return 3;
}

export const MIN_LARGO_PARA_DIFUSO = 4;

// Palabras genéricas/comunes del dominio que NUNCA deben tratarse como posible typo de
// marca/modelo/pieza, por más cerca que caigan en distancia — el umbral numérico solo no basta
// (ej. "carro"~"camaro" y "hola"~"honda" caen dentro de distancias razonables).
export const PALABRAS_EXCLUIDAS_DIFUSO = new Set([
  'carro', 'carros', 'coche', 'coches', 'auto', 'autos', 'vehiculo', 'vehiculos',
  'pieza', 'piezas', 'parte', 'partes', 'necesito', 'busco', 'quiero', 'tengo',
  'hola', 'gracias', 'favor', 'ayuda', 'urgente', 'rapido', 'bueno', 'buena',
  'para', 'como', 'estas', 'esta', 'este', 'usado', 'usados', 'comprar', 'vender',
]);
