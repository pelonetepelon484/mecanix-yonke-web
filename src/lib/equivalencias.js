// Equivalencias de números de parte (colección equivalenciasPiezas) y sugerencias automáticas
// (colección sugerenciasEquivalencia). Lógica pura: la usan el panel de admin y el servidor.
//
// Una equivalencia dice "estos números son la misma pieza" (ej. un número viejo de GM y el número
// nuevo que lo reemplaza). Solo el admin las registra; el comparador las lee para dar
// "Compatible según registros de Mecanix". Una sugerencia NUNCA la ve el cliente: es un dato que
// encontró la búsqueda automática y que el admin aprueba (pasa a equivalencia) o descarta.
import { TIPOS_PIEZA, normalizarParte, parteValida } from './comparadorPiezas';

export const COLECCION_EQUIVALENCIAS = 'equivalenciasPiezas';
export const COLECCION_SUGERENCIAS = 'sugerenciasEquivalencia';
export const MAX_PARTES = 20;
export const MAX_NOTA = 500;

// "12605843, 19210736 / 12-615-418" -> ['12605843', '19210736', '12615418'] (sin repetidos).
// Separa por coma, punto y coma, salto de línea, diagonal o espacio. Los guiones y puntos dentro de
// un número se quitan igual que en el comparador.
export function parsearPartes(texto) {
  if (typeof texto !== 'string') return { partes: [], invalidas: [] };
  const partes = [];
  const invalidas = [];
  for (const pedazo of texto.split(/[,;\n\r/\s]+/)) {
    if (!pedazo.trim()) continue;
    const p = normalizarParte(pedazo);
    if (!parteValida(p)) { invalidas.push(pedazo.trim()); continue; }
    if (!partes.includes(p)) partes.push(p);
  }
  return { partes, invalidas };
}

// Lo que se guarda en equivalenciasPiezas. { ok, datos } o { ok: false, mensaje }.
export function validarEquivalencia({ tipoPieza = '', textoPartes = '', nota = '' } = {}) {
  if (tipoPieza && !TIPOS_PIEZA.some((t) => t.key === tipoPieza)) return { ok: false, mensaje: 'Escoge un tipo de pieza de la lista.' };
  const { partes, invalidas } = parsearPartes(textoPartes);
  if (invalidas.length) return { ok: false, mensaje: `Revisa estos números (de 3 a 40 letras o números): ${invalidas.join(', ')}` };
  if (partes.length < 2) return { ok: false, mensaje: 'Escribe al menos dos números de parte distintos.' };
  if (partes.length > MAX_PARTES) return { ok: false, mensaje: `Máximo ${MAX_PARTES} números por registro.` };
  const n = typeof nota === 'string' ? nota.trim() : '';
  if (n.length > MAX_NOTA) return { ok: false, mensaje: `La nota es muy larga (máximo ${MAX_NOTA} caracteres).` };
  const datos = { clase: 'equivalencia', partes };
  if (tipoPieza) datos.tipoPieza = tipoPieza;
  if (n) datos.nota = n;
  return { ok: true, datos };
}

// ID de la sugerencia: tipo + la pareja en orden, para que A/B y B/A sean la misma búsqueda y una
// pareja nunca se busque (ni se cobre) dos veces.
export function idSugerencia(tipo, parteA, parteB) {
  const [x, y] = [normalizarParte(parteA), normalizarParte(parteB)].sort();
  return `${tipo}_${x}_${y}`;
}

// ¿Esta comparación amerita buscar una sugerencia? Dos números distintos, sin registro.
export function ameritaSugerencia({ parteA, parteB, registros, resultadoKey }) {
  return !!parteA && !!parteB && parteA !== parteB && !registros?.equivalentes && resultadoKey === 'indeterminado';
}

export const ESTADOS_SUGERENCIA = {
  buscando: { texto: 'Buscando…', color: '#555' },
  pendiente: { texto: 'Por revisar: la búsqueda dice que SÍ son equivalentes', color: '#1E6B34' },
  sin_resultado: { texto: 'La búsqueda no lo pudo confirmar', color: '#8A5A00' },
  error: { texto: 'La búsqueda falló', color: '#B3261E' },
  aprobada: { texto: 'Aprobada', color: '#1E6B34' },
  descartada: { texto: 'Descartada', color: '#555' },
};
export const CONFIANZAS = ['alta', 'media', 'baja'];

// Revisa la respuesta del modelo (texto con un objeto JSON). Nunca confía en ella: lo que no tenga
// la forma esperada queda como "no se pudo confirmar".
export function leerRespuestaIA(texto) {
  const vacio = { equivalentes: null, confianza: 'baja', resumen: '', partesRelacionadas: [] };
  if (typeof texto !== 'string') return vacio;
  const inicio = texto.indexOf('{');
  const fin = texto.lastIndexOf('}');
  if (inicio < 0 || fin <= inicio) return vacio;
  let j;
  try { j = JSON.parse(texto.slice(inicio, fin + 1)); } catch { return vacio; }
  if (!j || typeof j !== 'object') return vacio;
  const relacionadas = Array.isArray(j.partesRelacionadas)
    ? [...new Set(j.partesRelacionadas.map(normalizarParte).filter(parteValida))].slice(0, 10)
    : [];
  return {
    equivalentes: typeof j.equivalentes === 'boolean' ? j.equivalentes : null,
    confianza: CONFIANZAS.includes(j.confianza) ? j.confianza : 'baja',
    resumen: typeof j.resumen === 'string' ? j.resumen.trim().slice(0, 600) : '',
    partesRelacionadas: relacionadas,
  };
}

// Fuentes: solo direcciones http(s) reales que regresó la búsqueda (no las que "recuerde" el modelo).
export function limpiarFuentes(lista) {
  const vistas = new Set();
  const fuentes = [];
  for (const f of Array.isArray(lista) ? lista : []) {
    const url = typeof f?.url === 'string' ? f.url.trim() : '';
    if (!/^https?:\/\//i.test(url) || url.length > 500 || vistas.has(url)) continue;
    vistas.add(url);
    fuentes.push({ url, titulo: typeof f.titulo === 'string' ? f.titulo.trim().slice(0, 200) : '' });
    if (fuentes.length >= 5) break;
  }
  return fuentes;
}

// Nota que se guarda al aprobar una sugerencia (de dónde salió el dato).
export function notaDesdeSugerencia(s) {
  const fuente = s?.fuentes?.[0]?.url ? ` Fuente: ${s.fuentes[0].url}` : '';
  return `Aprobada desde sugerencia automática.${fuente}`.slice(0, MAX_NOTA);
}
