import { CATALOGO_BASE } from '../catalogoBase';

const PIEZA_PALABRAS_CLAVE = [
  'faro', 'calavera', 'cofre', 'cajuela', 'defensa', 'parachoques', 'espejo', 'puerta',
  'parabrisas', 'rin', 'rines', 'llanta', 'llantas', 'tablero', 'asiento', 'asientos',
  'orquilla', 'disco', 'freno', 'frenos', 'prensa', 'amortiguador', 'amortiguadores',
  'resorte', 'resortes', 'compresor', 'alternador', 'computadora', 'fusible', 'fusibles',
  'cremallera', 'direccion', 'dirección', 'barra', 'estabilizadora', 'multiple', 'múltiple',
  'admision', 'admisión', 'escape', 'garganta', 'filtro', 'manguera', 'sensor', 'flecha',
  'motor', 'transmision', 'transmisión', 'caja', 'vidrio', 'ventana', 'salpicadera',
  'toldo', 'techo', 'volante', 'radiador', 'bomba', 'clutch', 'embrague', 'catalizador',
  'mofle', 'escobilla', 'escobillas', 'bisagra', 'manija', 'chapa', 'moldura', 'defensas',
];

const PATRONES_BASURA = [
  /^(.)\1{4,}$/, // un solo carácter repetido 5+ veces (aaaaaa)
  /^([a-z]{1,3})\1{3,}$/i, // sílaba corta repetida (asdasdasdasd)
];

const PALABRAS_BLOQUEADAS = [
  'pendejo', 'pendeja', 'estupido', 'estúpido', 'idiota', 'imbecil', 'imbécil',
  'verga', 'chinga', 'puto', 'puta', 'mierda', 'cabron', 'cabrón',
];

const DIACRITICOS_COMBINABLES = new RegExp('[\\u0300-\\u036f]', 'g');

function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICOS_COMBINABLES, '');
}

function soloEmojisOSimbolos(texto) {
  // Si no queda ninguna letra latina tras quitar emojis/símbolos/espacios, es basura.
  const sinLetras = texto.replace(/[a-zA-ZÀ-ÿ]/g, '').trim();
  return sinLetras.length === texto.trim().length && texto.trim().length > 0;
}

const MARCAS_NORMALIZADAS = Object.keys(CATALOGO_BASE).map((m) => normalizar(m));
const MODELOS_NORMALIZADOS = Object.values(CATALOGO_BASE).flat().map((m) => normalizar(m));

export function filtrarPrevio(textoOriginal) {
  const texto = (textoOriginal || '').trim();

  if (texto.length < 3) {
    return { permitido: false };
  }

  if (soloEmojisOSimbolos(texto)) {
    return { permitido: false };
  }

  const normalizado = normalizar(texto);
  const palabras = normalizado.split(/\s+/).filter(Boolean);

  if (palabras.some((p) => PALABRAS_BLOQUEADAS.includes(p))) {
    return { permitido: false };
  }

  if (PATRONES_BASURA.some((patron) => patron.test(normalizado.replace(/\s+/g, '')))) {
    return { permitido: false };
  }

  const tieneMarcaOModelo = MARCAS_NORMALIZADAS.some((m) => normalizado.includes(m))
    || MODELOS_NORMALIZADOS.some((m) => normalizado.includes(m));
  const tienePiezaClave = PIEZA_PALABRAS_CLAVE.some((p) => palabras.includes(normalizar(p)));

  if (!tieneMarcaOModelo && !tienePiezaClave) {
    return { permitido: false };
  }

  return { permitido: true };
}

export const MENSAJE_RECHAZO_CAPA0 =
  "No identifiqué qué pieza buscas, ¿puedes intentar de otra forma? Ej: 'defensa delantera para tsuru 2010'";
