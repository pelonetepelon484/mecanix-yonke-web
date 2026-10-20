import { describe, expect, it, vi } from 'vitest';

vi.mock('../firebase-server', () => ({ dbServer: {} }));
vi.mock('../firebase', () => ({ db: {}, auth: {} }));
vi.mock('firebase/firestore', () => ({ collection: () => 'yonkes', getDocs: async () => ({ docs: [] }), doc: () => 'doc', getDoc: async () => ({ exists: () => false }) }));
vi.mock('./consultarInventario', () => ({
  consultarInventarioEnYonkes: vi.fn(), consultarInventarioVehiculoEnYonkes: vi.fn(), consultarMotoresTransmisionesEnYonkes: vi.fn(),
}));
vi.mock('./estadosServer', async () => {
  const { estadoDeYonke } = await import('../estados');
  return { estadoDeYonke, obtenerEstadosCombinado: async () => ESTADOS };
});

const ESTADOS = [{ id: 'baja-california', nombre: 'Baja California' }, { id: 'sonora', nombre: 'Sonora' }, { id: 'jalisco', nombre: 'Jalisco' }];
const {
  yonkesElegiblesOtrosEstados, agruparPorEstado, buscarEnOtrosEstados, otrosEstadosSiAplica,
  camposRespuestaOtrosEstados, camposRegistroOtrosEstados,
} = await import('./otrosEstados');
const inv = await import('./consultarInventario');

const BUENO = { activo: true, verificado: true, enviosNacionales: true };
const yonke = (id, datos) => ({ id, data: () => datos });
const enAnio = new Date(Date.now() + 30 * 864e5);

describe('qué yonkes entran', () => {
  it('activos, Verificados y de otro estado, con o sin envíos (los que envían primero); sin estado = Baja California', () => {
    const docs = [
      yonke('ok-son', { ...BUENO, estado: 'sonora' }),
      yonke('sin-verificar', { ...BUENO, verificado: false, estado: 'sonora' }),
      yonke('sin-envios', { ...BUENO, enviosNacionales: false, estado: 'sonora' }),
      yonke('inactivo', { ...BUENO, activo: false, estado: 'sonora' }),
      yonke('mismo-estado', { ...BUENO, estado: 'jalisco' }),
      yonke('sin-estado', { ...BUENO }),
    ];
    expect(yonkesElegiblesOtrosEstados(docs, 'jalisco').map((d) => d.id)).toEqual(['ok-son', 'sin-estado', 'sin-envios']);
    // Un cliente de Baja California no ve como "otro estado" al yonke sin estado.
    expect(yonkesElegiblesOtrosEstados(docs, 'baja-california').map((d) => d.id)).toEqual(['ok-son', 'mismo-estado', 'sin-envios']);
  });

  it('sin tope de yonkes: con envíos primero, luego Premium vigente', () => {
    const docs = [
      ...Array.from({ length: 12 }, (_, i) => yonke(`y${i}`, { ...BUENO, estado: 'sonora', ...(i === 9 ? { plan: 'premium', premiumHasta: enAnio } : {}) })),
      yonke('patos', { activo: true, verificado: true, estado: 'baja-california' }),
    ];
    const ids = yonkesElegiblesOtrosEstados(docs, 'jalisco').map((d) => d.id);
    expect(ids).toHaveLength(13);
    expect(ids[0]).toBe('y9');
    expect(ids.at(-1)).toBe('patos');
  });
});

describe('agrupado por estado', () => {
  it('los que no anuncian envíos van al final y solo llenan lo que sobra del tope', () => {
    const porYonke = new Map([['A', 'sonora'], ['B', 'sonora'], ['C', 'baja-california']]);
    const lista = [
      { yonkeId: 'C', vehiculoId: 'c', enviosNacionales: false },
      ...Array.from({ length: 6 }, (_, i) => ({ yonkeId: i % 2 ? 'A' : 'B', vehiculoId: `${i}`, enviosNacionales: true })),
    ];
    const r = agruparPorEstado(lista, porYonke, ESTADOS, 6);
    expect(r.mostrados).toBe(6);
    expect(r.yonkeIds).not.toContain('C');
    const r2 = agruparPorEstado(lista.slice(0, 3), porYonke, ESTADOS);
    expect(r2.grupos.map((g) => g.estado)).toEqual(['sonora', 'baja-california']);
  });

  const porYonke = new Map([['A', 'sonora'], ['B', 'baja-california'], ['C', 'sonora']]);
  it('sin repetidos, con tope y agrupado en el orden en que aparecen', () => {
    const lista = [
      { yonkeId: 'A', vehiculoId: '1' }, { yonkeId: 'B', vehiculoId: '2' }, { yonkeId: 'A', vehiculoId: '1' },
      { yonkeId: 'C', motorId: 'm1' }, { yonkeId: 'A', vehiculoId: '3' }, { yonkeId: 'B', vehiculoId: '4' },
      { yonkeId: 'C', vehiculoId: '5' }, { yonkeId: 'C', vehiculoId: '6' },
    ];
    const r = agruparPorEstado(lista, porYonke, ESTADOS, 6);
    expect(r.mostrados).toBe(6);
    expect(r.grupos.map((g) => [g.estado, g.estadoNombre, g.resultados.length])).toEqual([['sonora', 'Sonora', 4], ['baja-california', 'Baja California', 2]]);
    expect(r.yonkeIds).toEqual(['A', 'B', 'C']);
  });
});

describe('buscarEnOtrosEstados', () => {
  const leerYonkes = async () => [yonke('A', { ...BUENO, estado: 'sonora' }), yonke('Z', { ...BUENO, estado: 'jalisco' })];

  it('con pieza: piezas confirmadas y motores; nunca el "vehículo sin la pieza registrada"', async () => {
    inv.consultarInventarioEnYonkes.mockResolvedValueOnce({ resultados: [{ yonkeId: 'A', vehiculoId: 'v' }], resultadosCercanos: [], piezaNoEncontrada: true });
    inv.consultarMotoresTransmisionesEnYonkes.mockResolvedValueOnce({ motores: [{ yonkeId: 'A', motorId: 'm' }], transmisiones: [], motoresCercanos: [], transmisionesCercanos: [] });
    const r = await buscarEnOtrosEstados({ estadoCliente: 'jalisco', marca: 'Honda', modelo: 'Civic', anio: 2016, pieza: 'Alternador', rango: 2 }, { leerYonkes });
    expect(r.grupos[0].resultados).toEqual([{ yonkeId: 'A', motorId: 'm' }]);
    // Solo el yonke de otro estado, con el mismo rango de años.
    expect(inv.consultarInventarioEnYonkes.mock.calls[0][0].map((d) => d.id)).toEqual(['A']);
    expect(inv.consultarInventarioEnYonkes.mock.calls[0][1]).toMatchObject({ anio: 2016, pieza: 'Alternador', rango: 2 });
  });

  it('sin pieza: busca vehículos', async () => {
    inv.consultarInventarioVehiculoEnYonkes.mockResolvedValueOnce({ resultados: [{ yonkeId: 'A', vehiculoId: 'v' }], resultadosCercanos: [] });
    inv.consultarMotoresTransmisionesEnYonkes.mockResolvedValueOnce({ motores: [], transmisiones: [], motoresCercanos: [], transmisionesCercanos: [] });
    const r = await buscarEnOtrosEstados({ estadoCliente: 'jalisco', marca: 'Honda', modelo: 'Civic', anio: 2016, pieza: null }, { leerYonkes });
    expect(r).toMatchObject({ mostrados: 1, yonkeIds: ['A'] });
    expect(r.grupos[0]).toMatchObject({ estado: 'sonora', estadoNombre: 'Sonora' });
  });

  it('sin yonkes elegibles: vacío, sin buscar inventario', async () => {
    const buscar = vi.fn();
    const r = await buscarEnOtrosEstados({ estadoCliente: 'sonora' }, { leerYonkes: async () => [yonke('A', { ...BUENO, estado: 'sonora' })], buscar });
    expect(r).toEqual({ grupos: [], yonkeIds: [], mostrados: 0 });
    expect(buscar).not.toHaveBeenCalled();
  });

  it('si tarda más del límite o falla: null (se omite)', async () => {
    const lento = () => new Promise((res) => setTimeout(() => res([{ yonkeId: 'A', vehiculoId: '1' }]), 200));
    expect(await buscarEnOtrosEstados({ estadoCliente: 'jalisco' }, { leerYonkes, buscar: lento, tiempoLimiteMs: 20 })).toBeNull();
    const falla = async () => { throw new Error('x'); };
    expect(await buscarEnOtrosEstados({ estadoCliente: 'jalisco' }, { leerYonkes, buscar: falla })).toBeNull();
  });
});

describe('otrosEstadosSiAplica', () => {
  const deps = { banderaActiva: async () => true, leerYonkes: async () => [yonke('A', { ...BUENO, estado: 'sonora' })], buscar: async () => [{ yonkeId: 'A', vehiculoId: '1' }] };

  it('no aplica con "Todos los estados" ni con la bandera apagada', async () => {
    const banderaActiva = vi.fn(async () => true);
    expect(await otrosEstadosSiAplica('todos', {}, { ...deps, banderaActiva })).toBeNull();
    expect(await otrosEstadosSiAplica('', {}, { ...deps, banderaActiva })).toBeNull();
    expect(banderaActiva).not.toHaveBeenCalled();
    expect(await otrosEstadosSiAplica('jalisco', {}, { ...deps, banderaActiva: async () => false })).toBeNull();
  });

  it('con bandera y estado elegido: resultados; si se pasa del tiempo, vacío (aplicó, sin nada)', async () => {
    expect((await otrosEstadosSiAplica('jalisco', {}, deps)).mostrados).toBe(1);
    const lento = () => new Promise((res) => setTimeout(() => res([]), 200));
    expect(await otrosEstadosSiAplica('jalisco', {}, { ...deps, buscar: lento, tiempoLimiteMs: 10 })).toEqual({ grupos: [], yonkeIds: [], mostrados: 0, omitido: true });
  });

  it('campos de respuesta y de registro', () => {
    expect(camposRespuestaOtrosEstados(null)).toEqual({});
    // Se buscó y no hubo nada: solo la marca (la pantalla ya no ofrece el botón viejo).
    expect(camposRespuestaOtrosEstados({ grupos: [], yonkeIds: [], mostrados: 0 })).toEqual({ otrosEstadosRevisados: true });
    expect(camposRespuestaOtrosEstados({ grupos: ['g'], yonkeIds: ['A'], mostrados: 1 })).toEqual({ otrosEstadosRevisados: true, resultadosOtrosEstados: ['g'] });
    // Se cortó por tiempo o falló: sin marca (el botón viejo sigue).
    expect(camposRespuestaOtrosEstados({ grupos: [], yonkeIds: [], mostrados: 0, omitido: true })).toEqual({});
    expect(camposRegistroOtrosEstados(null)).toEqual({});
    expect(camposRegistroOtrosEstados({ grupos: [], yonkeIds: [], mostrados: 0 })).toEqual({ otrosEstados: { mostrados: 0, yonkeIds: [] } });
  });
});

describe('tope de tarjetas', () => {
  it('12 por omisión', () => {
    const lista = Array.from({ length: 20 }, (_, i) => ({ yonkeId: 'A', vehiculoId: `${i}`, enviosNacionales: true }));
    expect(agruparPorEstado(lista, new Map([['A', 'sonora']]), ESTADOS).mostrados).toBe(12);
  });
});
