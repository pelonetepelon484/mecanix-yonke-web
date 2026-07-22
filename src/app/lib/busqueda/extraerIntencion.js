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

function extraerMarcaModelo(textoNormalizado) {
  // 1. Buscar alias/marca directamente.
  let marcaEncontrada = null;
  for (const [alias, canonica] of Object.entries(ALIAS_MARCA)) {
    if (textoNormalizado.includes(normalizar(alias))) {
      marcaEncontrada = canonica;
      break;
    }
  }

  // 2. Buscar modelo (funciona incluso si la marca no se mencionó, ej. "tsuru 2010").
  let modeloEncontrado = null;
  let marcaDelModelo = null;
  for (const [marca, modelos] of Object.entries(CATALOGO_BASE)) {
    for (const modelo of modelos) {
      const modeloNorm = normalizar(modelo);
      // Evita falsos positivos con modelos de una sola letra/número corto (ej. Mazda "2", "3").
      if (modeloNorm.length < 2) continue;
      const regex = new RegExp(`\\b${modeloNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      if (regex.test(textoNormalizado)) {
        modeloEncontrado = modelo;
        marcaDelModelo = marca;
        break;
      }
    }
    if (modeloEncontrado) break;
  }

  const marcaFinal = marcaEncontrada || marcaDelModelo || null;
  const modeloFinal = modeloEncontrado || null;
  return { marca: marcaFinal, modelo: modeloFinal };
}

function extraerPieza(textoNormalizado) {
  const palabras = textoNormalizado.split(/\s+/).filter(Boolean)
    .map((p) => SINONIMOS_PALABRA[p] || p);
  const set = new Set(palabras);

  let mejor = null;
  let mejorPuntaje = 0;
  for (const canon of PIEZAS_CATALOGO) {
    const palabrasCanon = normalizar(canon).split(/\s+/).filter(Boolean);
    const coincideTodo = palabrasCanon.every((pc) => set.has(pc));
    if (coincideTodo && palabrasCanon.length > mejorPuntaje) {
      mejor = canon;
      mejorPuntaje = palabrasCanon.length;
    }
  }
  return mejor;
}

// Capa 1 (reglas): extrae { pieza, marca, modelo, anio, reconocido } de texto libre en español.
export function extraerIntencion(textoOriginal) {
  const textoNormalizado = normalizar(textoOriginal);
  const anio = extraerAnio(textoNormalizado);
  const { marca, modelo } = extraerMarcaModelo(textoNormalizado);
  const pieza = extraerPieza(textoNormalizado);

  const reconocido = Boolean(pieza && (marca || modelo));

  return { pieza, marca, modelo, anio, reconocido };
}
