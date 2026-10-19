import { beforeEach, describe, expect, it, vi } from 'vitest';

// /api/buscar con "resultados de otros estados" (config/buscador.otrosEstadosSinResultados).
// Todo lo de Firestore está simulado; otrosEstados.js es el real (con la lista de yonkes simulada).
const yonkesDocs = [
  { id: 'SON', data: () => ({ activo: true, verificado: true, enviosNacionales: true, estado: 'sonora' }) },
  { id: 'SON-SIN-ENVIOS', data: () => ({ activo: true, verificado: true, estado: 'sonora' }) },
];
const getDocs = vi.fn(async () => ({ docs: yonkesDocs }));
vi.mock('firebase/firestore', () => ({ addDoc: vi.fn(), collection: () => 'c', getDocs: (...a) => getDocs(...a), doc: () => 'd', getDoc: async () => ({ exists: () => false }) }));
vi.mock('../../lib/firebase-server', () => ({ dbServer: {} }));
vi.mock('../../lib/firebase', () => ({ db: {}, auth: {} }));
vi.mock('../../lib/busqueda/rateLimit', () => ({ permitirBusqueda: async () => true, MENSAJE_RATE_LIMIT: 'x' }));
const registrarBusqueda = vi.fn();
vi.mock('../../lib/busqueda/registrarBusqueda', () => ({ registrarBusqueda: (...a) => registrarBusqueda(...a) }));
vi.mock('../../lib/busqueda/filtroPrevio', () => ({ filtrarPrevio: () => ({ permitido: true }), MENSAJE_RECHAZO_CAPA0: 'x' }));
vi.mock('../../lib/busqueda/extraerIntencion', () => ({ extraerIntencion: vi.fn() }));
vi.mock('../../lib/busqueda/sinonimosPiezas', () => ({ obtenerSinonimosCombinados: async () => ({}) }));
vi.mock('../../lib/busqueda/detectarFueraDeGiro', () => ({ detectarFueraDeGiro: async () => ({ esFueraDeGiro: false }) }));
vi.mock('../../lib/notificarAdmin', () => ({ notificarAdmin: vi.fn() }));
vi.mock('../../lib/busqueda/contactoPendiente', () => ({ crearPersistirContacto: () => async () => {}, mensajeSinInventario: () => 'Sin inventario' }));
vi.mock('../../lib/busqueda/banderaPedidosClientesServer', () => ({ inventarioVehiculosActivoServer: async () => false, pedidosClientesActivos: async () => false }));
vi.mock('../../lib/busqueda/estadosServer', async () => {
  const { estadoDeYonke } = await import('../../lib/estados');
  return { estadoDeYonke, obtenerEstadosCombinado: async () => [{ id: 'jalisco', nombre: 'Jalisco' }, { id: 'sonora', nombre: 'Sonora' }] };
});
let bandera = false;
vi.mock('../../lib/busqueda/configBuscadorServer', () => ({ rangoAniosServer: async () => 2, otrosEstadosSinResultadosServer: async () => bandera }));

// Inventario: en el estado del cliente nada (o ningún yonke); en otros estados, lo que diga `otros`.
let enCatalogo = true;
let sinYonkes = false;
const vacioMotores = { motores: [], transmisiones: [], motoresCercanos: [], transmisionesCercanos: [] };
vi.mock('../../lib/busqueda/consultarInventario', () => ({
  existeEnCatalogoVivo: async () => enCatalogo,
  consultarInventario: async () => ({ resultados: [], resultadosCercanos: [], tipoResultado: 'cercano', piezaNoEncontrada: false }),
  consultarInventarioVehiculo: async () => ({ resultados: [], resultadosCercanos: [], tipoResultado: 'cercano' }),
  consultarMotoresTransmisiones: async () => ({ ...vacioMotores, sinYonkesEnEstado: sinYonkes }),
  consultarVehiculosAlerta: async () => [],
  consultarInventarioEnYonkes: async (docs) => ({ resultados: docs.map((d) => ({ yonkeId: d.id, vehiculoId: 'v1' })), resultadosCercanos: [], piezaNoEncontrada: false }),
  consultarInventarioVehiculoEnYonkes: async (docs) => ({ resultados: docs.map((d) => ({ yonkeId: d.id, vehiculoId: 'v2' })), resultadosCercanos: [] }),
  consultarMotoresTransmisionesEnYonkes: async () => vacioMotores,
}));

const { POST } = await import('./route.js');

const buscar = async ({ estado, pieza = 'Alternador' }) => (await POST(new Request('http://x/api/buscar', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ texto: 'alternador civic 2016', estado, confirmado: { pieza, marca: 'Honda', modelo: 'Civic', anio: 2016 } }),
}))).json();
const registro = () => registrarBusqueda.mock.calls.at(-1)?.[0];

beforeEach(() => {
  bandera = false; enCatalogo = true; sinYonkes = false;
  registrarBusqueda.mockClear(); getDocs.mockClear();
});

describe('bandera apagada: todo como siempre', () => {
  it('sin_inventario con estado elegido: misma respuesta y mismo registro, sin buscar en otros estados', async () => {
    const r = await buscar({ estado: 'jalisco' });
    expect(Object.keys(r).sort()).toEqual(['busqueda', 'estado', 'mensaje']);
    expect(r.estado).toBe('sin_inventario');
    expect(registro()).not.toHaveProperty('otrosEstados');
    expect(getDocs).not.toHaveBeenCalled();
  });

  it('sin_yonkes_estado: igual que siempre (sin registrar)', async () => {
    sinYonkes = true;
    const r = await buscar({ estado: 'jalisco' });
    expect(Object.keys(r).sort()).toEqual(['estado', 'mensaje']);
    expect(registrarBusqueda).not.toHaveBeenCalled();
  });
});

describe('bandera encendida', () => {
  beforeEach(() => { bandera = true; });

  it('con "Todos los estados" no aplica', async () => {
    const r = await buscar({ estado: 'todos' });
    expect(r).not.toHaveProperty('resultadosOtrosEstados');
    expect(registro()).not.toHaveProperty('otrosEstados');
    expect(getDocs).not.toHaveBeenCalled();
  });

  it('sin_inventario: agrega los resultados de otros estados (solo yonkes que envían) y lo registra aparte', async () => {
    const r = await buscar({ estado: 'jalisco' });
    expect(r.estado).toBe('sin_inventario');
    expect(r.resultadosOtrosEstados).toEqual([{ estado: 'sonora', estadoNombre: 'Sonora', resultados: [{ yonkeId: 'SON', vehiculoId: 'v1' }] }]);
    expect(registro()).toMatchObject({ estado: 'sin_inventario', totalResultados: 0, otrosEstados: { mostrados: 1, yonkeIds: ['SON'] } });
    expect(registro().yonkeIds).toBeUndefined(); // la demanda no cambia: sin yonkeIds de resultado
  });

  it('sin_inventario sin pieza (solo vehículo) también', async () => {
    const r = await buscar({ estado: 'jalisco', pieza: null });
    expect(r.resultadosOtrosEstados[0].resultados).toEqual([{ yonkeId: 'SON', vehiculoId: 'v2' }]);
    expect(registro()).toMatchObject({ estado: 'sin_inventario', otrosEstados: { mostrados: 1 } });
  });

  it('sin_yonkes_estado: agrega los resultados y registra como sin_inventario', async () => {
    sinYonkes = true;
    const r = await buscar({ estado: 'jalisco' });
    expect(r.estado).toBe('sin_yonkes_estado');
    expect(r.resultadosOtrosEstados[0].estado).toBe('sonora');
    expect(registro()).toMatchObject({ estado: 'sin_inventario', otrosEstados: { mostrados: 1, yonkeIds: ['SON'] } });
  });

  it('no_catalogado: no aplica', async () => {
    enCatalogo = false;
    const r = await buscar({ estado: 'jalisco' });
    expect(r.estado).toBe('no_catalogado');
    expect(r).not.toHaveProperty('resultadosOtrosEstados');
    expect(getDocs).not.toHaveBeenCalled();
  });

  it('el cliente de Sonora no ve a los yonkes de su propio estado como "otro estado"', async () => {
    const r = await buscar({ estado: 'sonora' });
    expect(r).not.toHaveProperty('resultadosOtrosEstados');
    expect(registro()).toMatchObject({ otrosEstados: { mostrados: 0, yonkeIds: [] } });
  });
});
