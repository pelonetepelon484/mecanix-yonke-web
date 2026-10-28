import { describe, expect, it, vi } from 'vitest';
import { buscarPiezasNuevas } from './buscarPiezasNuevas';
import { armarIndices, leerIndice } from '../../lib/buscadorRefacciones';

// Lecturas simuladas: refaccionarias, sus índices (armados con la función real) y sus bloques.
const pieza = (numeroParte, descripcion, precio) => ({ numeroParte, descripcion, marca: 'Genérica', tipo: 'generica', precio, incluyeIva: true });
const ref = (id, extra = {}) => ({ id, nombre: `Ref ${id}`, ciudad: 'Tijuana', whatsapp: '6641234567', slug: `ref-${id.toLowerCase()}`, verificado: false, estado: 'baja-california', visible: true, ...extra });
function armar(inventarios, refaccionarias) {
  const bloques = {};
  const indices = {};
  for (const [id, piezas] of Object.entries(inventarios)) {
    for (let b = 0; b * 1000 < piezas.length; b += 1) bloques[`${id}/${b}`] = { piezas: piezas.slice(b * 1000, (b + 1) * 1000) };
    armarIndices(piezas).forEach((entradas, n) => { indices[`${id}/${n}`] = leerIndice(entradas); });
  }
  const lecturas = {
    activas: vi.fn(async () => refaccionarias.map((r) => ({ ...r, totalPiezas: inventarios[r.id]?.length ?? 0 }))),
    indice: vi.fn(async (clave) => indices[clave] ?? []),
    bloque: vi.fn(async (clave) => bloques[clave] ?? null),
    visible: (r) => r.visible,
  };
  return { lecturas, bloques };
}

describe('buscar piezas nuevas', () => {
  const inventarios = {
    A: [pieza('ABC-123', 'Bomba de agua', 900), pieza('X-100', 'Balatas delanteras', 650)],
    B: [pieza('abc 123', 'Bomba de agua', 700), pieza('ABC1234', 'Bomba de gasolina', 100)],
    VENCIDA: [pieza('ABC123', 'Bomba de agua', 10)],
  };
  it('entre varias refaccionarias: mejor coincidencia y, en empate, precio más bajo; sin las no visibles', async () => {
    const { lecturas } = armar(inventarios, [ref('A'), ref('B'), ref('VENCIDA', { visible: false })]);
    const r = await buscarPiezasNuevas({ texto: 'ABC-123' }, lecturas);
    expect(r.resultados.map((x) => [x.refaccionaria.id, x.pieza.numeroParte, x.pieza.precio])).toEqual([
      ['B', 'abc 123', 700], ['A', 'ABC-123', 900], ['B', 'ABC1234', 100],
    ]);
    expect(r.resultados[0].refaccionaria).toEqual({ id: 'B', nombre: 'Ref B', ciudad: 'Tijuana', whatsapp: '6641234567', slug: 'ref-b', verificado: false });
    expect(r).toMatchObject({ total: 3, pagina: 1, hayMas: false });
    expect(lecturas.indice).not.toHaveBeenCalledWith('VENCIDA/0');
  });
  it('filtro de estado', async () => {
    const { lecturas } = armar(inventarios, [ref('A'), ref('B', { estado: 'sonora' })]);
    const r = await buscarPiezasNuevas({ texto: 'bomba agua', estado: 'sonora' }, lecturas);
    expect(r.resultados.map((x) => x.refaccionaria.id)).toEqual(['B']);
  });
  it('páginas de 30: solo lee los bloques de la página pedida', async () => {
    const muchas = Array.from({ length: 2500 }, (_, i) => pieza(`F-${i}`, 'Filtro de aceite', 100 + i));
    const { lecturas } = armar({ A: muchas }, [ref('A')]);
    const p1 = await buscarPiezasNuevas({ texto: 'filtro' }, lecturas);
    expect(p1).toMatchObject({ total: 2500, hayMas: true });
    expect(p1.resultados).toHaveLength(30);
    expect(p1.resultados[0].pieza.precio).toBe(100);
    expect(new Set(lecturas.bloque.mock.calls.map(([c]) => c))).toEqual(new Set(['A/0']));
    lecturas.bloque.mockClear();
    const p2 = await buscarPiezasNuevas({ texto: 'filtro', pagina: 2 }, lecturas);
    expect(p2.resultados[0].pieza.numeroParte).toBe('F-30');
  });
  it('si el bloque ya no coincide con el índice, esa pieza no se muestra', async () => {
    const { lecturas, bloques } = armar(inventarios, [ref('A')]);
    bloques['A/0'].piezas[0] = pieza('OTRA-1', 'Otra cosa', 5);
    const r = await buscarPiezasNuevas({ texto: 'ABC-123' }, lecturas);
    expect(r.resultados).toEqual([]);
  });
  it('sin nada que buscar no lee nada', async () => {
    const { lecturas } = armar(inventarios, [ref('A')]);
    expect(await buscarPiezasNuevas({ texto: ' - ' }, lecturas)).toEqual({ resultados: [], total: 0, pagina: 1, hayMas: false });
    expect(lecturas.activas).not.toHaveBeenCalled();
  });
});
