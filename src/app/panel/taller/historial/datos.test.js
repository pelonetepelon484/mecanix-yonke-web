import { beforeEach, describe, expect, it, vi } from 'vitest';

// agregarOrdenAlHistorial y telefonoDeOrden con un Firestore simulado.
let ordenes = {};
let historial = {};
const escritos = [];
vi.mock('../../../lib/firebase', () => ({ db: 'db' }));
vi.mock('firebase/firestore', () => {
  class Timestamp { constructor(ms) { this.ms = ms; } static fromDate(d) { return new Timestamp(d.getTime()); } toMillis() { return this.ms; } toDate() { return new Date(this.ms); } }
  let n = 0;
  return {
    Timestamp,
    serverTimestamp: () => 'AHORA',
    collection: (_db, ...ruta) => ({ ruta: ruta.join('/') }),
    doc: (a, ...ruta) => (typeof a === 'object' && a.ruta && ruta.length === 0 ? { ruta: `${a.ruta}/nuevo${++n}`, id: `nuevo${n}` } : { ruta: (a.ruta ? [a.ruta, ...ruta] : ruta).join('/'), id: ruta[ruta.length - 1] }),
    where: (campo, op, valor) => ({ campo, op, valor }),
    limit: () => null, orderBy: () => null, startAfter: () => null,
    query: (ref, ...f) => ({ ruta: ref.ruta, filtros: f.filter(Boolean) }),
    getDoc: async (ref) => {
      const [, , , id] = ref.ruta.split('/');
      const datos = ref.ruta.includes('/ordenes/') ? ordenes[id] : historial[id];
      return { exists: () => datos !== undefined, data: () => datos, id };
    },
    getDocs: async (q) => {
      const docs = Object.entries(historial)
        .filter(([, v]) => q.filtros.every((f) => (f.op === '==' ? v[f.campo] === f.valor : v[f.campo]?.includes(f.valor))))
        .map(([id, v]) => ({ id, data: () => v }));
      return { empty: docs.length === 0, docs };
    },
    setDoc: async (ref, datos) => { escritos.push({ ruta: ref.ruta, datos }); },
    deleteDoc: async () => {},
  };
});

const { agregarOrdenAlHistorial, telefonoDeOrden } = await import('./datos');
const { Timestamp } = await import('firebase/firestore');
const { MENSAJES_HISTORIAL } = await import('../../../../lib/historialTaller');

const ENTREGA = new Timestamp(1000);
const orden = (extra = {}, vehiculo = {}) => ({
  estado: 'entregado', fechaEntrega: ENTREGA, cliente: { nombre: 'Juan', telefono: '6641112233' },
  vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001, kilometraje: 150000, placas: 'abc 123', ...vehiculo },
  trabajos: [{ descripcion: 'Balatas' }], piezas: [{ descripcion: 'Balata' }], expiraAt: new Timestamp(Date.now() + 86400000), ...extra,
});

beforeEach(() => { ordenes = {}; historial = {}; escritos.length = 0; });

describe('agregar una orden al historial', () => {
  it('sin vehículo con esas placas: crea uno nuevo, sin nombre ni teléfono', async () => {
    ordenes.O1 = orden();
    await agregarOrdenAlHistorial({ tallerId: 'T1', folio: 'O1', placasEscritas: '' });
    const { datos } = escritos[0];
    expect(datos).toMatchObject({ placas: 'ABC123', marca: 'Nissan', modelo: 'Sentra', anio: 2001, folios: ['O1'], ultimoFolio: 'O1', ultimoKm: 150000, ultimoServicioAt: ENTREGA });
    expect(datos.servicios).toEqual([{ folio: 'O1', fecha: ENTREGA, kilometraje: 150000, descripcion: 'Balatas', piezas: ['Balata'] }]);
    expect(JSON.stringify(datos)).not.toMatch(/Juan|6641112233|cliente|telefono/);
  });
  it('la orden sin placas usa las que escribe el taller', async () => {
    ordenes.O1 = orden({}, { placas: undefined });
    await agregarOrdenAlHistorial({ tallerId: 'T1', folio: 'O1', placasEscritas: 'xyz 9' });
    expect(escritos[0].datos.placas).toBe('XYZ9');
  });
  it('sin placas en ningún lado, orden no entregada o ya agregada: mensaje claro y no escribe', async () => {
    ordenes.O1 = orden({}, { placas: undefined });
    await expect(agregarOrdenAlHistorial({ tallerId: 'T1', folio: 'O1', placasEscritas: '' })).rejects.toThrow(MENSAJES_HISTORIAL.placas);
    ordenes.O2 = orden({ estado: 'listo' });
    await expect(agregarOrdenAlHistorial({ tallerId: 'T1', folio: 'O2' })).rejects.toThrow(MENSAJES_HISTORIAL.noEntregada);
    ordenes.O3 = orden();
    historial.V1 = { placas: 'ABC123', marca: 'Nissan', modelo: 'Sentra', anio: 2001, servicios: [{}], folios: ['O3'] };
    await expect(agregarOrdenAlHistorial({ tallerId: 'T1', folio: 'O3' })).rejects.toThrow(MENSAJES_HISTORIAL.yaEnHistorial);
    expect(escritos).toHaveLength(0);
  });
  it('con un vehículo con esas placas: agrega el servicio al mismo documento', async () => {
    ordenes.O2 = orden({ fechaEntrega: new Timestamp(2000) }, { kilometraje: 160000 });
    historial.V1 = { placas: 'ABC123', marca: 'Nissan', modelo: 'Sentra', anio: 2001, servicios: [{ folio: 'O1' }], folios: ['O1'], ultimoKm: 150000, ultimoServicioAt: ENTREGA, creadoAt: 'ANTES' };
    const id = await agregarOrdenAlHistorial({ tallerId: 'T1', folio: 'O2' });
    expect(id).toBe('V1');
    expect(escritos[0].ruta).toBe('talleres/T1/historial/V1');
    expect(escritos[0].datos).toMatchObject({ folios: ['O1', 'O2'], ultimoFolio: 'O2', ultimoKm: 160000, creadoAt: 'ANTES' });
    expect(escritos[0].datos.servicios).toHaveLength(2);
  });
  it('mismas placas pero otro vehículo: no lo mezcla', async () => {
    ordenes.O2 = orden({}, { marca: 'Toyota', modelo: 'Corolla', anio: 2020 });
    historial.V1 = { placas: 'ABC123', marca: 'Nissan', modelo: 'Sentra', anio: 2001, servicios: [{}], folios: ['O1'] };
    await expect(agregarOrdenAlHistorial({ tallerId: 'T1', folio: 'O2' })).rejects.toThrow('Esas placas ya están en tu historial con otro vehículo (Nissan Sentra 2001)');
    expect(escritos).toHaveLength(0);
  });
});

describe('teléfono para WhatsApp (leído en el momento, nunca guardado)', () => {
  it('de la orden si existe y no ha vencido; si no, null', async () => {
    ordenes.O1 = orden();
    expect(await telefonoDeOrden('T1', 'O1')).toBe('6641112233');
    expect(await telefonoDeOrden('T1', 'NOEXISTE')).toBeNull();
    ordenes.O2 = orden({ expiraAt: new Timestamp(Date.now() - 1000) });
    expect(await telefonoDeOrden('T1', 'O2')).toBeNull();
    ordenes.O3 = orden({ cliente: {} });
    expect(await telefonoDeOrden('T1', 'O3')).toBeNull();
  });
});
