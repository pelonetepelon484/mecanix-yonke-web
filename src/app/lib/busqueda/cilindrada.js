// Cilindrada de motores/transmisiones: en Firestore es texto libre sin formato forzado
// ("3.6", "V6 3.5", "3.3L v6", "4 cil 2.4", "1.8 o 2.0", "4 cil" sin número, null...). Este
// archivo concentra la extracción/comparación de esos números decimales para que la búsqueda
// (texto del cliente) y el inventario (campo crudo) se normalicen con la MISMA lógica.

// Exige punto decimal (1 dígito, punto, 1-2 dígitos), con o sin sufijo "l"/"litro(s)" pegado o
// con espacio ("3.6L", "3.6 litros"). Al exigir el punto, nunca choca con el regex de año
// (4 dígitos SIN punto, ver extraerAnio en extraerIntencion.js) — "2015" no matchea esto y
// "3.6" no matchea el regex de año.
const REGEX_CILINDRADA_TEXTO = /\b(\d)\.(\d{1,2})\s*(?:l|litros?)?\b/;

// Rango de cilindradas reales de motor (0.5L motos/kei-cars pequeños hasta ~9L motores grandes
// de camión) — descarta decimales sueltos que no tengan sentido como cilindrada.
const CILINDRADA_MIN = 0.5;
const CILINDRADA_MAX = 9.9;

// textoNormalizado: ya en minúsculas y sin acentos (mismo formato que usa extraerIntencion.js
// para el resto de los extractores). Devuelve un número (ej. 3.6) o null si no hay match válido.
export function extraerCilindradaDeTexto(textoNormalizado) {
  const match = textoNormalizado.match(REGEX_CILINDRADA_TEXTO);
  if (!match) return null;
  const valor = parseFloat(`${match[1]}.${match[2]}`);
  return valor >= CILINDRADA_MIN && valor <= CILINDRADA_MAX ? valor : null;
}

// Extrae TODOS los números decimales del valor crudo del inventario, sin importar qué texto
// los rodee — así "V6 3.6", "3.3L v6", "4 cil 2.4" y "1.8 o 2.0" (rango con "o") se leen igual,
// con un solo regex, sin tener que enumerar cada prefijo/sufijo posible.
const REGEX_DECIMALES_GLOBAL = /\d\.\d{1,2}/g;

function redondear(valor) {
  return Math.round(valor * 10) / 10;
}

function numerosEnValorCrudo(valorCrudo) {
  if (typeof valorCrudo !== 'string') return [];
  const matches = valorCrudo.match(REGEX_DECIMALES_GLOBAL);
  if (!matches) return [];
  return matches.map((m) => redondear(parseFloat(m)));
}

// true si alguno de los números encontrados en el valor crudo del inventario coincide con la
// cilindrada buscada. Límite conocido y aceptado: valores sin punto decimal (ej. "4 cil 2400",
// cc en vez de litros) no producen ningún número y por lo tanto nunca hacen match — caso raro
// (1 de 170 registros reales al momento del diagnóstico), no se resuelve aquí a propósito.
export function cilindradaCoincide(valorInventarioCrudo, cilindradaBuscada) {
  const objetivo = redondear(cilindradaBuscada);
  return numerosEnValorCrudo(valorInventarioCrudo).includes(objetivo);
}
