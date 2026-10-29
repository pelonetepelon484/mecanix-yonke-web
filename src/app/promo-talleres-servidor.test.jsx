import { describe, expect, it, vi } from 'vitest';

// page.js (servidor) lee config/talleres y le pasa los meses de la promoción a HomeClient.
let docs = {};
let propsRecibidas = null;
vi.mock('./HomeClient', () => ({ default: (props) => { propsRecibidas = props; return null; } }));
vi.mock('./lib/firebase-server', () => ({ dbServer: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (...a) => a.slice(1).join('/'),
  collection: (...a) => a.slice(1).join('/'),
  getDoc: vi.fn(async (ruta) => ({ exists: () => ruta in docs, data: () => docs[ruta] })),
  getDocs: vi.fn(async () => ({ docs: [], empty: true, size: 0, forEach: () => {} })),
}));
vi.mock('./lib/busqueda/estadosServer', () => ({
  ESTADO_DEFAULT: 'baja-california', estadoDeYonke: () => 'baja-california',
  obtenerEstadosCombinado: async () => [{ id: 'baja-california', nombre: 'Baja California' }],
}));
vi.mock('./lib/busqueda/configBuscadorServer', () => ({ rangoAniosServer: async () => null }));
vi.mock('./lib/refaccionariaPublica', () => ({ buscadorRefaccionesEncendido: async () => false }));

const { default: Home } = await import('./page.js');

describe('portada (servidor): promoción de talleres', () => {
  it('apagada o sin documento: null; encendida: los meses', async () => {
    const pintar = async () => { const el = await Home(); el.type(el.props); };
    await pintar();
    expect(propsRecibidas.mesesPromoTaller).toBeNull();
    docs['config/talleres'] = { premiumGratisHabilitado: true, mesesPremiumGratis: 3 };
    await pintar();
    expect(propsRecibidas.mesesPromoTaller).toBe(3);
  });
});
