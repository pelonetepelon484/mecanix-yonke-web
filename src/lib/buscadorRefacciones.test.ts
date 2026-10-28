import { describe, expect, it } from 'vitest';
import {
  MAX_LARGO_ENTRADAS, NIVELES, PIEZAS_POR_INDICE, armarIndices, buscarEnIndice, leerIndice, normalizarNumeroParte, numIndices,
  ordenarCoincidencias, paginaResultados, palabrasDe, piezaDeCoincidencia, prepararConsulta, ubicacionEnBloques,
} from './buscadorRefacciones';

const pieza = (numeroParte: string, descripcion: string, precio: number, marca = 'Genérica') => ({
  numeroParte, descripcion, marca, tipo: 'generica', precio, incluyeIva: true,
});
const buscar = (piezas: unknown[], texto: string) => buscarEnIndice(leerIndice(armarIndices(piezas)[0]), prepararConsulta(texto)!);

describe('normalizar número de parte', () => {
  it('"ABC-123", "abc 123" y "ABC123" son lo mismo', () => {
    for (const v of ['ABC-123', 'abc 123', 'ABC123', ' a.b/c_1 2 3 ']) expect(normalizarNumeroParte(v)).toBe('ABC123');
  });
  it('sin acentos; no mezcla O con 0 ni I con 1; vacío y otros tipos', () => {
    expect(normalizarNumeroParte('Ñé-1')).toBe('NE1');
    expect(normalizarNumeroParte('O1')).not.toBe(normalizarNumeroParte('01'));
    expect(normalizarNumeroParte(null)).toBe('');
    expect(normalizarNumeroParte('x'.repeat(100))).toHaveLength(60);
  });
});

describe('palabras', () => {
  it('minúsculas, sin acentos, signos ni palabras vacías, en singular y sin repetir', () => {
    expect(palabrasDe('Balatas DELANTERAS para el Tsuru, cerámicas (balata)')).toEqual(['balata', 'delantera', 'tsuru', 'ceramica']);
    expect(palabrasDe('Bujía de iridio')).toEqual(['bujia', 'iridio']);
    expect(palabrasDe('')).toEqual([]);
  });
});

describe('índice', () => {
  it('un renglón por pieza con número, palabras (descripción y marca), precio y posición; sin las piezas inválidas', () => {
    const indices = armarIndices([
      pieza('DEMO-0001', 'Balatas delanteras', 650, 'Marca Demo A'),
      pieza('', 'Sin número', 100),
      pieza('X-2', 'Sin precio', 0),
      pieza('flt 9', 'Filtro de aceite', 145.5),
    ]);
    expect(indices).toEqual(['DEMO0001\tbalata delantera marca demo\t650\t0\nFLT9\tfiltro aceite generica\t145.5\t3']);
    expect(leerIndice(indices[0])).toEqual([
      { numero: 'DEMO0001', palabras: ['balata', 'delantera', 'marca', 'demo'], precio: 650, posicion: 0 },
      { numero: 'FLT9', palabras: ['filtro', 'aceite', 'generica'], precio: 145.5, posicion: 3 },
    ]);
  });
  it('5,000 piezas por documento; posición global; cabe en el tope aun con textos al máximo', () => {
    expect(numIndices(0)).toBe(0);
    expect(numIndices(5000)).toBe(1);
    expect(numIndices(5001)).toBe(2);
    expect(numIndices('20')).toBe(0);
    const largas = Array.from({ length: PIEZAS_POR_INDICE + 1 }, (_, i) =>
      pieza(`${'X'.repeat(54)}${String(i).padStart(6, '0')}`, `descripcion${i} ${'palabralarga '.repeat(20)}`, 123456.78, 'M'.repeat(60)));
    const indices = armarIndices(largas);
    expect(indices).toHaveLength(2);
    expect(indices[0].length).toBeLessThanOrEqual(MAX_LARGO_ENTRADAS);
    expect(leerIndice(indices[1])).toEqual([expect.objectContaining({ posicion: PIEZAS_POR_INDICE })]);
  });
  it('renglones dañados se ignoran', () => {
    expect(leerIndice('A1\tx\t10\t0\nmal\nB2\tx\t-1\t1\nC3\tx\t5\tdos\nD4\t\t5\t2')).toEqual([
      { numero: 'A1', palabras: ['x'], precio: 10, posicion: 0 },
      { numero: 'D4', palabras: [], precio: 5, posicion: 2 },
    ]);
    expect(leerIndice(undefined)).toEqual([]);
  });
});

describe('buscar', () => {
  const piezas = [
    pieza('ABC-123', 'Bomba de agua', 900),
    pieza('ABC1234', 'Bomba de gasolina', 1200),
    pieza('ZZABC123', 'Termostato', 300),
    pieza('Q-10', 'Balatas delanteras cerámicas', 650),
    pieza('Q-20', 'Balata trasera', 420),
  ];
  it('número de parte escrito de cualquier forma: exacto, empieza con y contiene', () => {
    for (const texto of ['ABC-123', 'abc 123', 'ABC123']) {
      const r = buscar(piezas, texto);
      expect(r.map((c) => [c.numero, c.nivel])).toEqual([['ABC123', NIVELES.exacto], ['ABC1234', NIVELES.empieza], ['ZZABC123', NIVELES.contiene]]);
    }
  });
  it('números cortos: exacto desde 3 caracteres, empieza desde 4, contiene desde 5', () => {
    expect(buscar(piezas, 'q 10')).toEqual([expect.objectContaining({ numero: 'Q10', nivel: NIVELES.exacto })]);
    expect(prepararConsulta('Q-1')).toBeNull();
    expect(buscar(piezas, 'ABC1').map((c) => c.numero)).toEqual(['ABC123', 'ABC1234']);
    expect(buscar(piezas, 'BC12')).toEqual([]);
  });
  it('descripción: todas las palabras, completas o como inicio de palabra; plural y acentos no importan', () => {
    expect(buscar(piezas, 'balatas').map((c) => [c.numero, c.nivel])).toEqual([['Q10', NIVELES.palabras], ['Q20', NIVELES.palabras]]);
    expect(buscar(piezas, 'balata delantera ceramica').map((c) => c.numero)).toEqual(['Q10']);
    expect(buscar(piezas, 'bomba gas')).toEqual([expect.objectContaining({ numero: 'ABC1234', nivel: NIVELES.inicioPalabras })]);
    expect(buscar(piezas, 'bomba de agua para el carro')).toEqual([]);
  });
  it('sin nada que buscar: null', () => {
    expect(prepararConsulta('  ')).toBeNull();
    expect(prepararConsulta('de la')).toBeNull();
    expect(prepararConsulta('ab')).toEqual({ numero: '', palabras: ['ab'] });
    expect(prepararConsulta('ABC-123')).toEqual({ numero: 'ABC123', palabras: ['abc', '123'] });
  });
  it('orden: mejor coincidencia y, en empate, el precio más bajo', () => {
    const lista = [
      { refaccionariaId: 'B', numero: 'X', precio: 50, posicion: 0, nivel: NIVELES.palabras },
      { refaccionariaId: 'A', numero: 'X', precio: 900, posicion: 0, nivel: NIVELES.exacto },
      { refaccionariaId: 'B', numero: 'X', precio: 700, posicion: 1, nivel: NIVELES.exacto },
      { refaccionariaId: 'A', numero: 'X', precio: 700, posicion: 4, nivel: NIVELES.exacto },
    ];
    expect(ordenarCoincidencias(lista).map((c) => `${c.refaccionariaId}${c.precio}`)).toEqual(['A700', 'B700', 'A900', 'B50']);
  });
});

describe('pieza de cada coincidencia', () => {
  it('posición global a bloque y lugar; si el bloque ya no coincide con el índice, no se muestra', () => {
    expect(ubicacionEnBloques(1234)).toEqual({ bloque: 1, indice: 234 });
    const bloque = { piezas: [pieza('ABC-123', 'Bomba', 900)] };
    expect(piezaDeCoincidencia(bloque, { numero: 'ABC123', precio: 900, posicion: 0, nivel: 0 })).toMatchObject({ numeroParte: 'ABC-123' });
    expect(piezaDeCoincidencia(bloque, { numero: 'OTRA', precio: 900, posicion: 0, nivel: 0 })).toBeNull();
    expect(piezaDeCoincidencia(null, { numero: 'ABC123', precio: 900, posicion: 0, nivel: 0 })).toBeNull();
  });
  it('página de resultados: 1 a 10', () => {
    expect(paginaResultados('3')).toBe(3);
    for (const v of [0, 11, 'x', undefined, 1.5]) expect(paginaResultados(v)).toBe(1);
  });
});
