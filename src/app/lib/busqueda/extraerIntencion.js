import { CATALOGO_BASE } from '../catalogoBase';
import { obtenerCatalogoCombinado } from './catalogoCombinado';
import { extraerCilindradaDeTexto } from './cilindrada';
import { tieneSenialExplicitaNumeroDeParte, tieneNumeroSospechoso } from './numeroDeParte';
import { PIEZAS_CATALOGO } from '../piezasCatalogo';

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

// Modelos de RAM que NO existen como "Ram <numero>" bajo Dodge en el catálogo (1500 y 2500 sí
// se venden bajo ambas marcas según el año, así que esos se dejan intactos — ver el uso más
// abajo en extraerMarcaModelo). Calculado una sola vez a partir de CATALOGO_BASE, no hardcodeado,
// para que si el catálogo cambia esto se recalcule solo.
const MODELOS_RAM_EXCLUSIVOS = (CATALOGO_BASE['RAM'] || []).filter((modelo) => {
  const comoModeloDodge = `ram ${modelo}`.toLowerCase();
  return !(CATALOGO_BASE['Dodge'] || []).some((m) => m.toLowerCase() === comoModeloDodge);
});

// Las llaves siempre se comparan contra palabras ya normalizadas (sin acentos, minúsculas),
// así que tanto llaves como valores deben estar en esa misma forma normalizada.
const SINONIMOS_PALABRA = {
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

// Quita puntuación pegada a los bordes de un token (comas, signos, etc.) preservando
// guiones internos — así "civic," compara igual que "civic", pero "cx-3" sigue siendo
// un solo token distinto de "3" (el guion no es borde, es parte del token).
function limpiarToken(token) {
  return token.replace(/^[^a-z0-9-]+/, '').replace(/[^a-z0-9-]+$/, '');
}

// Compara por SECUENCIA DE TOKENS completos (separados por espacio), no por substring con
// límites de palabra (\b). Esto es lo que permite que modelos numéricos cortos como "3" o
// "6" (Mazda) o multi-palabra como "Serie 3" (BMW) casen exacto sin los falsos positivos
// que un regex \b tendría contra tokens compuestos con guion (ej. "cx-3" contiene un "3"
// delimitado por \b, pero como TOKEN completo "cx-3" nunca es igual a "3").
function contieneSecuenciaTokens(tokensTexto, tokensModelo) {
  if (tokensModelo.length === 0) return false;
  for (let i = 0; i <= tokensTexto.length - tokensModelo.length; i++) {
    let coincide = true;
    for (let j = 0; j < tokensModelo.length; j++) {
      if (tokensTexto[i + j] !== tokensModelo[j]) { coincide = false; break; }
    }
    if (coincide) return true;
  }
  return false;
}

async function extraerMarcaModelo(textoNormalizado, anio) {
  // Catálogo combinado (CATALOGO_BASE + catálogo vivo de Firestore, con caché de 10 min) —
  // así el matching exacto y difuso de abajo reconoce también modelos que solo existen en el
  // inventario real y nunca se agregaron a mano al catálogo estático (ej. RAM 700, Chrysler
  // 200, Pontiac 6000). MODELOS_RAM_EXCLUSIVOS y ALIAS_MARCA siguen usando el estático puro
  // (ver más abajo y arriba del archivo) — no dependen de esto.
  const catalogo = await obtenerCatalogoCombinado();

  // El año ya fue extraído por separado — se excluye de las palabras candidatas a difuso
  // para que un token como "2008" nunca se compare contra modelos numéricos cortos
  // (ej. Peugeot "3008"), que es justo el tipo de colisión que el umbral difuso no filtra.
  const anioStr = anio != null ? String(anio) : null;
  const palabras = textoNormalizado.split(/\s+/).filter(Boolean).filter((p) => p !== anioStr);
  let difuso = false;

  // 1. Exacto: alias/marca por substring en todo el texto.
  let marcaEncontrada = null;
  for (const [alias, canonica] of Object.entries(ALIAS_MARCA)) {
    if (textoNormalizado.includes(normalizar(alias))) {
      marcaEncontrada = canonica;
      break;
    }
  }

  // 2. Exacto: modelo por secuencia de tokens completos (funciona incluso sin marca, ej.
  // "tsuru 2010"). Si ya se encontró marca por alias, se prueban primero sus propios modelos
  // (evita que un token corto/genérico case por error contra otra marca) y luego el resto.
  let modeloEncontrado = null;
  let marcaDelModelo = null;
  const tokensTexto = textoNormalizado.split(/\s+/).filter(Boolean).map(limpiarToken);
  const marcasAProbar = marcaEncontrada
    ? [marcaEncontrada, ...Object.keys(catalogo).filter((m) => m !== marcaEncontrada)]
    : Object.keys(catalogo);
  for (const marca of marcasAProbar) {
    const modelos = catalogo[marca] || [];
    for (const modelo of modelos) {
      const tokensModelo = normalizar(modelo).split(/\s+/).filter(Boolean);
      if (contieneSecuenciaTokens(tokensTexto, tokensModelo)) {
        modeloEncontrado = modelo;
        marcaDelModelo = marca;
        break;
      }
    }
    if (modeloEncontrado) break;
  }

  // "chrysler ram 700" / "dodge ram 700": el alias genérico de Chrysler/Dodge (paso 1) se
  // dispara ANTES de llegar a "ram" en el texto (el orden de ALIAS_MARCA los pone primero),
  // así que marcaEncontrada queda mal aunque el modelo sí se detecte bien como "700" de RAM.
  // Se corrige SOLO cuando el modelo encontrado es EXCLUSIVO de RAM (700, 4000, ProMaster) —
  // "Ram 1500"/"Ram 2500" siguen resolviendo a Dodge exactamente como antes, porque son
  // modelos reales de Dodge que sí existen así en el inventario (confirmado contra Firestore:
  // 7+ yonkes tienen marca="Dodge" con esos modelos, y forzar RAM ahí los habría roto).
  if ((marcaEncontrada === 'Chrysler' || marcaEncontrada === 'Dodge')
      && marcaDelModelo === 'RAM'
      && MODELOS_RAM_EXCLUSIVOS.includes(modeloEncontrado)
      && /\bram\b/.test(textoNormalizado)) {
    marcaEncontrada = 'RAM';
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
    const marcasABuscar = marca ? [marca] : Object.keys(catalogo);
    for (const palabra of palabras) {
      let encontrado = null;
      for (const m of marcasABuscar) {
        const candidato = mejorCandidatoDifuso(palabra, catalogo[m] || []);
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

// Palabras que nunca cuentan como "intento de modelo sin explicar": conectores, verbos
// comunes de búsqueda y cortesía. Todo lo que sobre después de restar marca/año/pieza/estas
// palabras se interpreta como un modelo que el usuario mencionó pero no reconocimos.
const PALABRAS_CONECTORAS = new Set([
  'para', 'de', 'del', 'un', 'una', 'unos', 'unas', 'el', 'la', 'los', 'las',
  'en', 'con', 'sin', 'y', 'o', 'a', 'al', 'por', 'mi', 'su', 'me', 'se',
  'busco', 'necesito', 'tengo', 'quiero', 'hola', 'porfavor', 'favor', 'gracias',
  'que', 'como', 'esta', 'este', 'ese', 'esa', 'tiene', 'tienen', 'hay',
]);

// Detecta si, con marca ya reconocida pero SIN modelo resuelto, queda en el texto una
// palabra que probablemente era un intento de modelo (ej. "atlas" en "volkswagen atlas
// 2020"). Distingue esto de una búsqueda genuina de solo-marca (ej. "nissan 2015"), donde
// no queda ninguna palabra sin explicar. Es la señal que evita el fallback peligroso de
// marca+modelo-no-reconocido -> buscar toda la marca (route.js nunca debe hacer ese fallback
// cuando esto es true; solo lo hace cuando el usuario genuinamente no mencionó modelo).
function detectarModeloDesconocido(textoNormalizado, { marca, modelo, anio, pieza }) {
  if (modelo || !marca) return false;

  const aliasPalabras = new Set();
  for (const [alias, canonica] of Object.entries(ALIAS_MARCA)) {
    if (canonica === marca) {
      normalizar(alias).split(/\s+/).forEach((w) => aliasPalabras.add(w));
    }
  }
  const piezaPalabras = new Set(pieza ? normalizar(pieza).split(/\s+/) : []);
  const anioStr = anio != null ? String(anio) : null;

  const palabras = textoNormalizado.split(/\s+/).filter(Boolean);
  return palabras.some((p) => {
    if (aliasPalabras.has(p)) return false;
    if (p === anioStr) return false;
    if (PALABRAS_CONECTORAS.has(p)) return false;
    if (piezaPalabras.has(p)) return false;
    return true;
  });
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

// Piezas para las que tiene sentido buscar por cilindrada sola (sin marca/modelo de vehículo):
// un motor o transmisión suelto se identifica por su propio tamaño, no por el auto al que
// perteneció. El resto de las piezas (defensa, puerta, etc.) siguen exigiendo marca o modelo.
const PIEZAS_CON_CILINDRADA = new Set(['Motor', 'Transmisión']);

// Capa 1 (reglas): extrae { pieza, marca, modelo, anio, cilindrada, reconocido,
// requiereConfirmacion } de texto libre en español. requiereConfirmacion es true si marca o
// modelo se resolvieron por coincidencia difusa (typo) en vez de exacta — en ese caso, quien
// llama debe pedir confirmación al usuario antes de consultar Firestore, no ejecutar la
// búsqueda directo.
export async function extraerIntencion(textoOriginal) {
  const textoNormalizado = normalizar(textoOriginal);
  const anio = extraerAnio(textoNormalizado);
  const cilindrada = extraerCilindradaDeTexto(textoNormalizado);
  const { marca, modelo, difuso } = await extraerMarcaModelo(textoNormalizado, anio);
  const pieza = extraerPieza(textoNormalizado);

  // "motor 3.6" (sin marca/modelo) también cuenta como reconocido cuando la pieza es un
  // motor/transmisión y sí se extrajo cilindrada — un motor suelto de cierto tamaño es una
  // búsqueda válida sin necesidad de saber a qué marca/modelo de auto pertenecía.
  const esBusquedaPorCilindrada = Boolean(cilindrada != null && pieza && PIEZAS_CON_CILINDRADA.has(pieza));
  const reconocido = Boolean(pieza && (marca || modelo || esBusquedaPorCilindrada));

  // Cilindrada mencionada pero AMBIGUA: hay un decimal tipo cilindrada (ej. "chevrolet 3.6",
  // "3.6" solo) pero el usuario nunca dijo "motor"/"transmisión" (pieza null) ni resolvió un
  // modelo de vehículo real (que ganaría como búsqueda normal — ver el `!modelo` de abajo).
  // Distinto de esBusquedaPorCilindrada: ahí la pieza YA es Motor/Transmisión (inequívoco, se
  // busca directo); aquí NUNCA se asume — se arma una sugerencia para que quien llama (route.js)
  // OFREZCA la aclaración ("¿Buscas el motor 3.6 de Chevrolet?") en vez de decidir por el
  // cliente, reusando el mismo mecanismo de confirmación que ya existe para typos.
  // pieza:'Motor' en la sugerencia es arbitrario entre Motor/Transmisión — consultarMotoresTransmisiones
  // (a la que llega tras confirmar) busca ambos tipos sin distinguir por este campo, solo lo
  // usa el gate de resolverBusqueda para saltarse el requisito de modelo.
  const sugerenciaCilindrada = (cilindrada != null && !pieza && !modelo)
    ? { pieza: 'Motor', marca: marca || null, modelo: null, anio: anio || null, cilindrada }
    : null;
  // Vehículo reconocido aunque falte la pieza (ej. "honda civic 2000"): el usuario
  // probablemente quiere explorar todo el inventario disponible de ese vehículo, no un
  // error. Distinto de "reconocido", que sigue exigiendo pieza para la búsqueda filtrada.
  const vehiculoReconocido = Boolean(marca || modelo);
  // Marca reconocida pero sin modelo Y con una palabra sin explicar (ej. "atlas" en
  // "volkswagen atlas 2020"): distingue "modelo mencionado pero no reconocido" de una
  // búsqueda genuina de solo-marca. Quien llama NUNCA debe hacer fallback a buscar toda
  // la marca cuando esto es true — mostraría vehículos de un modelo distinto al pedido.
  const modeloDesconocido = detectarModeloDesconocido(textoNormalizado, { marca, modelo, anio, pieza });

  // Número de parte / SKU: Mecanix no busca por eso (el inventario se organiza por
  // vehículo/motor). Dos señales, de más a menos confiable — ver numeroDeParte.js:
  // - explícita: el cliente mismo dice "sku"/"código"/"clave" cerca de un número. Vale sola,
  //   sin importar qué más se haya reconocido.
  // - sospechosa (por descarte): solo tiene sentido cuando SÍ hay una pieza reconocida (ej.
  //   "pistón 609 std") — un número suelto sin ninguna pieza es demasiado ambiguo para asumir
  //   nada. Quien llama (route.js) decide EN QUÉ ramas usarla; nunca reemplaza un intento real
  //   de búsqueda, solo se consulta cuando esa búsqueda ya no tiene a dónde más ir.
  const numeroDeParteExplicito = tieneSenialExplicitaNumeroDeParte(textoNormalizado);
  const numeroDeParteSospechoso = Boolean(pieza) && tieneNumeroSospechoso(textoNormalizado, { anio, modelo });

  return {
    pieza, marca, modelo, anio, cilindrada, reconocido, vehiculoReconocido, modeloDesconocido,
    sugerenciaCilindrada, numeroDeParteExplicito, numeroDeParteSospechoso,
    requiereConfirmacion: (reconocido || vehiculoReconocido) && difuso,
  };
}
