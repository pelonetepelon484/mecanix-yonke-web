// Buscador "Piezas nuevas" (etapa 4): índice compacto por refaccionaria y búsqueda por número de
// parte o descripción. Lógica pura, sin Firebase (se prueba sin conexión).
//
// Índice: refaccionarias/{id}/busqueda/{n}, cada uno con hasta PIEZAS_POR_INDICE piezas en UN solo
// texto (`entradas`), un renglón por pieza: número normalizado, palabras, precio y posición global
// en los bloques (bloque = posición / 1000). Un solo campo de texto genera una sola entrada de índice
// automático de Firestore, no miles. Con el precio en el índice se ordena sin leer bloques; después
// solo se leen los bloques de los resultados que se muestran.
import { PIEZAS_POR_BLOQUE, piezaPublica, type PiezaRefaccionaria } from './refaccionarias';

export const PIEZAS_POR_INDICE = 5000;
export const MAX_LARGO_NUMERO = 60;
export const MAX_LARGO_PALABRAS = 100;
// Tope del texto (las reglas revisan lo mismo): 5,000 renglones de máximo ~180 caracteres.
export const MAX_LARGO_ENTRADAS = 950000;
export const RESULTADOS_POR_PAGINA = 30;
export const MAX_PAGINAS_RESULTADOS = 10;
// Largo mínimo de lo escrito (ya normalizado) para cada tipo de coincidencia del número de parte.
const MIN_EXACTO = 3;
const MIN_EMPIEZA = 4;
const MIN_CONTIENE = 5;

// Mejor coincidencia primero: número exacto, número que empieza con, número que contiene,
// descripción con todas las palabras completas, descripción con alguna palabra como inicio.
export const NIVELES = { exacto: 0, empieza: 1, contiene: 2, palabras: 3, inicioPalabras: 4 } as const;

const quitarAcentos = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');

// "ABC-123", "abc 123" y "ABC123" quedan como "ABC123". No mezcla O con 0 ni I con 1.
export function normalizarNumeroParte(v: unknown): string {
  return quitarAcentos(v).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, MAX_LARGO_NUMERO);
}

const PALABRAS_VACIAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'para', 'con', 'sin', 'por', 'en', 'un', 'una', 'al', 'y', 'o', 'a']);
// Plural simple: sin la "s" final ("balatas" = "balata"). "faroles" queda "farole" y "farol" la
// encuentra como inicio de palabra.
const raiz = (p: string) => (p.length > 3 && p.endsWith('s') ? p.slice(0, -1) : p);

// Palabras de una descripción o de lo que se busca: minúsculas, sin acentos ni signos, sin palabras
// vacías, en singular y sin repetir.
export function palabrasDe(texto: unknown): string[] {
  const lista = quitarAcentos(texto).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ')
    .filter((p) => p.length >= 2 && !PALABRAS_VACIAS.has(p)).map(raiz);
  return [...new Set(lista)];
}

export function numIndices(totalPiezas: unknown): number {
  return Number.isInteger(totalPiezas) && (totalPiezas as number) > 0 ? Math.ceil((totalPiezas as number) / PIEZAS_POR_INDICE) : 0;
}

function palabrasRecortadas(palabras: string[]): string {
  let texto = '';
  for (const p of palabras) {
    const siguiente = texto ? `${texto} ${p}` : p;
    if (siguiente.length > MAX_LARGO_PALABRAS) break;
    texto = siguiente;
  }
  return texto;
}

// Arma los textos de índice de TODAS las piezas de la refaccionaria, en el orden de sus bloques
// (la posición i vive en el bloque i / 1000). Piezas sin número de parte o sin precio no entran.
export function armarIndices(piezas: unknown[]): string[] {
  const indices: string[][] = Array.from({ length: numIndices(piezas.length) }, () => []);
  piezas.forEach((original, i) => {
    const p = piezaPublica(original);
    if (!p) return;
    const numero = normalizarNumeroParte(p.numeroParte);
    if (!numero) return;
    const palabras = palabrasRecortadas(palabrasDe(`${p.descripcion} ${p.marca}`));
    indices[Math.floor(i / PIEZAS_POR_INDICE)].push(`${numero}\t${palabras}\t${Math.round(p.precio * 100) / 100}\t${i}`);
  });
  return indices.map((renglones) => renglones.join('\n'));
}

export type EntradaIndice = { numero: string; palabras: string[]; precio: number; posicion: number };

export function leerIndice(entradas: unknown): EntradaIndice[] {
  if (typeof entradas !== 'string' || !entradas) return [];
  const lista: EntradaIndice[] = [];
  for (const renglon of entradas.split('\n')) {
    const [numero, palabras, precioTexto, posicionTexto] = renglon.split('\t');
    const precio = Number(precioTexto);
    const posicion = Number(posicionTexto);
    if (!numero || !(precio > 0) || !Number.isInteger(posicion) || posicion < 0) continue;
    lista.push({ numero, palabras: palabras ? palabras.split(' ') : [], precio, posicion });
  }
  return lista;
}

export type Consulta = { numero: string; palabras: string[] };

// null si no hay nada que buscar. Solo se busca como número de parte si lo escrito lleva algún
// dígito (así "balatas" o "de la" no se comparan contra los números).
export function prepararConsulta(texto: unknown): Consulta | null {
  const compacto = normalizarNumeroParte(texto);
  const numero = /[0-9]/.test(compacto) ? compacto : '';
  const palabras = palabrasDe(texto);
  if (numero.length < MIN_EXACTO && palabras.length === 0) return null;
  return { numero, palabras };
}

function nivelNumero(e: EntradaIndice, c: Consulta): number | null {
  if (c.numero.length >= MIN_EXACTO && e.numero === c.numero) return NIVELES.exacto;
  if (c.numero.length >= MIN_EMPIEZA && e.numero.startsWith(c.numero)) return NIVELES.empieza;
  if (c.numero.length >= MIN_CONTIENE && e.numero.includes(c.numero)) return NIVELES.contiene;
  return null;
}

// Todas las palabras buscadas deben estar, completas o como inicio de alguna palabra de la pieza.
function nivelPalabras(e: EntradaIndice, c: Consulta): number | null {
  if (c.palabras.length === 0) return null;
  let todasCompletas = true;
  for (const q of c.palabras) {
    if (e.palabras.includes(q)) continue;
    if (!e.palabras.some((p) => p.startsWith(q))) return null;
    todasCompletas = false;
  }
  return todasCompletas ? NIVELES.palabras : NIVELES.inicioPalabras;
}

export type Coincidencia = { numero: string; precio: number; posicion: number; nivel: number };

export function buscarEnIndice(entradas: EntradaIndice[], c: Consulta): Coincidencia[] {
  const encontradas: Coincidencia[] = [];
  for (const e of entradas) {
    const niveles = [nivelNumero(e, c), nivelPalabras(e, c)].filter((n): n is number => n !== null);
    if (niveles.length > 0) encontradas.push({ numero: e.numero, precio: e.precio, posicion: e.posicion, nivel: Math.min(...niveles) });
  }
  return encontradas;
}

// Mejor coincidencia primero y, en empate, el precio más bajo. Después, para que el orden no
// cambie entre búsquedas iguales: refaccionaria y posición.
export function ordenarCoincidencias<T extends Coincidencia & { refaccionariaId: string }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => a.nivel - b.nivel || a.precio - b.precio
    || a.refaccionariaId.localeCompare(b.refaccionariaId) || a.posicion - b.posicion);
}

export const ubicacionEnBloques = (posicion: number) => ({
  bloque: Math.floor(posicion / PIEZAS_POR_BLOQUE), indice: posicion % PIEZAS_POR_BLOQUE,
});

// La pieza del bloque que corresponde a una coincidencia. null si ya no coincide (el índice quedó
// viejo respecto al bloque): mejor no mostrarla que mostrar otra pieza.
export function piezaDeCoincidencia(bloque: { piezas?: unknown } | null | undefined, c: Coincidencia): PiezaRefaccionaria | null {
  const lista = Array.isArray(bloque?.piezas) ? bloque.piezas : [];
  const pieza = piezaPublica(lista[ubicacionEnBloques(c.posicion).indice]);
  return pieza && normalizarNumeroParte(pieza.numeroParte) === c.numero ? pieza : null;
}

export const paginaResultados = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= MAX_PAGINAS_RESULTADOS ? n : 1;
};
