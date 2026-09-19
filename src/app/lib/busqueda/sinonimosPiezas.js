// Vocabulario y sinónimos de piezas del buscador inteligente — ÚNICA fuente de vocabulario para
// las dos capas del parser (Capa 0 en filtroPrevio.js y Capa 1 en extraerIntencion.js), para que
// nunca se desincronicen (antes Capa 0 tenía su propia lista aparte).
//
// CÓMO AGREGAR TÉRMINOS (ej. tras revisar el log de búsquedas no_interpretadas):
//   • Sin tocar código: crear/editar el doc de Firestore  config/sinonimosPiezas  con
//       { entradas: [ { termino: 'header plate', pieza: 'Soporte de radiador' }, ... ] }
//     Se fusiona con FRASES_PIEZAS_BASE (Firestore gana si repite un término) y se refresca solo
//     cada 10 min (mismo patrón que config/palabrasFueraDeGiro y config/catalogoVehiculos).
//   • Con código: agregar una fila a FRASES_PIEZAS_BASE ([termino, pieza]) y listo.
//   `termino` puede ser una palabra o una frase, en español o inglés, con o sin acentos.
//   `pieza` es el nombre CANÓNICO de la pieza. Si coincide con una de PIEZAS_CATALOGO, la
//   búsqueda usa el catálogo normal (incluye lado delantero/trasero/izquierdo/derecho si el
//   cliente lo dice). Si NO está en el catálogo, la búsqueda la reconoce igual y responde "sin
//   inventario" cuando nadie la tiene registrada (ver extraerIntencion.js) — así se puede medir
//   demanda antes de decidir si vale la pena agregarla al catálogo.
//   Los typos de un término (ej. "facia trasra", "spindel", "heder plate") se toleran solos con el
//   mismo fuzzy (fuzzy.js) que usa el resto del parser — no hace falta listar variantes de typos.

import { doc, getDoc } from 'firebase/firestore';
import { dbServer } from '../firebase-server';
import { CATALOGO_BASE } from '../catalogoBase';
import { PIEZAS_CATALOGO } from '../piezasCatalogo';
import { distanciaLevenshtein, umbralMaximo, MIN_LARGO_PARA_DIFUSO, PALABRAS_EXCLUIDAS_DIFUSO } from './fuzzy';

const DIACRITICOS_COMBINABLES = new RegExp('[\\u0300-\\u036f]', 'g');

export function normalizar(texto) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICOS_COMBINABLES, '');
}

// Se parte también por "/" (ej. "Compresor A/C", "Mango/muñón de dirección") para que los nombres
// del catálogo y lo que escribe el cliente se comparen palabra por palabra igual.
export function tokenizar(textoNormalizado) {
  return textoNormalizado.split(/[\s/]+/).filter(Boolean);
}

function limpiarBorde(token) {
  return token.replace(/^[^a-z0-9]+/, '').replace(/[^a-z0-9]+$/, '');
}

// Palabra -> palabra ya normalizada (sin acentos, minúsculas). Se aplica token por token DENTRO
// de extraerPieza (ver ahí). Antes vivía en extraerIntencion.js; se movió aquí para que todo el
// vocabulario esté en un solo archivo. Incluye los modificadores en inglés más comunes.
export const SINONIMOS_PALABRA = {
  'defensa': 'parachoques', 'defensas': 'parachoques',
  'maletero': 'cajuela', 'cajuelas': 'cajuela',
  'capo': 'cofre',
  'espejos': 'espejo', 'puertas': 'puerta', 'faros': 'faro', 'calaveras': 'calavera',
  'amortiguadores': 'amortiguador', 'resorte': 'resortes',
  'rin': 'rines', 'llanta': 'rines', 'llantas': 'rines',
  'pistones': 'piston',
  'transmision': 'transmision', 'caja': 'transmision', 'clutch': 'transmision', 'embrague': 'transmision',
  'izquierda': 'izquierdo', 'derecha': 'derecho',
  'delantera': 'delantero', 'adelante': 'delantero', 'frontal': 'delantero',
  'trasera': 'trasero', 'atras': 'trasero',
  // Inglés (lado / posición)
  'front': 'delantero', 'rear': 'trasero', 'left': 'izquierdo', 'right': 'derecho',
};

const LADOS = new Set(['delantero', 'trasero', 'izquierdo', 'derecho']);

// Palabras de pieza que NO están (todavía) en PIEZAS_CATALOGO pero sí indican que el texto habla
// de autopartes — antes era la lista PIEZA_PALABRAS_CLAVE de filtroPrevio.js. Solo alimenta Capa 0
// (que la búsqueda de una de estas se reconozca como pieza es asunto de FRASES_PIEZAS_BASE).
const PALABRAS_PIEZA_EXTRA = [
  'faro', 'calavera', 'cofre', 'cajuela', 'defensa', 'parachoques', 'espejo', 'puerta',
  'parabrisas', 'rin', 'rines', 'llanta', 'llantas', 'tablero', 'asiento', 'asientos',
  'orquilla', 'disco', 'freno', 'frenos', 'prensa', 'amortiguador', 'amortiguadores',
  'resorte', 'resortes', 'compresor', 'alternador', 'computadora', 'fusible', 'fusibles',
  'cremallera', 'direccion', 'barra', 'estabilizadora', 'multiple',
  'admision', 'escape', 'garganta', 'filtro', 'manguera', 'sensor', 'flecha',
  'motor', 'transmision', 'caja', 'vidrio', 'ventana', 'salpicadera',
  'toldo', 'techo', 'volante', 'radiador', 'bomba', 'clutch', 'embrague', 'catalizador',
  'mofle', 'escobilla', 'escobillas', 'bisagra', 'manija', 'chapa', 'moldura', 'defensas',
  'piston', 'pistones',
];

// [término, pieza canónica]. Ver el encabezado del archivo para cómo extenderlo.
export const FRASES_PIEZAS_BASE = [
  // Facia / fascia = cubierta plástica del parachoques. El catálogo NO separa cubierta de refuerzo
  // (solo existe "Parachoques delantero/trasero"), así que se mapea a Parachoques: si el cliente
  // dice delantera/trasera/front/rear se respeta; si no dice lado, la búsqueda cubre ambos.
  ['facia', 'Parachoques'], ['facias', 'Parachoques'], ['fascia', 'Parachoques'], ['fascias', 'Parachoques'],
  ['fasia', 'Parachoques'], ['fasias', 'Parachoques'], ['facea', 'Parachoques'],
  ['facia plastica', 'Parachoques'], ['fascia plastica', 'Parachoques'],
  ['cubierta de parachoques', 'Parachoques'], ['cubierta parachoques', 'Parachoques'],
  ['bumper cover', 'Parachoques'], ['bumper', 'Parachoques'],

  // Header plate = soporte/cuna de radiador (panel donde se monta el radiador y el condensador
  // de A/C). NO es el panel frontal genérico de carrocería. Pieza fuera del catálogo a propósito:
  // se reconoce y responde "sin inventario" hasta que el log muestre demanda repetida.
  ['header plate', 'Soporte de radiador'], ['header panel', 'Soporte de radiador'],
  ['core support', 'Soporte de radiador'], ['radiator support', 'Soporte de radiador'],
  ['soporte de radiador', 'Soporte de radiador'], ['soporte radiador', 'Soporte de radiador'],
  ['cuna de radiador', 'Soporte de radiador'], ['cuna radiador', 'Soporte de radiador'],

  // Spindle / mango / muñón = mangueta de dirección (misma pieza).
  ['spindle', 'Mango/muñón de dirección'], ['mango', 'Mango/muñón de dirección'],
  ['mangos', 'Mango/muñón de dirección'], ['muñon', 'Mango/muñón de dirección'],
  ['muñones', 'Mango/muñón de dirección'], ['mango de direccion', 'Mango/muñón de dirección'],
  // "mango de puerta" es la manija, no la mangueta: conserva el comportamiento de antes (Puerta).
  ['mango de puerta', 'Puerta'], ['mango puerta', 'Puerta'],

  // Calavera / faro en inglés
  ['tail light', 'Calavera'], ['tail lights', 'Calavera'], ['taillight', 'Calavera'],
  ['taillights', 'Calavera'], ['tail lamp', 'Calavera'], ['taillamp', 'Calavera'],
  ['headlight', 'Faro'], ['headlights', 'Faro'], ['head light', 'Faro'], ['headlamp', 'Faro'],

  // Otros términos comunes en inglés hacia piezas que ya existen en el catálogo
  ['hood', 'Cofre'], ['trunk', 'Cajuela'], ['windshield', 'Parabrisas'], ['mirror', 'Espejo'],
  ['alternator', 'Alternador'], ['starter', 'Arranque'], ['transmission', 'Transmisión'],
  ['engine', 'Motor'], ['dashboard', 'Tablero'], ['control arm', 'Orquilla'],
  ['rack and pinion', 'Cremallera'], ['shock', 'Amortiguador'], ['strut', 'Amortiguador'],
  ['ac compressor', 'Compresor A/C'], ['a/c compressor', 'Compresor A/C'],
  ['cv axle', 'Flecha'], ['axle shaft', 'Flecha'],
];

// ---------- Índice (base + Firestore) ----------

export function construirIndice(pares) {
  const porClave = new Map();
  for (const [termino, pieza] of pares) {
    if (typeof termino !== 'string' || typeof pieza !== 'string') continue;
    const tokens = tokenizar(normalizar(termino)).map(limpiarBorde).filter(Boolean);
    const valorTexto = tokenizar(normalizar(pieza)).join(' ');
    if (tokens.length === 0 || !valorTexto) continue;
    porClave.set(tokens.join(' '), { tokens, valor: pieza.trim(), valorTexto });
  }
  // Más largas primero: "mango de puerta" debe ganarle a "mango".
  return [...porClave.values()].sort((a, b) => b.tokens.length - a.tokens.length);
}

const INDICE_BASE = construirIndice(FRASES_PIEZAS_BASE);

const TTL_MS = 10 * 60 * 1000;
let cache = null;
let cacheEn = 0;

// Devuelve el índice combinado (base + config/sinonimosPiezas). Fail-open: si Firestore falla o el
// doc no existe, se usa solo la base — nunca debe tumbar ni retrasar una búsqueda por esto.
export async function obtenerSinonimosCombinados() {
  const ahora = Date.now();
  if (cache && (ahora - cacheEn) < TTL_MS) return cache;
  let extra = [];
  try {
    const snap = await getDoc(doc(dbServer, 'config', 'sinonimosPiezas'));
    if (snap.exists() && Array.isArray(snap.data().entradas)) {
      extra = snap.data().entradas
        .filter((e) => e && typeof e.termino === 'string' && typeof e.pieza === 'string')
        .map((e) => [e.termino, e.pieza]);
    }
  } catch (error) {
    console.error('[sinonimosPiezas] No se pudo leer config/sinonimosPiezas, usando solo la base', {
      code: error?.code, message: error?.message,
    });
  }
  cache = construirIndice([...FRASES_PIEZAS_BASE, ...extra]);
  cacheEn = ahora;
  return cache;
}

// ---------- Palabras que el fuzzy nunca debe "corregir" ----------

let protegidasCache = null;
function palabrasProtegidas() {
  if (protegidasCache) return protegidasCache;
  const set = new Set();
  PIEZAS_CATALOGO.forEach((p) => tokenizar(normalizar(p)).forEach((t) => set.add(t)));
  PALABRAS_PIEZA_EXTRA.forEach((p) => set.add(normalizar(p)));
  Object.keys(SINONIMOS_PALABRA).forEach((p) => set.add(p));
  PALABRAS_EXCLUIDAS_DIFUSO.forEach((p) => set.add(p));
  // Palabras comunes que caen a distancia 1 de un término en inglés de la base (ej. "truck" vs
  // "trunk") y que nunca deben corregirse hacia él. Agregar aquí si el log muestra otro choque.
  ['truck', 'trucks', 'trunks'].forEach((p) => set.add(p));
  // Marcas y modelos conocidos: "mazda" o "fiat" jamás deben leerse como typo de una pieza.
  Object.keys(CATALOGO_BASE).forEach((marca) => {
    tokenizar(normalizar(marca)).forEach((t) => set.add(t));
    CATALOGO_BASE[marca].forEach((modelo) => tokenizar(normalizar(modelo)).forEach((t) => set.add(t)));
  });
  protegidasCache = set;
  return set;
}

function coincideExacto(entrada, tokensLimpios, i) {
  return entrada.tokens.every((t, k) => tokensLimpios[i + k] === t);
}

// Fuzzy: cada palabra de la frase puede diferir por typo (mismo umbral proporcional del resto del
// parser). Reglas anti-falsos positivos: palabras de la llave de < 4 letras solo exactas; una llave
// de UNA sola palabra exige >= 7 letras (con 5-6 letras chocaba con español común: "facia" vs
// "fácil"/"hacia", "mango" vs "tango" — para esas llaves cortas se listan las variantes
// fonéticas a mano en FRASES_PIEZAS_BASE, ej. "fasia"); jamás se "corrige" una palabra protegida
// (pieza/marca/modelo ya válidos) ni números.
const MIN_LARGO_LLAVE_DIFUSA_UNA_PALABRA = 7;
function coincideDifuso(entrada, tokensLimpios, i, protegidas) {
  if (entrada.tokens.length === 1 && entrada.tokens[0].length < MIN_LARGO_LLAVE_DIFUSA_UNA_PALABRA) return false;
  return entrada.tokens.every((clave, k) => {
    const t = tokensLimpios[i + k];
    if (t === clave) return true;
    if (clave.length < MIN_LARGO_PARA_DIFUSO || t.length < MIN_LARGO_PARA_DIFUSO) return false;
    if (/\d/.test(t) || protegidas.has(t)) return false;
    return distanciaLevenshtein(t, clave) <= umbralMaximo(clave.length);
  });
}

// Reemplaza en el texto las frases/palabras reconocidas por el nombre canónico de su pieza (en el
// mismo formato normalizado que ya entiende extraerPieza). Devuelve también la lista de piezas
// canónicas reconocidas, en orden de aparición, para el caso de piezas que no están en el
// catálogo. Solo reemplaza tramos completos de palabras (nunca subcadenas dentro de una palabra).
export function aplicarSinonimosFrases(textoNormalizado, indice = INDICE_BASE) {
  const tokens = tokenizar(textoNormalizado);
  const limpios = tokens.map(limpiarBorde);
  const protegidas = palabrasProtegidas();
  const salida = [];
  const piezas = [];
  let i = 0;
  while (i < tokens.length) {
    let hit = indice.find((e) => i + e.tokens.length <= tokens.length && coincideExacto(e, limpios, i));
    if (!hit) hit = indice.find((e) => i + e.tokens.length <= tokens.length && coincideDifuso(e, limpios, i, protegidas));
    if (hit) {
      salida.push(hit.valorTexto);
      if (!piezas.includes(hit.valor)) piezas.push(hit.valor);
      i += hit.tokens.length;
    } else {
      salida.push(tokens[i]);
      i += 1;
    }
  }
  return { texto: salida.join(' '), piezas };
}

// ---------- Capa 0 ----------

let vocabularioCapa0Cache = null;
// Palabras (ya normalizadas) que por sí solas indican "esto habla de una pieza". Derivado del
// catálogo + sinónimos + extras, sin los calificadores de lado (delantero, izquierdo...) ni
// palabras de menos de 4 letras (salvo las ya listadas a mano), que dejarían pasar casi cualquier
// texto. Las frases y typos de FRASES_PIEZAS se cubren aparte con aplicarSinonimosFrases.
export function vocabularioCapa0() {
  if (vocabularioCapa0Cache) return vocabularioCapa0Cache;
  const set = new Set(PALABRAS_PIEZA_EXTRA.map(normalizar));
  PIEZAS_CATALOGO.forEach((p) => tokenizar(normalizar(p)).forEach((t) => {
    if (t.length >= 4 && !LADOS.has(t) && t !== 'para') set.add(t);
  }));
  Object.entries(SINONIMOS_PALABRA).forEach(([k, v]) => { if (!LADOS.has(v)) set.add(k); });
  vocabularioCapa0Cache = set;
  return set;
}
