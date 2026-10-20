import { beforeEach, describe, expect, it, vi } from 'vitest';

// consultarRespaldoVehiculo con el buscarVehiculosPorAnio REAL (yonkes activos, sin vendidos,
// año exacto) sobre un Firestore simulado.
let yonkes = [];
let vehiculos = {}; // yonkeId -> [{ id, ...datos }]
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
    if (ref === 'yonkes') return { docs: yonkes.map((y) => ({ id: y.id, data: () => y })) };
    const yonkeId = ref.split('/')[1];
    const lista = (vehiculos[yonkeId] || []).filter((v) => !q.filtro || v.ano === q.filtro.valor);
    return { docs: lista.map((v) => ({ id: v.id, data: () => v })) };
  },
}));

const { consultarRespaldoVehiculo } = await import('./consultarInventario');
const corolla = (id, ano, extra = {}) => ({ id, marca: 'Toyota', modelo: 'Corolla', ano, ...extra });
const buscar = (extra = {}) => consultarRespaldoVehiculo({ marca: 'Toyota', modelo: 'Corolla', anio: 2020, estado: 'todos', ...extra });
const ids = (r) => r.resultados.map((x) => x.vehiculoId);

beforeEach(() => {
  yonkes = [
    { id: 'PATOS', nombre: 'Yonke el Patos', activo: true, estado: 'baja-california' },
    { id: 'INACTIVO', nombre: 'Inactivo', activo: false, estado: 'baja-california' },
    { id: 'SON', nombre: 'Sonora', activo: true, estado: 'sonora' },
  ];
  vehiculos = {
    PATOS: [corolla('p18', 2020, { cilindrada: '1.8' }), corolla('vendido', 2020, { disponible: false }), corolla('p19', 2019)],
    INACTIVO: [corolla('i20', 2020, { cilindrada: '1.8' })],
    SON: [corolla('s20', 2020, { cilindrada: '2.0' })],
  };
});

describe('respaldo por vehículo', () => {
  it('año exacto, sin yonkes inactivos ni vehículos vendidos', async () => {
    expect(ids(await buscar()).sort()).toEqual(['p18', 's20']);
  });

  it('respeta el filtro de estado', async () => {
    expect(ids(await buscar({ estado: 'baja-california' }))).toEqual(['p18']);
    expect(ids(await buscar({ estado: 'jalisco' }))).toEqual([]);
  });

  it('con cilindrada: primero (y solo) los que coinciden, marcados', async () => {
    const r = await buscar({ cilindrada: 1.8 });
    expect(ids(r)).toEqual(['p18']);
    expect(r.resultados[0].coincidePorCilindrada).toBe(true);
    expect(r.cilindradaDistinta).toBe(false);
  });

  it('con cilindrada sin ninguno que coincida: los demás, con aviso de cilindrada distinta', async () => {
    const r = await buscar({ cilindrada: 2.5 });
    expect(ids(r).sort()).toEqual(['p18', 's20']);
    expect(r.cilindradaDistinta).toBe(true);
  });

  it('sin vehículos: vacío y sin aviso', async () => {
    const r = await buscar({ anio: 2001, cilindrada: 1.8 });
    expect(r).toEqual({ resultados: [], cilindradaDistinta: false });
  });
});
