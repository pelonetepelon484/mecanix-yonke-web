import { afterEach, describe, expect, it, vi } from 'vitest';

// crearContacto: primer lugar libre, ID automático solo con Premium, "lleno" en Básico y un
// reintento si otro celular tomó el mismo lugar al mismo tiempo.
let ocupadas = [];
let existe = () => false;
const escritos = [];
vi.mock('../../../lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  Timestamp: { fromDate: (d) => d },
  collection: (_db, ...p) => p.join('/'),
  doc: (base, ...p) => (p.length ? p.join('/') : { id: 'AUTOxxxxxxxxxxxxxxxx' }),
  documentId: () => '__id__',
  getDocs: vi.fn(async () => ({ docs: ocupadas.map((id) => ({ id })) })),
  query: (...a) => a, where: (...a) => a, limit: (n) => n, orderBy: (c) => c, startAfter: (c) => c,
  serverTimestamp: () => 'AHORA',
  runTransaction: vi.fn(async (_db, fn) => fn({
    get: async (ref) => ({ exists: () => existe(ref) }),
    set: (ref, datos) => escritos.push({ ref, datos }),
  })),
  getDoc: vi.fn(), updateDoc: vi.fn(), deleteDoc: vi.fn(),
}));

const { crearContacto } = await import('./datos.js');
const datos = { nombre: 'José', telefono: '6641234567', nota: '', vehiculos: [] };
const todas = Array.from({ length: 25 }, (_, i) => `c${String(i + 1).padStart(2, '0')}`);

afterEach(() => { ocupadas = []; existe = () => false; escritos.length = 0; });

describe('crearContacto', () => {
  it('usa el primer lugar libre y guarda los campos para buscar', async () => {
    ocupadas = ['c01', 'c03'];
    expect(await crearContacto({ tallerId: 'T1', datos, premium: false })).toBe('c02');
    expect(escritos[0].ref).toBe('talleres/T1/contactosClientes/c02');
    expect(escritos[0].datos).toMatchObject({ nombre: 'José', nombreBusqueda: 'jose', placasLista: [], creadoAt: 'AHORA', actualizadoAt: 'AHORA' });
    expect(escritos[0].datos.expiraAt).toBeInstanceOf(Date);
  });
  it('Básico con los 25 ocupados: "lleno" sin escribir nada', async () => {
    ocupadas = todas;
    await expect(crearContacto({ tallerId: 'T1', datos, premium: false })).rejects.toThrow('Llegaste a 25 contactos del plan Básico');
    expect(escritos).toHaveLength(0);
  });
  it('Premium con los 25 ocupados: ID automático', async () => {
    ocupadas = todas;
    expect(await crearContacto({ tallerId: 'T1', datos, premium: true })).toBe('AUTOxxxxxxxxxxxxxxxx');
  });
  it('si el lugar se ocupó al mismo tiempo, vuelve a buscar una vez', async () => {
    let primera = true;
    existe = (ref) => { if (ref.endsWith('c01') && primera) { primera = false; return true; } return false; };
    expect(await crearContacto({ tallerId: 'T1', datos, premium: false })).toBe('c01');
    expect(escritos).toHaveLength(1);
  });
});
