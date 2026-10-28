import { describe, expect, it, vi } from 'vitest';

const ops = [];
vi.mock('firebase/firestore', () => ({
  doc: (_db, ...p) => p.join('/'),
  collection: (_db, ...p) => p.join('/'),
  getDocs: vi.fn(async (ruta) => ({ docs: ruta.endsWith('bloques') ? [{ ref: `${ruta}/0` }] : [{ ref: `${ruta}/2026-10` }] })),
  writeBatch: () => ({ set: (r, d) => ops.push(['set', r, d]), delete: (r) => ops.push(['delete', r]), commit: async () => ops.push(['commit']) }),
  serverTimestamp: () => 'AHORA', Timestamp: { fromDate: (d) => ({ fecha: d }) },
}));
const { PIEZAS_PRUEBA, SLUG_REFACCIONARIA_PRUEBA, borrarRefaccionariaPrueba, crearRefaccionariaPrueba } = await import('./refaccionariaPrueba.js');
const { piezaPublica, refaccionariaVisible } = await import('../../../lib/refaccionarias');

describe('refaccionaria de prueba', () => {
  it('20 piezas ficticias válidas, marcadas como PRUEBA y sin marcas reales', () => {
    expect(PIEZAS_PRUEBA).toHaveLength(20);
    for (const p of PIEZAS_PRUEBA) {
      expect(piezaPublica(p)).not.toBeNull();
      expect(p.descripcion).toMatch(/\(PRUEBA\)/);
      expect(['Genérica', 'Marca Demo A', 'Marca Demo B', 'Marca Demo C']).toContain(p.marca);
    }
  });
  it('crear: un lote con la refaccionaria (esPrueba, prueba vigente, slug válido) y el bloque 0', async () => {
    ops.length = 0;
    await crearRefaccionariaPrueba({}, 'adm');
    const [[, ref, datos], [, refBloque, bloque], [fin]] = ops;
    expect(ref).toBe('refaccionarias/prueba-mecanix');
    expect(datos).toMatchObject({ esPrueba: true, activo: true, ownerUid: 'adm', slug: SLUG_REFACCIONARIA_PRUEBA, totalPiezas: 20, numBloques: 1 });
    expect(SLUG_REFACCIONARIA_PRUEBA).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(refaccionariaVisible({ activo: true, pruebaHasta: datos.pruebaHasta.fecha })).toBe(true);
    expect(refBloque).toBe('refaccionarias/prueba-mecanix/bloques/0');
    expect(bloque.piezas).toHaveLength(20);
    expect(fin).toBe('commit');
  });
  it('borrar: bloques, contadores y la refaccionaria en un lote', async () => {
    ops.length = 0;
    await borrarRefaccionariaPrueba({});
    expect(ops).toEqual([
      ['delete', 'refaccionarias/prueba-mecanix/bloques/0'],
      ['delete', 'refaccionarias/prueba-mecanix/contactos/2026-10'],
      ['delete', 'refaccionarias/prueba-mecanix'],
      ['commit'],
    ]);
  });
});
