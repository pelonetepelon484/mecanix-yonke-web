import { describe, expect, it, vi } from 'vitest';

// config/pedidosClientes.alertasPortadaTodos (servidor): solo true exacto la enciende y exige también
// habilitado, alertasPortada y otrosEstados. Firestore simulado; el módulo se recarga en cada caso
// porque guarda la configuración 1 minuto.
let config = null;
vi.mock('firebase/app', () => ({ getApps: () => [], initializeApp: () => ({}) }));
vi.mock('firebase/auth', () => ({ getAuth: () => ({}), signInWithEmailAndPassword: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  getFirestore: () => ({}), doc: (...a) => a.slice(1).join('/'), collection: vi.fn(), query: vi.fn(), where: vi.fn(),
  orderBy: vi.fn(), limit: vi.fn(), getDocs: vi.fn(), setDoc: vi.fn(), addDoc: vi.fn(), runTransaction: vi.fn(),
  serverTimestamp: vi.fn(), Timestamp: { fromDate: (d) => d }, increment: vi.fn(), writeBatch: vi.fn(), deleteDoc: vi.fn(), updateDoc: vi.fn(),
  getDoc: vi.fn(async () => ({ exists: () => config !== null, data: () => config })),
}));
vi.mock('../firebaseConfig', () => ({ firebaseConfig: {} }));
vi.mock('../busqueda/estadosServer', () => ({ obtenerEstadosCombinado: async () => [] }));
vi.mock('../notificarAdmin', () => ({ notificarAdmin: vi.fn() }));
vi.mock('../avisosPush/servicio', () => ({ crearAvisarYonkesReal: () => vi.fn() }));

async function bandera(conf) {
  config = conf;
  vi.resetModules();
  const { alertasPortadaTodos } = await import('./servicio');
  return alertasPortadaTodos({});
}

const TODAS = { habilitado: true, alertasPortada: true, otrosEstados: true };

describe('alertasPortadaTodos (servidor)', () => {
  it('encendida solo con true exacto y las otras tres banderas', async () => {
    expect(await bandera({ ...TODAS, alertasPortadaTodos: true })).toBe(true);
  });
  it('apagada sin documento, sin el campo, con false o con otro valor', async () => {
    for (const conf of [null, TODAS, { ...TODAS, alertasPortadaTodos: false }, { ...TODAS, alertasPortadaTodos: 'true' }, { ...TODAS, alertasPortadaTodos: 1 }]) {
      expect(await bandera(conf)).toBe(false);
    }
  });
  it('apagada si falta habilitado, alertasPortada u otrosEstados', async () => {
    for (const falta of ['habilitado', 'alertasPortada', 'otrosEstados']) {
      expect(await bandera({ ...TODAS, [falta]: false, alertasPortadaTodos: true })).toBe(false);
    }
  });
});
