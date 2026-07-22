import { CATALOGO_BASE } from '../catalogoBase';

// Alias comunes de marcas — mismo espíritu que el mapa MARCAS de admin/page.js (migrarInventario).
const ALIAS_MARCA = {
  'vw': 'Volkswagen', 'volkswagen': 'Volkswagen', 'chevy': 'Chevrolet', 'chevrolet': 'Chevrolet',
  'nissan': 'Nissan', 'toyota': 'Toyota', 'ford': 'Ford', 'honda': 'Honda', 'dodge': 'Dodge',
  'chrysler': 'Chrysler', 'jeep': 'Jeep', 'gmc': 'GMC', 'hyundai': 'Hyundai', 'kia': 'Kia',
  'mazda': 'Mazda', 'mitsubishi': 'Mitsubishi', 'buick': 'Buick', 'pontiac': 'Pontiac',
  'oldsmobile': 'Oldsmobile', 'saturn': 'Saturn', 'cadillac': 'Cadillac', 'lincoln': 'Lincoln',
  'mercury': 'Mercury', 'subaru': 'Subaru', 'suzuki': 'Suzuki', 'bmw': 'BMW',
  'mercedes': 'Mercedes-Benz', 'mercedes-benz': 'Mercedes-Benz', 'benz': 'Mercedes-Benz',
  'audi': 'Audi', 'acura': 'Acura', 'infiniti': 'Infiniti', 'lexus': 'Lexus', 'volvo': 'Volvo',
  'renault': 'Renault', 'peugeot': 'Peugeot', 'seat': 'SEAT', 'fiat': 'Fiat', 'ram': 'RAM',
  'isuzu': 'Isuzu', 'hummer': 'Hummer', 'scion': 'Scion', 'geo': 'Geo',
  'land rover': 'Land Rover', 'landrover': 'Land Rover', 'mini': 'Mini', 'smart': 'Smart',
};

const PIEZAS_CATALOGO = [
  'Faro delantero izquierdo', 'Faro delantero derecho', 'Calavera trasera izquierda', 'Calavera trasera derecha',
  'Cofre', 'Cajuela', 'Parachoques delantero', 'Parachoques trasero', 'Espejo izquierdo', 'Espejo derecho',
  'Puerta delantera izquierda', 'Puerta delantera derecha', 'Puerta trasera izquierda', 'Puerta trasera derecha',
  'Parabrisas', 'Rines', 'Tablero', 'Asientos', 'Orquilla derecha', 'Orquilla izquierda',
  'Disco de freno delantero', 'Disco de freno trasero', 'Prensa de freno', 'Amortiguador delantero izquierdo',
  'Amortiguador delantero derecho', 'Resortes delanteros', 'Resortes traseros', 'Amortiguador trasero derecho',
  'Amortiguador trasero izquierdo', 'Compresor A/C', 'Alternador', 'Computadora de motor',
  'Computadora de transmisión', 'Caja de fusibles', 'Cremallera', 'Bomba de dirección', 'Barra estabilizadora',
  'Múltiple de admisión', 'Múltiple de escape', 'Garganta', 'Filtro de aire', 'Manguera de aire', 'Sensor MAF',
  'Flecha delantera izquierda', 'Flecha delantera derecha', 'Motor', 'Transmisión',
];

// Las llaves siempre se comparan contra palabras ya normalizadas (sin acentos, minúsculas),
// así que tanto llaves como valores deben estar en esa misma forma normalizada.
const SINONIMOS_PALABRA = {
  'defensa': 'parachoques', 'defensas': 'parachoques',
  'maletero': 'cajuela', 'cajuelas': 'cajuela',
  'capo': 'cofre',
  'espejos': 'espejo', 'puertas': 'puerta', 'faros': 'faro', 'calaveras': 'calavera',
  'amortiguadores': 'amortiguador', 'resorte': 'resortes',
  'rin': 'rines', 'llanta': 'rines', 'llantas': 'rines',
  'transmision': 'transmision', 'caja': 'transmision', 'clutch': 'transmision', 'embrague': 'transmision',
  'izquierda': 'izquierdo', 'derecha': 'derecho',
  'delantera': 'delantero', 'adelante': 'delantero', 'frontal': 'delantero',
  'trasera': 'trasero', 'atras': 'trasero',
};

const DIACRITICOS_COMBINABLES = new RegExp('[\\u0300-\\u036f]', 'g');

function normalizar(texto) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICOS_COMBINABLES, '');
}

function extraerAnio(textoNormalizado) {
  const match = textoNormalizado.match(/\b(19[8-9]\d|20[0-3]\d)\b/);
  if (!match) return null;
  const anio = parseInt(match[1], 10);
  return anio >= 1980 && anio <= 2035 ? anio : null;
}

function escaparRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Distancia de Levenshtein clásica (edición mínima entre dos strings).
function distanciaLevenshtein(a, b) {
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
function umbralMaximo(longitud) {
  if (longitud <= 6) return 1;
  if (longitud <= 9) return 2;
  return 3;
}

const MIN_LARGO_PARA_DIFUSO = 4;

// Palabras genéricas/comunes del dominio que NUNCA deben tratarse como posible typo de
// marca/modelo, por más cerca que caigan en distancia — el umbral numérico solo no basta
// (ej. "carro"~"camaro" y "hola"~"honda" caen dentro de distancias razonables).
const PALABRAS_EXCLUIDAS_DIFUSO = new Set([
  'carro', 'carros', 'coche', 'coches', 'auto', 'autos', 'vehiculo', 'vehiculos',
  'pieza', 'piezas', 'parte', 'partes', 'necesito', 'busco', 'quiero', 'tengo',
  'hola', 'gracias', 'favor', 'ayuda', 'urgente', 'rapido', 'bueno', 'buena',
  'para', 'como', 'estas', 'esta', 'este', 'usado', 'usados', 'comprar', 'vender',
]);

function mejorCandidatoDifuso(palabra, candidatos) {
  if (palabra.length < MIN_LARGO_PARA_DIFUSO) return null;
  if (PALABRAS_EXCLUIDAS_DIFUSO.has(palabra)) return null;
  let mejor = null;
  let mejorDist = Infinity;
  for (const candidato of candidatos) {
    const candidatoNorm = normalizar(candidato);
    if (candidatoNorm.length < MIN_LARGO_PARA_DIFUSO) continue;
    if (candidatoNorm === palabra) continue; // ya lo habría encontrado el match exacto
    const dist = distanciaLevenshtein(palabra, candidatoNorm);
    if (dist <= umbralMaximo(candidatoNorm.length) && dist < mejorDist) {
      mejor = candidato;
      mejorDist = dist;
    }
  }
  return mejor;
}

function extraerMarcaModelo(textoNormalizado) {
  const palabras = textoNormalizado.split(/\s+/).filter(Boolean);
  let difuso = false;

  // 1. Exacto: alias/marca por substring en todo el texto.
  let marcaEncontrada = null;
  for (const [alias, canonica] of Object.entries(ALIAS_MARCA)) {
    if (textoNormalizado.includes(normalizar(alias))) {
      marcaEncontrada = canonica;
      break;
    }
  }

  // 2. Exacto: modelo por palabra completa (funciona incluso sin marca, ej. "tsuru 2010").
  let modeloEncontrado = null;
  let marcaDelModelo = null;
  for (const [marca, modelos] of Object.entries(CATALOGO_BASE)) {
    for (const modelo of modelos) {
      const modeloNorm = normalizar(modelo);
      // Evita falsos positivos con modelos de una sola letra/número corto (ej. Mazda "2", "3").
      if (modeloNorm.length < 2) continue;
      const regex = new RegExp(`\\b${escaparRegex(modeloNorm)}\\b`);
      if (regex.test(textoNormalizado)) {
        modeloEncontrado = modelo;
        marcaDelModelo = marca;
        break;
      }
    }
    if (modeloEncontrado) break;
  }

  let marca = marcaEncontrada || marcaDelModelo || null;
  let modelo = modeloEncontrado || null;

  // 3. Difuso: si el exacto no encontró marca, busca la palabra del texto más cercana
  // a algún alias de marca (typos tipo "hiundia" -> "hyundai").
  if (!marca) {
    for (const palabra of palabras) {
      const alias = mejorCandidatoDifuso(palabra, Object.keys(ALIAS_MARCA));
      if (alias) {
        marca = ALIAS_MARCA[alias];
        difuso = true;
        break;
      }
    }
  }

  // 4. Difuso: si el exacto no encontró modelo, busca contra los modelos de la marca ya
  // resuelta (si la hay) para mayor precisión, o contra todo el catálogo si no.
  if (!modelo) {
    const marcasABuscar = marca ? [marca] : Object.keys(CATALOGO_BASE);
    for (const palabra of palabras) {
      let encontrado = null;
      for (const m of marcasABuscar) {
        const candidato = mejorCandidatoDifuso(palabra, CATALOGO_BASE[m] || []);
        if (candidato) { encontrado = { marca: m, modelo: candidato }; break; }
      }
      if (encontrado) {
        modelo = encontrado.modelo;
        if (!marca) marca = encontrado.marca;
        difuso = true;
        break;
      }
    }
  }

  return { marca, modelo, difuso };
}

// Palabras de lado/posición: se tratan como calificadores OPCIONALES. Si el usuario no las
// menciona ("defensa" sin decir delantera/trasera), igual se reconoce la pieza por su base
// ("Parachoques"), y consultarInventario hace match por subconjunto de palabras (no igualdad
// exacta) para que "Parachoques" encuentre tanto "Parachoques delantero" como "...trasero".
const CALIFICADORES_LADO = new Set([
  'delantero', 'delanteros', 'delantera', 'delanteras',
  'trasero', 'traseros', 'trasera', 'traseras',
  'izquierdo', 'izquierdos', 'izquierda', 'izquierdas',
  'derecho', 'derechos', 'derecha', 'derechas',
]);

const PIEZAS_INFO = PIEZAS_CATALOGO.map((nombre) => {
  const palabras = normalizar(nombre).split(/\s+/).filter(Boolean);
  const calificadores = palabras.filter((p) => CALIFICADORES_LADO.has(p));
  const base = palabras.filter((p) => !CALIFICADORES_LADO.has(p));
  return { nombre, palabras, base };
});

function extraerPieza(textoNormalizado) {
  const palabras = textoNormalizado.split(/\s+/).filter(Boolean)
    .map((p) => SINONIMOS_PALABRA[p] || p);
  const set = new Set(palabras);

  // 1. Match exacto: todas las palabras del nombre canónico (incluye lado si lo tiene).
  let mejor = null;
  let mejorPuntaje = 0;
  for (const { nombre, palabras: palabrasCanon } of PIEZAS_INFO) {
    const coincideTodo = palabrasCanon.every((pc) => set.has(pc));
    if (coincideTodo && palabrasCanon.length > mejorPuntaje) {
      mejor = nombre;
      mejorPuntaje = palabrasCanon.length;
    }
  }
  if (mejor) return mejor;

  // 2. Sin calificador de lado: coincidencia solo por la "base" (ej. "parachoques").
  //    Se agrupan variantes que comparten la misma base para no repetir el mismo puntaje.
  const basesVistas = new Set();
  let mejorBase = null;
  let mejorPuntajeBase = 0;
  for (const { base } of PIEZAS_INFO) {
    if (base.length === 0) continue;
    const clave = base.join(' ');
    if (basesVistas.has(clave)) continue;
    basesVistas.add(clave);
    const coincideBase = base.every((pb) => set.has(pb));
    if (coincideBase && base.length > mejorPuntajeBase) {
      mejorPuntajeBase = base.length;
      mejorBase = clave;
    }
  }
  if (mejorBase) {
    return mejorBase.charAt(0).toUpperCase() + mejorBase.slice(1);
  }
  return mejor;
}

// Capa 1 (reglas): extrae { pieza, marca, modelo, anio, reconocido, requiereConfirmacion }
// de texto libre en español. requiereConfirmacion es true si marca o modelo se resolvieron
// por coincidencia difusa (typo) en vez de exacta — en ese caso, quien llama debe pedir
// confirmación al usuario antes de consultar Firestore, no ejecutar la búsqueda directo.
export function extraerIntencion(textoOriginal) {
  const textoNormalizado = normalizar(textoOriginal);
  const anio = extraerAnio(textoNormalizado);
  const { marca, modelo, difuso } = extraerMarcaModelo(textoNormalizado);
  const pieza = extraerPieza(textoNormalizado);

  const reconocido = Boolean(pieza && (marca || modelo));

  return { pieza, marca, modelo, anio, reconocido, requiereConfirmacion: reconocido && difuso };
}
