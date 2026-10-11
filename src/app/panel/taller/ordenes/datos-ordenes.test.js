import { describe, expect, it, vi, beforeEach } from 'vitest';

const setDoc = vi.fn(async () => {});
vi.mock('../../../lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), doc: vi.fn((...a) => a.slice(1).join('/')), getDoc: vi.fn(), getDocs: vi.fn(), limit: vi.fn(), orderBy: vi.fn(),
  query: vi.fn(), startAfter: vi.fn(), updateDoc: vi.fn(), deleteDoc: vi.fn(), deleteField: vi.fn(() => 'BORRAR'), where: vi.fn(),
  serverTimestamp: () => 'HORA_SERVIDOR',
  setDoc: (...a) => setDoc(...a),
}));

const { guardarOrden } = await import('./datos.js');
const DIA = 86400000;
const datos = (extra = {}) => ({
  vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 }, fallaReportada: '', observaciones: '', estadoRecepcion: '', pertenencias: '',
  trabajos: [{ descripcion: 'x', cantidad: 1, precioUnitario: 100 }], piezas: [], estado: 'recibido', ...extra,
});
const cuerpo = () => setDoc.mock.calls[0][1];
const cerca = (fecha, ms) => Math.abs(fecha.getTime() - (Date.now() + ms)) < 5000;

beforeEach(() => setDoc.mockClear());

describe('lo que se guarda (debe cuadrar con las reglas)', () => {
  it('nueva: folio "O...", sin datos del cliente, borrado a 88 días, versión del aviso', async () => {
    const folio = await guardarOrden({ tallerId: 'T1', datos: datos(), avisoVersion: 'aviso-orden-0' });
    expect(folio).toMatch(/^O[0-9]{6}-[A-Z0-9]{4}$/);
    expect(cuerpo()).toMatchObject({ tallerId: 'T1', cliente: {}, totalCentavos: 10000, creadoAt: 'HORA_SERVIDOR', actualizadoAt: 'HORA_SERVIDOR', avisoVersion: 'aviso-orden-0' });
    expect(cerca(cuerpo().expiraAt, 88 * DIA)).toBe(true);
    expect('garantiaDias' in cuerpo()).toBe(false);
  });
  it('al entregar: fecha de entrega del servidor y borrado = hoy + garantía + 8', async () => {
    const original = { estado: 'listo', creadoAt: 'C', avisoVersion: 'a' };
    await guardarOrden({ tallerId: 'T1', folio: 'O251011-7KQ4', datos: datos({ estado: 'entregado', garantiaDias: 30 }), original });
    expect(cuerpo()).toMatchObject({ estado: 'entregado', garantiaDias: 30, fechaEntrega: 'HORA_SERVIDOR', creadoAt: 'C', avisoVersion: 'a' });
    expect(cerca(cuerpo().expiraAt, 38 * DIA)).toBe(true);
  });
  it('regresa de entregada: sin garantía ni fecha de entrega y borrado a 88 días desde este guardado', async () => {
    const entrega = new Date(Date.now() - 5 * DIA);
    const original = { estado: 'entregado', garantiaDias: 30, fechaEntrega: { toDate: () => entrega }, expiraAt: 'VIEJA', creadoAt: 'C', avisoVersion: 'a' };
    await guardarOrden({ tallerId: 'T1', folio: 'O251011-7KQ4', datos: datos({ estado: 'reparacion' }), original });
    expect('garantiaDias' in cuerpo()).toBe(false);
    expect('fechaEntrega' in cuerpo()).toBe(false);
    expect(cerca(cuerpo().expiraAt, 88 * DIA)).toBe(true);
  });
  it('entregada sin cambiar la garantía: conserva la fecha de entrega y el borrado', async () => {
    const ts = { toDate: () => new Date(Date.now() - 5 * DIA) };
    const original = { estado: 'entregado', garantiaDias: 30, fechaEntrega: ts, expiraAt: 'MISMA', creadoAt: 'C', avisoVersion: 'a' };
    await guardarOrden({ tallerId: 'T1', folio: 'O251011-7KQ4', datos: datos({ estado: 'entregado', garantiaDias: 30, observaciones: 'lavado' }), original });
    expect(cuerpo()).toMatchObject({ fechaEntrega: ts, expiraAt: 'MISMA', garantiaDias: 30 });
  });
});
