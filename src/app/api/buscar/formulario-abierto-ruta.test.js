import { beforeEach, describe, expect, it, vi } from 'vitest';

// /api/buscar con config/pedidosClientes.formularioAbierto: el servidor avisa en la respuesta que el
// formulario de la alerta sale abierto, solo en las búsquedas sin resultado. Mismo armado que
// otros-estados-ruta.test.js; Firestore simulado.
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
let formularioAbierto = false; // true, false o 'falla'
vi.mock('../../lib/busqueda/banderaPedidosClientesServer', () => ({
  inventarioVehiculosActivoServer: async () => false, pedidosClientesActivos: async () => true,
  formularioAbiertoServer: async () => { if (formularioAbierto === 'falla') throw new Error('sin red'); return formularioAbierto; },
}));
vi.mock('../../lib/busqueda/estadosServer', async () => {
  const { estadoDeYonke } = await import('../../lib/estados');
  return { estadoDeYonke, obtenerEstadosCombinado: async () => [{ id: 'jalisco', nombre: 'Jalisco' }, { id: 'sonora', nombre: 'Sonora' }, { id: 'baja-california', nombre: 'Baja California' }] };
});
let bandera = false;
let banderaScroll = false; // config/buscador.scrollOtrosEstados (true, false o 'falla')
let banderaIp = false;
// Respaldo por vehículo: apagado en las pruebas de otros estados (para no mezclar); sus propias
// pruebas lo encienden al final del archivo.
let banderaRespaldo = false;
vi.mock('../../lib/busqueda/configBuscadorServer', () => ({
  rangoAniosServer: async () => 2, otrosEstadosSinResultadosServer: async () => bandera, otrosEstadosPorIpServer: async () => banderaIp,
  respaldoVehiculoServer: async () => banderaRespaldo,
  scrollOtrosEstadosServer: async () => { if (banderaScroll === 'falla') throw new Error('sin red'); return banderaScroll; },
}));

// Inventario: en el estado del cliente nada (o ningún yonke); en otros estados, lo que diga `otros`.
let enCatalogo = true;
let sinYonkes = false;
// Resultados de la búsqueda normal (para "Todos" por IP); vacío = sin inventario.
let encontrados = { resultados: [], resultadosCercanos: [] };
let respaldo = { resultados: [], cilindradaDistinta: false };
const consultarRespaldoVehiculo = vi.fn(async () => respaldo);
const vacioMotores = { motores: [], transmisiones: [], motoresCercanos: [], transmisionesCercanos: [] };
vi.mock('../../lib/busqueda/consultarInventario', () => ({
  existeEnCatalogoVivo: async () => enCatalogo,
  consultarInventario: async () => ({ ...encontrados, tipoResultado: 'exacto', piezaNoEncontrada: false }),
  consultarInventarioVehiculo: async () => ({ resultados: [], resultadosCercanos: [], tipoResultado: 'cercano' }),
  consultarMotoresTransmisiones: async () => ({ ...vacioMotores, sinYonkesEnEstado: sinYonkes }),
  consultarVehiculosAlerta: async () => [],
  consultarRespaldoVehiculo: (...a) => consultarRespaldoVehiculo(...a),
  consultarInventarioEnYonkes: async (docs) => ({ resultados: docs.map((d) => ({ yonkeId: d.id, vehiculoId: 'v1', enviosNacionales: d.data().enviosNacionales === true })), resultadosCercanos: [], piezaNoEncontrada: false }),
  consultarInventarioVehiculoEnYonkes: async (docs) => ({ resultados: docs.map((d) => ({ yonkeId: d.id, vehiculoId: 'v2', enviosNacionales: d.data().enviosNacionales === true })), resultadosCercanos: [] }),
  consultarMotoresTransmisionesEnYonkes: async () => vacioMotores,
}));

const { POST, admiteFormularioAbierto } = await import('./route.js');

const buscar = async ({ estado = 'jalisco', region, texto = 'alternador civic 2016' } = {}) => (await POST(new Request('http://x/api/buscar', {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(region ? { 'x-vercel-ip-country': 'MX', 'x-vercel-ip-country-region': region } : {}) },
  body: JSON.stringify({ texto, estado, confirmado: { pieza: 'Alternador', marca: 'Honda', modelo: 'Civic', anio: 2016 } }),
}))).json();

beforeEach(() => {
  formularioAbierto = false; bandera = false; banderaIp = false; banderaRespaldo = false; enCatalogo = true; sinYonkes = false;
  encontrados = { resultados: [], resultadosCercanos: [] };
});

describe('qué respuestas admiten el formulario abierto', () => {
  it('solo sin_inventario, no_catalogado, sin_yonkes_estado y "resultados" que solo hay en otros estados', () => {
    for (const estado of ['sin_inventario', 'no_catalogado', 'sin_yonkes_estado']) expect(admiteFormularioAbierto({ estado })).toBe(true);
    expect(admiteFormularioAbierto({ estado: 'resultados', sinResultadosEnTuEstado: { estado: 'jalisco', estadoNombre: 'Jalisco' } })).toBe(true);
    for (const data of [{ estado: 'resultados' }, { estado: 'pieza_sin_vehiculo' }, { estado: 'numero_de_parte' }, { estado: 'confirmar' },
      { estado: 'fuera_de_giro' }, { estado: 'rate_limited' }, null]) {
      expect(admiteFormularioAbierto(data)).toBe(false);
    }
  });
});

describe('bandera apagada (o sin el campo): la respuesta queda igual que hoy', () => {
  it('sin_inventario y sin_yonkes_estado sin formularioAbierto', async () => {
    const r = await buscar();
    expect(r.estado).toBe('sin_inventario');
    expect(Object.keys(r).sort()).toEqual(['busqueda', 'estado', 'mensaje']);
    sinYonkes = true;
    expect(await buscar()).not.toHaveProperty('formularioAbierto');
  });
  it('si la bandera no se puede leer, igual que apagada', async () => {
    formularioAbierto = 'falla';
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await buscar()).not.toHaveProperty('formularioAbierto');
    error.mockRestore();
  });
});

describe('bandera encendida', () => {
  beforeEach(() => { formularioAbierto = true; });
  it('sin_inventario: la respuesta de siempre más formularioAbierto', async () => {
    const r = await buscar();
    expect(r).toMatchObject({ estado: 'sin_inventario', formularioAbierto: true });
    expect(Object.keys(r).sort()).toEqual(['busqueda', 'estado', 'formularioAbierto', 'mensaje']);
  });
  it('sin_yonkes_estado y no_catalogado: también', async () => {
    sinYonkes = true;
    expect(await buscar()).toMatchObject({ estado: 'sin_yonkes_estado', formularioAbierto: true });
    sinYonkes = false; enCatalogo = false;
    expect(await buscar()).toMatchObject({ estado: 'no_catalogado', formularioAbierto: true });
  });
  it('con resultados en el estado del cliente: no', async () => {
    encontrados = { resultados: [{ yonkeId: 'A', vehiculoId: 'v' }], resultadosCercanos: [] };
    const r = await buscar();
    expect(r.estado).toBe('resultados');
    expect(r).not.toHaveProperty('formularioAbierto');
  });
});
