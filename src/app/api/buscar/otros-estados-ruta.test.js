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
  return { estadoDeYonke, obtenerEstadosCombinado: async () => [{ id: 'jalisco', nombre: 'Jalisco' }, { id: 'sonora', nombre: 'Sonora' }, { id: 'baja-california', nombre: 'Baja California' }] };
});
let bandera = false;
let banderaIp = false;
// Respaldo por vehículo: apagado en las pruebas de otros estados (para no mezclar); sus propias
// pruebas lo encienden al final del archivo.
let banderaRespaldo = false;
vi.mock('../../lib/busqueda/configBuscadorServer', () => ({
  rangoAniosServer: async () => 2, otrosEstadosSinResultadosServer: async () => bandera, otrosEstadosPorIpServer: async () => banderaIp,
  respaldoVehiculoServer: async () => banderaRespaldo,
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

const { POST } = await import('./route.js');

// region: código de Vercel del visitante (ej. 'jal'); sin region = estado por IP desconocido.
const buscar = async ({ estado, pieza = 'Alternador', region, anio = 2016, cilindrada }) => (await POST(new Request('http://x/api/buscar', {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(region ? { 'x-vercel-ip-country': 'MX', 'x-vercel-ip-country-region': region } : {}) },
  body: JSON.stringify({ texto: 'alternador civic 2016', estado, confirmado: { pieza, marca: 'Honda', modelo: 'Civic', anio, ...(cilindrada != null ? { cilindrada } : {}) } }),
}))).json();
const registro = () => registrarBusqueda.mock.calls.at(-1)?.[0];

beforeEach(() => {
  bandera = false; banderaIp = false; banderaRespaldo = false; enCatalogo = true; sinYonkes = false;
  encontrados = { resultados: [], resultadosCercanos: [] };
  respaldo = { resultados: [], cilindradaDistinta: false };
  consultarRespaldoVehiculo.mockClear();
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

  it('sin_inventario: agrega los resultados de otros estados (los que envían primero) y lo registra aparte', async () => {
    const r = await buscar({ estado: 'jalisco' });
    expect(r.estado).toBe('sin_inventario');
    expect(r.otrosEstadosRevisados).toBe(true);
    expect(r.resultadosOtrosEstados).toEqual([{ estado: 'sonora', estadoNombre: 'Sonora', resultados: [
      { yonkeId: 'SON', vehiculoId: 'v1', enviosNacionales: true }, { yonkeId: 'SON-SIN-ENVIOS', vehiculoId: 'v1', enviosNacionales: false },
    ] }]);
    expect(registro()).toMatchObject({ estado: 'sin_inventario', totalResultados: 0, otrosEstados: { mostrados: 2, yonkeIds: ['SON', 'SON-SIN-ENVIOS'] } });
    expect(registro().yonkeIds).toBeUndefined(); // la demanda no cambia: sin yonkeIds de resultado
  });

  it('sin_inventario sin pieza (solo vehículo) también', async () => {
    const r = await buscar({ estado: 'jalisco', pieza: null });
    expect(r.resultadosOtrosEstados[0].resultados.map((x) => x.yonkeId)).toEqual(['SON', 'SON-SIN-ENVIOS']);
    expect(registro()).toMatchObject({ estado: 'sin_inventario', otrosEstados: { mostrados: 2 } });
  });

  it('sin_yonkes_estado: agrega los resultados y registra como sin_inventario', async () => {
    sinYonkes = true;
    const r = await buscar({ estado: 'jalisco' });
    expect(r.estado).toBe('sin_yonkes_estado');
    expect(r.resultadosOtrosEstados[0].estado).toBe('sonora');
    expect(r.busqueda).toEqual({ marca: 'Honda', modelo: 'Civic', anio: 2016, pieza: 'Alternador' });
    expect(registro()).toMatchObject({ estado: 'sin_inventario', otrosEstados: { mostrados: 2, yonkeIds: ['SON', 'SON-SIN-ENVIOS'] } });
  });

  it('no_catalogado: no aplica', async () => {
    enCatalogo = false;
    const r = await buscar({ estado: 'jalisco' });
    expect(r.estado).toBe('no_catalogado');
    expect(r).not.toHaveProperty('resultadosOtrosEstados');
    expect(r).not.toHaveProperty('otrosEstadosRevisados');
    expect(getDocs).not.toHaveBeenCalled();
  });

  it('el cliente de Sonora no ve a los yonkes de su propio estado como "otro estado"', async () => {
    const r = await buscar({ estado: 'sonora' });
    expect(r).not.toHaveProperty('resultadosOtrosEstados');
    // Sí se buscó (sin encontrar nada): la pantalla ya no ofrece el botón viejo.
    expect(r.otrosEstadosRevisados).toBe(true);
    expect(registro()).toMatchObject({ otrosEstados: { mostrados: 0, yonkeIds: [] } });
  });
});

// Tarjetas como las arma consultarInventario (con estadoYonke y enviosNacionales).
const tarjeta = (yonkeId, estadoYonke, enviosNacionales = true, vehiculoId = yonkeId) => ({ yonkeId, vehiculoId, estadoYonke, enviosNacionales });

describe('"Todos los estados" con estado por IP', () => {
  beforeEach(() => { encontrados = { resultados: [tarjeta('SON', 'sonora')], resultadosCercanos: [] }; });

  it('bandera apagada: respuesta idéntica a hoy (sin estadoYonke) y sin soloOtrosEstados', async () => {
    const r = await buscar({ estado: 'todos', region: 'jal' });
    expect(r.estado).toBe('resultados');
    expect(r.resultados).toEqual([{ yonkeId: 'SON', vehiculoId: 'SON', enviosNacionales: true }]);
    expect(r).not.toHaveProperty('sinResultadosEnTuEstado');
    expect(r).not.toHaveProperty('resultadosOtrosEstados');
    expect(r).not.toHaveProperty('busqueda');
    expect(registro()).not.toHaveProperty('soloOtrosEstados');
  });

  describe('bandera encendida', () => {
    beforeEach(() => { banderaIp = true; });

    it('estado por IP desconocido: igual que hoy', async () => {
      const r = await buscar({ estado: 'todos' });
      expect(r).not.toHaveProperty('sinResultadosEnTuEstado');
      expect(r.resultados[0]).not.toHaveProperty('estadoYonke');
      expect(registro()).not.toHaveProperty('soloOtrosEstados');
    });

    it('algún resultado del estado del visitante: igual que hoy', async () => {
      encontrados = { resultados: [tarjeta('SON', 'sonora'), tarjeta('JAL', 'jalisco')], resultadosCercanos: [] };
      const r = await buscar({ estado: 'todos', region: 'jal' });
      expect(r).not.toHaveProperty('sinResultadosEnTuEstado');
      expect(r.resultados.every((x) => !('estadoYonke' in x))).toBe(true);
      expect(registro()).not.toHaveProperty('soloOtrosEstados');
    });

    it('un resultado cercano (año ±1) del estado del visitante cuenta como suyo: igual que hoy', async () => {
      encontrados = { resultados: [tarjeta('SON', 'sonora')], resultadosCercanos: [tarjeta('JAL', 'jalisco', true, 'v2017')] };
      const r = await buscar({ estado: 'todos', region: 'jal' });
      expect(r).not.toHaveProperty('sinResultadosEnTuEstado');
      expect(registro()).not.toHaveProperty('soloOtrosEstados');
    });

    it('visitante de Baja California cuyo único resultado es de un yonke sin estado (cuenta como BC): igual que hoy', async () => {
      encontrados = { resultados: [tarjeta('SIN-ESTADO', 'baja-california')], resultadosCercanos: [] };
      const r = await buscar({ estado: 'todos', region: 'bcn' });
      expect(r).not.toHaveProperty('sinResultadosEnTuEstado');
      expect(registro()).not.toHaveProperty('soloOtrosEstados');
    });

    it('ninguno del estado del visitante: agrega los campos, estado y conResultado no cambian', async () => {
      encontrados = { resultados: [tarjeta('NO-ENVIA', 'sonora', false), tarjeta('SON', 'sonora'), tarjeta('BC', 'baja-california')], resultadosCercanos: [] };
      const r = await buscar({ estado: 'todos', region: 'jal' });
      expect(r.estado).toBe('resultados');
      expect(r.sinResultadosEnTuEstado).toEqual({ estado: 'jalisco', estadoNombre: 'Jalisco' });
      expect(r.resultados.map((x) => x.estadoYonke)).toEqual(['sonora', 'sonora', 'baja-california']);
      expect(r.resultadosOtrosEstados.map((g) => [g.estado, g.resultados.map((x) => x.yonkeId)])).toEqual([['sonora', ['SON', 'NO-ENVIA']], ['baja-california', ['BC']]]);
      expect(r.busqueda).toEqual({ marca: 'Honda', modelo: 'Civic', anio: 2016, pieza: 'Alternador' });
      expect(registro()).toMatchObject({ estado: 'ok', soloOtrosEstados: true, yonkeIds: ['NO-ENVIA', 'SON', 'BC'] });
    });

    it('con un estado elegido (no "Todos"): no aplica', async () => {
      const r = await buscar({ estado: 'sonora', region: 'jal' });
      expect(r).not.toHaveProperty('sinResultadosEnTuEstado');
      expect(registro()).not.toHaveProperty('soloOtrosEstados');
    });
  });
});

describe('respaldo por vehículo (config/buscador.respaldoVehiculo)', () => {
  const corollaPatos = { yonkeId: 'PATOS', vehiculoId: 'c20', estadoYonke: 'baja-california', enviosNacionales: false, coincidePorCilindrada: true };
  beforeEach(() => { banderaRespaldo = true; respaldo = { resultados: [corollaPatos], cilindradaDistinta: false }; });

  it('sin nada y con marca, modelo y año: muestra los vehículos como el respaldo actual y se guarda ok', async () => {
    const r = await buscar({ estado: 'todos' });
    expect(r.estado).toBe('resultados');
    expect(r.piezaNoEncontrada).toBe(true);
    expect(r.resultados).toHaveLength(1);
    expect(r).not.toHaveProperty('avisoCilindradaDistinta');
    expect(registro()).toMatchObject({ estado: 'ok', piezaNoEncontrada: true, totalResultados: 1, yonkeIds: ['PATOS'] });
    expect(consultarRespaldoVehiculo).toHaveBeenCalledWith({ marca: 'Honda', modelo: 'Civic', anio: 2016, cilindrada: null, estado: 'todos' });
  });

  it('también con transmisión + cilindrada (hoy no busca vehículos), pasando la cilindrada', async () => {
    const r = await buscar({ estado: 'baja-california', pieza: 'Transmisión', cilindrada: 1.8 });
    expect(r.estado).toBe('resultados');
    expect(consultarRespaldoVehiculo).toHaveBeenCalledWith(expect.objectContaining({ cilindrada: 1.8, estado: 'baja-california' }));
  });

  it('sin ninguno con esa cilindrada: avisa que puede ser distinta', async () => {
    respaldo = { resultados: [corollaPatos], cilindradaDistinta: true };
    const r = await buscar({ estado: 'todos', pieza: 'Transmisión', cilindrada: 2.5 });
    expect(r.avisoCilindradaDistinta).toBe(true);
  });

  it('bandera apagada (false): igual que hoy, sin buscar el respaldo', async () => {
    banderaRespaldo = false;
    const r = await buscar({ estado: 'todos' });
    expect(r.estado).toBe('sin_inventario');
    expect(consultarRespaldoVehiculo).not.toHaveBeenCalled();
  });

  it('sin año en el texto: no aplica', async () => {
    const r = await buscar({ estado: 'todos', anio: null });
    expect(r.estado).toBe('sin_inventario');
    expect(consultarRespaldoVehiculo).not.toHaveBeenCalled();
  });

  it('si ya hubo resultados normales: no se busca el respaldo', async () => {
    encontrados = { resultados: [{ yonkeId: 'A', vehiculoId: '1', estadoYonke: 'sonora' }], resultadosCercanos: [] };
    await buscar({ estado: 'todos' });
    expect(consultarRespaldoVehiculo).not.toHaveBeenCalled();
  });

  it('si el respaldo tampoco encuentra nada: sin resultado y otros estados como siempre', async () => {
    respaldo = { resultados: [], cilindradaDistinta: false };
    bandera = true;
    const r = await buscar({ estado: 'jalisco' });
    expect(r.estado).toBe('sin_inventario');
    expect(r.resultadosOtrosEstados[0].estado).toBe('sonora');
    expect(registro()).toMatchObject({ estado: 'sin_inventario', otrosEstados: { mostrados: 2 } });
  });

  it('con "Todos" y la IP de otro estado: el respaldo pasa por el reparto de otros estados', async () => {
    banderaIp = true;
    const r = await buscar({ estado: 'todos', region: 'jal' });
    expect(r.sinResultadosEnTuEstado).toEqual({ estado: 'jalisco', estadoNombre: 'Jalisco' });
    expect(registro()).toMatchObject({ estado: 'ok', soloOtrosEstados: true, piezaNoEncontrada: true });
  });
});
