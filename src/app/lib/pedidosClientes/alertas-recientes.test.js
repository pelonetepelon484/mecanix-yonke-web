import { describe, expect, it, vi } from 'vitest';
import { crearManejadores } from './manejadores';
import { claveLimite, codigoCoincide, generarCodigo, hashCodigo } from '../../../lib/pedidosClientesServidor';
import { armarResumen } from '../../../lib/alertasRecientes';

const AHORA = new Date('2026-10-15T18:00:00Z');
const H = 60 * 60 * 1000;
const ts = (ms) => ({ toDate: () => new Date(ms) });
const alerta = (id, estado, horasAtras, extra = {}) => ({
  id, pieza: 'Faro', vehiculo: { marca: 'Honda', modelo: 'Civic', anio: 2020 }, estado, estadoPedido: 'abierta',
  creadoAt: ts(AHORA.getTime() - horasAtras * H), expiraAt: ts(AHORA.getTime() + 24 * H), ...extra,
});

function falsos({ portada = true, resumen = [alerta('A', 'baja-california', 1), alerta('B', 'sonora', 2, { aceptaOtrosEstados: true }), alerta('C', 'baja-california', 3)], geo = null } = {}) {
  let guardado = resumen === null ? null : armarResumen(resumen, AHORA);
  const deps = {
    obtenerDb: vi.fn(async () => ({ falso: true })),
    habilitado: vi.fn(async () => true),
    alertasPortada: vi.fn(async () => portada),
    leerResumen: vi.fn(async () => guardado),
    actualizarResumen: vi.fn(async () => { guardado = armarResumen([alerta('N', 'baja-california', 0)], AHORA); return guardado; }),
    estadoDesdeGeo: vi.fn(() => geo),
    contar: vi.fn(async () => true),
    estados: async () => [{ id: 'baja-california', nombre: 'Baja California' }, { id: 'sonora', nombre: 'Sonora' }],
    crearPedido: vi.fn(async () => 'Pedido00000000000001'),
    leerPedido: async () => null, leerPrivado: async () => null, leerRespuestas: async () => [], leerYonkes: async () => ({}),
    listarAbiertos: vi.fn(async () => []),
    notificar: vi.fn(async () => {}),
    ahora: () => AHORA,
    generarCodigo, hashCodigo, codigoCoincide, claveLimite,
  };
  return deps;
}
const get = (ruta, headers = {}) => new Request(`https://mecanix.test${ruta}`, { headers: { 'x-forwarded-for': '1.1.1.1', ...headers } });
const post = (body) => new Request('https://mecanix.test/api/pedir-pieza', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '2.2.2.2' }, body: JSON.stringify(body) });
const cuerpoAlerta = { vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2005 }, pieza: 'Alternador', estado: 'baja-california', whatsapp: '6641234567' };

describe('bandera alertasPortada apagada: todo como hoy', () => {
  it('/api/alertas-recientes no disponible y sin leer el resumen', async () => {
    const deps = falsos({ portada: false });
    const res = await crearManejadores(deps).alertasRecientes(get('/api/alertas-recientes?estado=baja-california'));
    expect(res.status).toBe(503);
    expect(deps.leerResumen).not.toHaveBeenCalled();
  });
  it('crear una alerta no toca el resumen; /api/pedidos-abiertos consulta como siempre', async () => {
    const deps = falsos({ portada: false });
    const m = crearManejadores(deps);
    expect((await m.pedirPieza(post(cuerpoAlerta))).status).toBe(200);
    expect(deps.actualizarResumen).not.toHaveBeenCalled();
    await m.pedidosAbiertos(get('/api/pedidos-abiertos?estado=baja-california'));
    expect(deps.listarAbiertos).toHaveBeenCalled();
    expect(deps.leerResumen).not.toHaveBeenCalled();
  });
});

describe('bandera encendida', () => {
  it('con ?estado: solo las de ese estado (no las de otro aunque acepten otros estados), con la hora del servidor y caché de 60 s', async () => {
    const res = await crearManejadores(falsos()).alertasRecientes(get('/api/alertas-recientes?estado=baja-california'));
    expect(res.headers.get('cache-control')).toBe('public, max-age=0, s-maxage=60, stale-while-revalidate=60');
    const data = await res.json();
    expect(data).toMatchObject({ ok: true, estado: 'baja-california', estadoNombre: 'Baja California', ahora: AHORA.toISOString() });
    expect(data.alertas.map((a) => a.id)).toEqual(['A', 'C']);
    expect(JSON.stringify(data)).not.toMatch(/whatsapp|codigo|aceptaOtrosEstados/i);
  });
  it('sin ?estado: el de la ubicación aproximada, sin caché compartida', async () => {
    const res = await crearManejadores(falsos({ geo: 'sonora' })).alertasRecientes(get('/api/alertas-recientes'));
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect((await res.json()).alertas.map((a) => a.id)).toEqual(['B']);
  });
  it('sin ?estado y sin ubicación: estado null y ninguna alerta (la portada pide elegirlo)', async () => {
    const deps = falsos({ geo: null });
    const data = await (await crearManejadores(deps).alertasRecientes(get('/api/alertas-recientes'))).json();
    expect(data).toMatchObject({ ok: true, estado: null, alertas: [] });
    expect(deps.leerResumen).not.toHaveBeenCalled();
  });
  it('estado inválido: 400', async () => {
    expect((await crearManejadores(falsos()).alertasRecientes(get('/api/alertas-recientes?estado=x'))).status).toBe(400);
  });
  it('si el resumen todavía no existe, se arma una vez', async () => {
    const deps = falsos({ resumen: null });
    const data = await (await crearManejadores(deps).alertasRecientes(get('/api/alertas-recientes?estado=baja-california'))).json();
    expect(deps.actualizarResumen).toHaveBeenCalledTimes(1);
    expect(data.alertas.map((a) => a.id)).toEqual(['N']);
  });
  it('crear una alerta actualiza el resumen; si falla, la alerta igual se crea', async () => {
    const deps = falsos();
    expect((await crearManejadores(deps).pedirPieza(post(cuerpoAlerta))).status).toBe(200);
    expect(deps.actualizarResumen).toHaveBeenCalledTimes(1);
    deps.actualizarResumen.mockRejectedValueOnce(new Error('sin permiso'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await crearManejadores(deps).pedirPieza(post(cuerpoAlerta))).status).toBe(200);
  });
  it('/api/pedidos-abiertos sale del resumen, solo del estado pedido y con el mismo formato', async () => {
    const deps = falsos();
    const data = await (await crearManejadores(deps).pedidosAbiertos(get('/api/pedidos-abiertos?estado=baja-california'))).json();
    expect(deps.listarAbiertos).not.toHaveBeenCalled();
    expect(data.pedidos.map((p) => p.id)).toEqual(['A', 'C']);
    expect(data.pedidos[0]).toMatchObject({ pieza: 'Faro', estado: 'baja-california', estadoNombre: 'Baja California', vehiculo: { marca: 'Honda', modelo: 'Civic', anio: 2020 } });
  });
});

describe('/api/pedidos-abiertos?estado=auto', () => {
  it('bandera apagada: Baja California, como siempre', async () => {
    const deps = falsos({ portada: false, geo: 'sonora' });
    const data = await (await crearManejadores(deps).pedidosAbiertos(get('/api/pedidos-abiertos?estado=auto'))).json();
    expect(data.estado).toBe('baja-california');
    expect(deps.listarAbiertos).toHaveBeenCalledWith(expect.anything(), 'baja-california', expect.any(Number));
  });
  it('bandera encendida: el estado de la ubicación del visitante, del resumen', async () => {
    const data = await (await crearManejadores(falsos({ geo: 'sonora' })).pedidosAbiertos(get('/api/pedidos-abiertos?estado=auto'))).json();
    expect(data.estado).toBe('sonora');
    expect(data.pedidos.map((p) => p.id)).toEqual(['B']);
  });
  it('bandera encendida y sin ubicación: estado null y lista vacía', async () => {
    const data = await (await crearManejadores(falsos({ geo: null })).pedidosAbiertos(get('/api/pedidos-abiertos?estado=auto'))).json();
    expect(data).toEqual({ ok: true, estado: null, pedidos: [] });
  });
});

describe('config/pedidosClientes.alertasPortadaTodos', () => {
  const pedirBC = async (deps) => (await crearManejadores(deps).alertasRecientes(get('/api/alertas-recientes?estado=baja-california'))).json();

  it('apagada (o sin la dependencia): respuesta idéntica a la de hoy', async () => {
    const hoy = await pedirBC(falsos());
    const apagada = await pedirBC({ ...falsos(), alertasPortadaTodos: vi.fn(async () => false) });
    expect(apagada).toEqual(hoy);
    expect(hoy.alertas.map((a) => a.id)).toEqual(['A', 'C']);
    expect(hoy.alertas.every((a) => !('estadoNombre' in a))).toBe(true);
  });

  it('encendida: primero las del estado y se completa con las de otros estados que aceptan envíos, cada una con su estado', async () => {
    const data = await pedirBC({ ...falsos(), alertasPortadaTodos: vi.fn(async () => true) });
    expect(data.alertas.map((a) => [a.id, a.estadoNombre])).toEqual([['A', 'Baja California'], ['C', 'Baja California'], ['B', 'Sonora']]);
    expect(JSON.stringify(data)).not.toMatch(/whatsapp|codigo|aceptaOtrosEstados/i);
  });

  it('encendida: una alerta con la casilla desmarcada no sale fuera de su estado', async () => {
    const resumen = [alerta('A', 'baja-california', 1), alerta('S', 'sonora', 2)];
    const data = await pedirBC({ ...falsos({ resumen }), alertasPortadaTodos: vi.fn(async () => true) });
    expect(data.alertas.map((a) => a.id)).toEqual(['A']);
  });

  it('encendida y cero alertas en ningún estado: lista vacía (la ventana no se muestra)', async () => {
    const data = await pedirBC({ ...falsos({ resumen: [] }), alertasPortadaTodos: vi.fn(async () => true) });
    expect(data.alertas).toEqual([]);
  });

  it('si la bandera no se puede leer, como apagada', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const data = await pedirBC({ ...falsos(), alertasPortadaTodos: vi.fn(async () => { throw new Error('sin red'); }) });
    expect(data.alertas.map((a) => a.id)).toEqual(['A', 'C']);
    error.mockRestore();
  });

  it('/api/pedidos-abiertos no cambia aunque esté encendida', async () => {
    const deps = { ...falsos(), alertasPortadaTodos: vi.fn(async () => true) };
    const data = await (await crearManejadores(deps).pedidosAbiertos(get('/api/pedidos-abiertos?estado=baja-california'))).json();
    expect(data.pedidos.map((p) => p.id)).toEqual(['A', 'C']);
    expect(deps.alertasPortadaTodos).not.toHaveBeenCalled();
  });
});
