import { describe, expect, it, vi } from 'vitest';

// Sin Firestore: se usa solo el diccionario base del repo.
vi.mock('../firebase-server', () => ({ dbServer: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(), collection: vi.fn(),
  getDoc: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
  getDocs: vi.fn(async () => ({ docs: [], empty: true })),
}));

const { extraerIntencion } = await import('./extraerIntencion');

describe('"caja": la de velocidades salvo las excepciones', () => {
  it.each([
    ['Tuvo caja del filtro corolla 2020 1.8', 'Manguera de aire'],
    ['tubo de la caja del filtro corolla 2020', 'Manguera de aire'],
    ['manguera de la caja del filtro corolla 2020', 'Manguera de aire'],
    ['caja del filtro de aire corolla 2020', 'Filtro de aire'],
    ['caja del filtro corolla 2020', 'Filtro de aire'],
    ['caja de velocidades corolla 2020', 'Transmisión'],
    ['caja de cambios corolla 2020', 'Transmisión'],
    // Sin cambio:
    ['caja corolla 2020', 'Transmisión'],
    ['transmision corolla 2020', 'Transmisión'],
    ['caja de fusibles corolla 2020', 'Caja de fusibles'],
    ['filtro de aire corolla 2020', 'Filtro de aire'],
  ])('%s → %s', async (texto, pieza) => {
    const i = await extraerIntencion(texto);
    expect(i.pieza).toBe(pieza);
    expect(i).toMatchObject({ marca: 'Toyota', modelo: 'Corolla', anio: 2020 });
  });

  it('la búsqueda del 19 oct conserva la cilindrada (busca el Corolla 1.8 con esa pieza)', async () => {
    expect(await extraerIntencion('Tuvo caja del filtro corolla 2020 1.8')).toMatchObject({ pieza: 'Manguera de aire', cilindrada: 1.8 });
  });
});
