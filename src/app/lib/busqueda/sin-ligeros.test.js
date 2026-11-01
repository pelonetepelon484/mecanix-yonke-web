import { beforeEach, describe, expect, it, vi } from 'vitest';

// Los yonkes de registro ligero no tienen inventario: el buscador no gasta lecturas en ellos ni
// cuentan para decir que un estado tiene yonkes. Con los que ya completaron, todo normal.
let yonkes = [];
const rutasLeidas = [];
vi.mock('../firebase-server', () => ({ dbServer: {} }));
vi.mock('../firebase', () => ({ db: {}, auth: {} }));
vi.mock('../yonkesServerData', () => ({ getRatingParaYonke: async () => ({ promedio: null, total: 0 }) }));
vi.mock('firebase/firestore', () => ({
  collection: (_db, ...ruta) => ruta.join('/'),
  query: (ref, filtro) => ({ ref, filtro }),
  where: (campo, op, valor) => ({ campo, op, valor }),
  doc: () => 'doc', getDoc: async () => ({ exists: () => false }),
  getDocs: async (q) => {
    const ref = typeof q === 'string' ? q : q.ref;
    rutasLeidas.push(ref);
    if (ref === 'yonkes') return { docs: yonkes.map((y) => ({ id: y.id, data: () => y })) };
    return { docs: [] };
  },
}));

const { consultarInventarioVehiculo, consultarRespaldoVehiculo } = await import('./consultarInventario');
const buscar = (estado) => consultarInventarioVehiculo({ marca: 'Toyota', modelo: 'Corolla', anio: 2020, estado });
const leyoInventarioDe = (id) => rutasLeidas.some((r) => r.startsWith(`yonkes/${id}/`));

beforeEach(() => {
  rutasLeidas.length = 0;
  yonkes = [
    { id: 'COMP', activo: true, estado: 'baja-california' },
    { id: 'LIG', activo: true, estado: 'baja-california', tipoRegistro: 'ligero' },
    { id: 'SOLO', activo: true, estado: 'colima', tipoRegistro: 'ligero' },
    { id: 'YA', activo: true, estado: 'sonora', tipoRegistro: 'completo' },
  ];
});

describe('el buscador y los yonkes ligeros', () => {
  it('no lee el inventario de un ligero', async () => {
    await buscar('baja-california');
    expect(leyoInventarioDe('COMP')).toBe(true);
    expect(leyoInventarioDe('LIG')).toBe(false);
  });
  it('tampoco en "todos los estados"', async () => {
    await consultarRespaldoVehiculo({ marca: 'Toyota', modelo: 'Corolla', anio: 2020, estado: 'todos' });
    expect(leyoInventarioDe('COMP')).toBe(true);
    expect(leyoInventarioDe('LIG')).toBe(false);
    expect(leyoInventarioDe('SOLO')).toBe(false);
  });
  it('un estado con puros ligeros dice que no hay yonkes', async () => {
    expect((await buscar('colima')).sinYonkesEnEstado).toBe(true);
  });
  it('el que ya completó su registro cuenta normal', async () => {
    const r = await buscar('sonora');
    expect(r.sinYonkesEnEstado).toBeUndefined();
    expect(leyoInventarioDe('YA')).toBe(true);
  });
});
