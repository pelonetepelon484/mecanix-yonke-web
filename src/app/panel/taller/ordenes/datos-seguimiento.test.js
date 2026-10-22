import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';

// Firestore simulado: doc() devuelve la ruta; getDoc lee de `guardado`; los lotes se registran.
const guardado = new Map();
const setDoc = vi.fn(async () => {});
const deleteDoc = vi.fn(async () => {});
let lotes = [];
vi.mock('../../../lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), doc: vi.fn((...a) => a.slice(1).join('/')), getDocs: vi.fn(), limit: vi.fn(), orderBy: vi.fn(),
  query: vi.fn(), startAfter: vi.fn(), updateDoc: vi.fn(), deleteField: vi.fn(() => 'BORRAR'), where: vi.fn(),
  serverTimestamp: () => 'HORA_SERVIDOR',
  getDoc: vi.fn(async (ruta) => ({ exists: () => guardado.has(ruta), data: () => guardado.get(ruta) })),
  setDoc: (...a) => setDoc(...a),
  deleteDoc: (...a) => deleteDoc(...a),
  writeBatch: () => {
    const ops = [];
    const lote = { ops, set: (r, d) => ops.push(['set', r, d]), delete: (r) => ops.push(['delete', r]), commit: vi.fn(async () => {}) };
    lotes.push(lote);
    return lote;
  },
}));
// aviso-orden-3 es la versión con seguimiento (en el JSON real todavía no está).
vi.mock('../../../../lib/avisoOrden', async (original) => ({
  ...(await original()), ordenConSeguimiento: (v) => v === 'aviso-orden-3',
}));

const { guardarOrden, activarSeguimiento, guardarNotaSeguimiento, desactivarSeguimiento, borrarOrden, leerSeguimiento } = await import('./datos.js');
const { MENSAJES_SEGUIMIENTO } = await import('../../../../lib/seguimiento');

const DIA = 86400000;
const huella = (t) => createHash('sha256').update(t).digest('hex');
const TOKEN = 'E'.repeat(40) + 'abc';
const FOLIO = 'O261020-ABCD';
const TALLER = { nombre: 'Taller Peña', whatsapp: '6641234567', activo: true };
const ts = (d) => ({ toMillis: () => d.getTime(), toDate: () => d });
const datos = (extra = {}) => ({
  vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001, placas: 'ABC1234' }, cliente: { nombre: 'Juan', telefono: '6641112233' },
  fallaReportada: '', observaciones: '', estadoRecepcion: '', pertenencias: '',
  trabajos: [{ descripcion: 'x', cantidad: 1, precioUnitario: 100 }], piezas: [], estado: 'recibido', ...extra,
});
const ENTREGA = new Date(Date.now() - 5 * DIA);
const ordenEntregada = (extra = {}) => ({
  ...datos({ estado: 'entregado', garantiaDias: 90 }), folio: FOLIO, creadoAt: 'C', avisoVersion: 'aviso-orden-3',
  fechaEntrega: ts(ENTREGA), primeraEntregaAt: ts(ENTREGA), expiraAt: ts(new Date(ENTREGA.getTime() + 98 * DIA)), ...extra,
});

beforeEach(() => {
  guardado.clear(); lotes = []; setDoc.mockClear(); deleteDoc.mockClear();
});

describe('campos de seguimiento en la orden', () => {
  it('v3 creada ya entregada: primeraEntregaAt = hora del servidor; sin token ni nota', async () => {
    await guardarOrden({ tallerId: 'T1', datos: datos({ estado: 'entregado', garantiaDias: 30, notaSeguimiento: 'x' }), avisoVersion: 'aviso-orden-3' });
    const cuerpo = setDoc.mock.calls[0][1];
    expect(cuerpo.primeraEntregaAt).toBe('HORA_SERVIDOR');
    expect('seguimientoToken' in cuerpo).toBe(false);
    expect('notaSeguimiento' in cuerpo).toBe(false);
  });
  it('versión anterior (v2): ningún campo de seguimiento, igual que antes', async () => {
    await guardarOrden({ tallerId: 'T1', datos: datos({ estado: 'entregado', garantiaDias: 30 }), avisoVersion: 'aviso-orden-2' });
    const cuerpo = setDoc.mock.calls[0][1];
    for (const k of ['primeraEntregaAt', 'seguimientoToken', 'notaSeguimiento']) expect(k in cuerpo).toBe(false);
  });
  it('regresa de Entregado: conserva primeraEntregaAt, el token y la nota', async () => {
    const original = ordenEntregada({ seguimientoToken: TOKEN, notaSeguimiento: 'Hola' });
    await guardarOrden({ tallerId: 'T1', folio: FOLIO, datos: datos({ estado: 'listo' }), original, taller: TALLER });
    const cuerpo = setDoc.mock.calls[0][1];   // el enlace no existe: se guarda la orden sola
    expect(cuerpo).toMatchObject({ estado: 'listo', primeraEntregaAt: original.primeraEntregaAt, seguimientoToken: TOKEN, notaSeguimiento: 'Hola' });
    expect('fechaEntrega' in cuerpo).toBe(false);
  });
});

describe('guardar con enlace activo', () => {
  it('reescribe el enlace en el mismo lote: solo campos públicos, vence a los 30 días de la primera entrega', async () => {
    guardado.set(`seguimientos/${huella(TOKEN)}`, { tallerId: 'T1' });
    const original = ordenEntregada({ seguimientoToken: TOKEN });
    await guardarOrden({ tallerId: 'T1', folio: FOLIO, datos: datos({ estado: 'entregado', garantiaDias: 90, observaciones: 'lavado' }), original, taller: TALLER });
    expect(setDoc).not.toHaveBeenCalled();
    const [orden, seg] = lotes[0].ops;
    expect(orden[1]).toBe(`talleres/T1/ordenes/${FOLIO}`);
    expect(seg[1]).toBe(`seguimientos/${huella(TOKEN)}`);
    expect(Object.keys(seg[2]).sort()).toEqual(['actualizadoAt', 'anio', 'estado', 'expiraAt', 'folio', 'marca', 'modelo', 'nota', 'tallerId', 'tallerNombre', 'tallerWhatsapp']);
    expect(seg[2]).toMatchObject({ tallerId: 'T1', folio: FOLIO, tallerNombre: 'Taller Peña', tallerWhatsapp: '6641234567', estado: 'entregado', nota: '', actualizadoAt: 'HORA_SERVIDOR' });
    expect(seg[2].expiraAt.getTime()).toBe(ENTREGA.getTime() + 30 * DIA);
    expect(JSON.stringify(seg[2])).not.toMatch(/ABC1234|Juan|6641112233/);
  });
  it('entregar AHORA con enlace activo: vence 30 días después de hoy (menos el margen del reloj)', async () => {
    guardado.set(`seguimientos/${huella(TOKEN)}`, { tallerId: 'T1' });
    const original = { ...datos(), folio: FOLIO, creadoAt: 'C', avisoVersion: 'aviso-orden-3', seguimientoToken: TOKEN, expiraAt: ts(new Date(Date.now() + 80 * DIA)) };
    await guardarOrden({ tallerId: 'T1', folio: FOLIO, datos: datos({ estado: 'entregado', garantiaDias: 365 }), original, taller: TALLER });
    const [orden, seg] = lotes[0].ops;
    expect(orden[2].primeraEntregaAt).toBe('HORA_SERVIDOR');
    expect(Math.abs(seg[2].expiraAt.getTime() - (Date.now() + 30 * DIA - 10 * 60000))).toBeLessThan(5000);
  });
});

describe('activar, nota, desactivar y borrar', () => {
  it('orden anterior al aviso con seguimiento: no se activa', async () => {
    guardado.set(`talleres/T1/ordenes/${FOLIO}`, { ...ordenEntregada(), avisoVersion: 'aviso-orden-2' });
    await expect(activarSeguimiento({ tallerId: 'T1', folio: FOLIO, taller: TALLER })).rejects.toThrow(MENSAJES_SEGUIMIENTO.anteriorAlAviso);
  });
  it('activar: token nuevo de 43 caracteres en la orden y el enlace con su huella, en un lote', async () => {
    guardado.set(`talleres/T1/ordenes/${FOLIO}`, ordenEntregada());
    const token = await activarSeguimiento({ tallerId: 'T1', folio: FOLIO, taller: TALLER });
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const [orden, seg] = lotes[0].ops;
    expect(orden[2].seguimientoToken).toBe(token);
    expect(seg[0]).toBe('set');
    expect(seg[1]).toBe(`seguimientos/${huella(token)}`);
    expect(lotes[0].commit).toHaveBeenCalled();
  });
  it('reactivar: borra el enlace anterior en el mismo lote', async () => {
    guardado.set(`talleres/T1/ordenes/${FOLIO}`, ordenEntregada({ seguimientoToken: TOKEN }));
    const token = await activarSeguimiento({ tallerId: 'T1', folio: FOLIO, taller: TALLER });
    expect(token).not.toBe(TOKEN);
    expect(lotes[0].ops.map(([op, ruta]) => [op, ruta])).toEqual([
      ['set', `talleres/T1/ordenes/${FOLIO}`], ['delete', `seguimientos/${huella(TOKEN)}`], ['set', `seguimientos/${huella(token)}`],
    ]);
  });
  it('pasaron 30 días desde la primera entrega: ya no se activa', async () => {
    const vieja = new Date(Date.now() - 31 * DIA);
    guardado.set(`talleres/T1/ordenes/${FOLIO}`, ordenEntregada({ primeraEntregaAt: ts(vieja), fechaEntrega: ts(vieja), expiraAt: ts(new Date(Date.now() + 60 * DIA)) }));
    await expect(activarSeguimiento({ tallerId: 'T1', folio: FOLIO, taller: TALLER })).rejects.toThrow(MENSAJES_SEGUIMIENTO.vencido);
    expect(lotes).toEqual([]);
  });
  it('nota: con teléfono o «@» no se guarda; bien, va a la orden y al enlace', async () => {
    guardado.set(`talleres/T1/ordenes/${FOLIO}`, ordenEntregada({ seguimientoToken: TOKEN }));
    guardado.set(`seguimientos/${huella(TOKEN)}`, { tallerId: 'T1' });
    await expect(guardarNotaSeguimiento({ tallerId: 'T1', folio: FOLIO, nota: 'Llama al 664 123 4567', taller: TALLER })).rejects.toThrow(MENSAJES_SEGUIMIENTO.notaTelefono);
    await expect(guardarNotaSeguimiento({ tallerId: 'T1', folio: FOLIO, nota: 'a@b.mx', taller: TALLER })).rejects.toThrow(MENSAJES_SEGUIMIENTO.notaCorreo);
    expect(lotes).toEqual([]);
    await guardarNotaSeguimiento({ tallerId: 'T1', folio: FOLIO, nota: ' Pase mañana ', taller: TALLER });
    const [orden, seg] = lotes[0].ops;
    expect(orden[2].notaSeguimiento).toBe('Pase mañana');
    expect(seg[2].nota).toBe('Pase mañana');
  });
  it('desactivar: borra SOLO el enlace (no escribe la orden)', async () => {
    await desactivarSeguimiento(TOKEN);
    expect(deleteDoc).toHaveBeenCalledWith(`seguimientos/${huella(TOKEN)}`);
    expect(setDoc).not.toHaveBeenCalled();
    expect(lotes).toEqual([]);
  });
  it('borrar una orden con enlace: orden y enlace en un lote; sin enlace, como siempre', async () => {
    await borrarOrden('T1', FOLIO, { seguimientoToken: TOKEN });
    expect(lotes[0].ops).toEqual([['delete', `talleres/T1/ordenes/${FOLIO}`], ['delete', `seguimientos/${huella(TOKEN)}`]]);
    await borrarOrden('T1', 'O261020-OTRA', {});
    expect(deleteDoc).toHaveBeenCalledWith('talleres/T1/ordenes/O261020-OTRA');
  });
  it('leerSeguimiento: null si no existe o si no hay token', async () => {
    expect(await leerSeguimiento(TOKEN)).toBeNull();
    expect(await leerSeguimiento(null)).toBeNull();
    guardado.set(`seguimientos/${huella(TOKEN)}`, { estado: 'listo' });
    expect(await leerSeguimiento(TOKEN)).toEqual({ estado: 'listo' });
  });
});
