import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';

// crearSolicitud: el pedido se guarda primero; el aviso al admin va solo con el número del pedido
// y el pase del taller, y si falla o se topa con el límite, el pedido NO falla.
const lotes = [];
vi.mock('firebase/firestore', () => ({
  collection: (_db, ...ruta) => ({ ruta: ruta.join('/') }),
  doc: (base, ...ruta) => (ruta.length === 0 ? { id: 'SOL123' } : { ruta: ruta.join('/') }),
  writeBatch: () => {
    const lote = { escrituras: [], set: (ref, datos) => lote.escrituras.push([ref, datos]), commit: async () => { lotes.push(lote); } };
    return lote;
  },
  serverTimestamp: () => 'ahora', getDoc: vi.fn(), getDocs: vi.fn(), onSnapshot: vi.fn(), orderBy: vi.fn(), query: vi.fn(), updateDoc: vi.fn(), where: vi.fn(),
}));
let usuario = { getIdToken: async () => 'pase-del-taller' };
vi.mock('../../../lib/firebase', () => ({ db: {}, get auth() { return { currentUser: usuario }; } }));

const { crearSolicitud } = await import('./datos');
const datos = { tallerId: 'T1', tallerNombre: 'Taller', tallerWhatsapp: '6641234567', estado: 'baja-california', vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2010 }, pieza: 'Alternador', nota: '' };

let llamadas;
beforeEach(() => {
  lotes.length = 0;
  llamadas = [];
  usuario = { getIdToken: async () => 'pase-del-taller' };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('pedido de pieza del taller: aviso al admin', () => {
  it('manda solo el número del pedido y el pase de sesión', async () => {
    vi.stubGlobal('fetch', async (ruta, opciones) => { llamadas.push([ruta, opciones]); return { ok: true, json: async () => ({ ok: true, avisado: true }) }; });
    expect(await crearSolicitud(datos)).toBe('SOL123');
    expect(lotes).toHaveLength(1);
    const [ruta, opciones] = llamadas[0];
    expect(ruta).toBe('/api/notificar-solicitud-pieza');
    expect(opciones.headers.Authorization).toBe('Bearer pase-del-taller');
    expect(JSON.parse(opciones.body)).toEqual({ solicitudId: 'SOL123' });
  });
  for (const [caso, falsoFetch] of [
    ['sin red', async () => { throw new TypeError('Failed to fetch'); }],
    ['límite alcanzado', async () => ({ ok: false, status: 429, json: async () => ({ ok: false, avisado: false, motivo: 'limite' }) })],
    ['servidor sin usuario de servicio', async () => ({ ok: false, status: 503, json: async () => ({}) })],
  ]) {
    it(`si el aviso falla (${caso}), el pedido se guarda igual`, async () => {
      vi.stubGlobal('fetch', falsoFetch);
      expect(await crearSolicitud(datos)).toBe('SOL123');
      expect(lotes).toHaveLength(1);
    });
  }
  it('si no se puede obtener el pase de sesión, el pedido se guarda igual (sin aviso)', async () => {
    const fetchFalso = vi.fn();
    vi.stubGlobal('fetch', fetchFalso);
    usuario = { getIdToken: async () => { throw new Error('auth/network-request-failed'); } };
    expect(await crearSolicitud(datos)).toBe('SOL123');
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});
