import { describe, expect, it, vi } from 'vitest';
import { crearManejadores } from './manejadores';
import { claveLimite, codigoCoincide, generarCodigo, hashCodigo } from '../../../lib/pedidosClientesServidor';
import { MAX_AVISOS_ADMIN_HORA, MAX_CONSULTAS_POR_IP_MINUTO, MAX_PEDIDOS_POR_IP_HORA, MAX_PEDIDOS_POR_WHATSAPP_DIA, MENSAJES_PEDIDO } from '../../../lib/pedidosClientes';

// Firestore falso en memoria: mismas funciones que servicio.js, sin red.
const ts = (fecha) => ({ toDate: () => fecha });
function crearFalsos({ habilitado = true, otrosEstados, obtenerDb } = {}) {
  let ahora = new Date('2026-10-08T18:00:00Z');
  const contadores = new Map();
  const pedidos = new Map();
  const privados = new Map();
  const respuestas = new Map();
  const yonkes = { Y1: { nombre: 'El Güero', verificado: true, estado: 'baja-california' }, Y2: { nombre: 'Nuevo' }, YJ: { nombre: 'Yonke Jalisco', verificado: true, estado: 'jalisco' } };
  let n = 0;
  const deps = {
    obtenerDb: obtenerDb ?? vi.fn(async () => ({ falso: true })),
    habilitado: vi.fn(async () => habilitado),
    ...(otrosEstados === undefined ? {} : { otrosEstados: typeof otrosEstados === 'function' ? otrosEstados : vi.fn(async () => otrosEstados) }),
    contar: vi.fn(async (_db, clave, max) => {
      const c = contadores.get(clave) || 0;
      if (c >= max) return false;
      contadores.set(clave, c + 1);
      return true;
    }),
    estados: async () => [{ id: 'baja-california', nombre: 'Baja California' }, { id: 'sonora', nombre: 'Sonora' }, { id: 'jalisco', nombre: 'Jalisco' }],
    crearPedido: vi.fn(async (_db, { pedido, privado }) => {
      n += 1;
      const id = `Pedido${String(n).padStart(14, '0')}`;
      const { expiraAt, ...resto } = pedido;
      pedidos.set(id, { ...resto, estadoPedido: 'abierta', creadoAt: ts(ahora), expiraAt: ts(expiraAt) });
      privados.set(id, privado);
      return id;
    }),
    leerPedido: async (_db, id) => pedidos.get(id) ?? null,
    leerPrivado: async (_db, id) => privados.get(id) ?? null,
    leerRespuestas: async (_db, id) => respuestas.get(id) ?? [],
    leerYonkes: async (_db, ids) => Object.fromEntries(ids.map((i) => [i, yonkes[i] ?? null])),
    listarAbiertos: async (_db, estado, max) => [...pedidos].filter(([, d]) => d.estado === estado && d.estadoPedido === 'abierta')
      .map(([id, d]) => ({ id, ...d })).slice(0, max),
    notificar: vi.fn(async () => {}),
    ahora: () => ahora,
    generarCodigo, hashCodigo, codigoCoincide, claveLimite,
  };
  return { deps, pedidos, privados, respuestas, avanzar: (ms) => { ahora = new Date(ahora.getTime() + ms); } };
}

const BASE = 'https://mecanix.test';
const cuerpo = (extra = {}) => ({
  vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2005 }, pieza: 'Alternador', estado: 'baja-california', whatsapp: '+52 664 123 4567', ...extra,
});
const post = (body, ip = '1.1.1.1') => new Request(`${BASE}/api/pedir-pieza`, {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: typeof body === 'string' ? body : JSON.stringify(body),
});
const get = (ruta, ip = '1.1.1.1') => new Request(`${BASE}${ruta}`, { headers: { 'x-forwarded-for': ip } });

async function crearUno(m, extra = {}, ip) {
  const res = await m.pedirPieza(post(cuerpo(extra), ip));
  const data = await res.json();
  const url = new URL(data.enlace);
  return { res, data, id: data.id, codigo: url.searchParams.get('c') };
}

describe('bandera apagada o sin identidad de servicio: todo "no disponible"', () => {
  it('con config/pedidosClientes apagada no crea, no lee y no cuenta nada', async () => {
    const { deps } = crearFalsos({ habilitado: false });
    const m = crearManejadores(deps);
    for (const res of [
      await m.pedirPieza(post(cuerpo())),
      await m.miPedido(get('/api/mi-pedido/x?c=y'), 'x'),
      await m.pedidosAbiertos(get('/api/pedidos-abiertos?estado=baja-california')),
    ]) {
      expect(res.status).toBe(503);
      expect(await res.json()).toMatchObject({ ok: false, disponible: false, mensaje: MENSAJES_PEDIDO.noDisponible });
    }
    expect(deps.crearPedido).not.toHaveBeenCalled();
    expect(deps.contar).not.toHaveBeenCalled();
  });
  it('sin credenciales del usuario de servicio (obtenerDb = null) o si el inicio de sesión falla', async () => {
    for (const obtenerDb of [vi.fn(async () => null), vi.fn(async () => { throw new Error('auth/wrong-password'); })]) {
      const { deps } = crearFalsos({ obtenerDb });
      const res = await crearManejadores(deps).pedirPieza(post(cuerpo()));
      expect(res.status).toBe(503);
      expect(deps.crearPedido).not.toHaveBeenCalled();
    }
  });
});

describe('POST /api/pedir-pieza', () => {
  it('crea el pedido, guarda solo el hash del código y devuelve el enlace /mi-pedido', async () => {
    const { deps, pedidos, privados } = crearFalsos();
    const m = crearManejadores(deps);
    const { res, data, id, codigo } = await crearUno(m);
    expect(res.status).toBe(200);
    expect(data.enlace).toBe(`${BASE}/mi-pedido/${id}?c=${codigo}`);
    expect(codigo).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(privados.get(id)).toEqual({ clienteWhatsapp: '6641234567', codigoHash: hashCodigo(codigo), expiraAt: expect.any(Date) });
    expect(JSON.stringify(privados.get(id))).not.toContain(codigo);
    expect(JSON.stringify(pedidos.get(id))).not.toContain('6641234567');
    expect(Object.keys(pedidos.get(id)).sort()).toEqual(['creadoAt', 'estado', 'estadoPedido', 'expiraAt', 'pieza', 'vehiculo']);
    expect(deps.notificar).toHaveBeenCalledTimes(1);
    expect(deps.notificar.mock.calls[0][0]).not.toContain('6641234567');
  });
  it('vence a los 5 días', async () => {
    const { deps } = crearFalsos();
    await crearUno(crearManejadores(deps));
    const { pedido } = deps.crearPedido.mock.calls[0][1];
    expect(pedido.expiraAt.getTime() - deps.ahora().getTime()).toBe(5 * 24 * 60 * 60 * 1000);
  });
  it('rechaza datos inválidos sin crear nada', async () => {
    const { deps } = crearFalsos();
    const m = crearManejadores(deps);
    const casos = [
      [cuerpo({ whatsapp: '123' }), MENSAJES_PEDIDO.whatsapp],
      [cuerpo({ estado: 'todos' }), MENSAJES_PEDIDO.estado],
      [cuerpo({ vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: '2005' } }), MENSAJES_PEDIDO.anio],
      [cuerpo({ pieza: '   ' }), MENSAJES_PEDIDO.pieza],
      ['esto no es json', MENSAJES_PEDIDO.solicitudInvalida],
    ];
    for (const [body, mensaje] of casos) {
      const res = await m.pedirPieza(post(body, `9.9.9.${Math.random()}`));
      expect(res.status).toBe(400);
      expect((await res.json()).mensaje).toBe(mensaje);
    }
    expect(deps.crearPedido).not.toHaveBeenCalled();
  });
  it(`máximo ${MAX_PEDIDOS_POR_WHATSAPP_DIA} pedidos por WhatsApp al día (aunque se escriba distinto o cambie la IP)`, async () => {
    const { deps, avanzar } = crearFalsos();
    const m = crearManejadores(deps);
    const formas = ['6641234567', '664 123 4567', '+52 664-123-4567'];
    for (let i = 0; i < MAX_PEDIDOS_POR_WHATSAPP_DIA; i++) {
      expect((await m.pedirPieza(post(cuerpo({ whatsapp: formas[i] }), `2.2.2.${i}`))).status).toBe(200);
    }
    const res = await m.pedirPieza(post(cuerpo(), '3.3.3.3'));
    expect(res.status).toBe(429);
    expect((await res.json()).mensaje).toBe(MENSAJES_PEDIDO.limiteWhatsapp);
    expect(deps.crearPedido).toHaveBeenCalledTimes(MAX_PEDIDOS_POR_WHATSAPP_DIA);
    avanzar(24 * 60 * 60 * 1000);
    expect((await m.pedirPieza(post(cuerpo(), '3.3.3.3'))).status).toBe(200);
  });
  it(`máximo ${MAX_PEDIDOS_POR_IP_HORA} pedidos por IP por hora`, async () => {
    const { deps } = crearFalsos();
    const m = crearManejadores(deps);
    for (let i = 0; i < MAX_PEDIDOS_POR_IP_HORA; i++) {
      expect((await m.pedirPieza(post(cuerpo({ whatsapp: `66400000${String(i).padStart(2, '0')}` }), '4.4.4.4'))).status).toBe(200);
    }
    const res = await m.pedirPieza(post(cuerpo({ whatsapp: '6649999999' }), '4.4.4.4'));
    expect(res.status).toBe(429);
    expect((await res.json()).mensaje).toBe(MENSAJES_PEDIDO.limiteIp);
  });
  it('si el contador de límite falla, NO se crea el pedido (falla cerrada)', async () => {
    const { deps } = crearFalsos();
    deps.contar.mockRejectedValue(Object.assign(new Error('x'), { code: 'permission-denied' }));
    const res = await crearManejadores(deps).pedirPieza(post(cuerpo()));
    expect(res.status).toBe(429);
    expect(deps.crearPedido).not.toHaveBeenCalled();
  });
  it(`avisa al admin como máximo ${MAX_AVISOS_ADMIN_HORA} veces por hora; el pedido se crea igual`, async () => {
    const { deps } = crearFalsos();
    const m = crearManejadores(deps);
    for (let i = 0; i <= MAX_AVISOS_ADMIN_HORA; i++) {
      const res = await m.pedirPieza(post(cuerpo({ whatsapp: `66511111${String(i).padStart(2, '0')}` }), `5.5.5.${i}`));
      expect(res.status).toBe(200);
    }
    expect(deps.crearPedido).toHaveBeenCalledTimes(MAX_AVISOS_ADMIN_HORA + 1);
    expect(deps.notificar).toHaveBeenCalledTimes(MAX_AVISOS_ADMIN_HORA);
  });
  it('si el aviso al admin falla, el cliente recibe su enlace igual', async () => {
    const { deps } = crearFalsos();
    deps.notificar.mockRejectedValue(new Error('CallMeBot caído'));
    expect((await crearManejadores(deps).pedirPieza(post(cuerpo()))).status).toBe(200);
  });
  it('si Firestore rechaza el pedido, responde error sin enlace', async () => {
    const { deps } = crearFalsos();
    deps.crearPedido.mockRejectedValue(Object.assign(new Error('x'), { code: 'permission-denied' }));
    const res = await crearManejadores(deps).pedirPieza(post(cuerpo()));
    expect(res.status).toBe(500);
    expect((await res.json()).enlace).toBeUndefined();
  });
});

describe('GET /api/mi-pedido/{id}?c=', () => {
  it('con el código correcto devuelve el pedido y las respuestas, sin el WhatsApp del cliente', async () => {
    const { deps, respuestas } = crearFalsos();
    const m = crearManejadores(deps);
    const { id, codigo } = await crearUno(m);
    respuestas.set(id, [
      { yonkeId: 'Y2', yonkeNombre: 'Nuevo', tieneLaPieza: true, precio: 1800, nota: '', whatsapp: '6642222222' },
      { yonkeId: 'Y1', yonkeNombre: 'El Güero', tieneLaPieza: true, precio: 1500, nota: 'Original', whatsapp: '6641111111' },
    ]);
    const res = await m.miPedido(get(`/api/mi-pedido/${id}?c=${codigo}`), id);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex');
    const data = await res.json();
    expect(data.pedido).toMatchObject({ id, pieza: 'Alternador', estado: 'baja-california', estadoNombre: 'Baja California', estadoPedido: 'abierta', vencido: false });
    expect(data.respuestas.map((r) => [r.yonkeNombre, r.precio, r.verificado])).toEqual([['El Güero', 1500, true], ['Nuevo', 1800, false]]);
    expect(JSON.stringify(data)).not.toContain('6641234567');
    expect(JSON.stringify(data)).not.toContain('codigoHash');
  });
  it('código equivocado, mal formado, sin código o id inexistente: siempre el mismo "no encontrado"', async () => {
    const { deps } = crearFalsos();
    const m = crearManejadores(deps);
    const { id, codigo } = await crearUno(m);
    const otro = generarCodigo();
    for (const [ruta, idRuta] of [
      [`/api/mi-pedido/${id}?c=${otro}`, id],
      [`/api/mi-pedido/${id}?c=${codigo.slice(0, 40)}`, id],
      [`/api/mi-pedido/${id}`, id],
      [`/api/mi-pedido/NoExiste000000000000?c=${codigo}`, 'NoExiste000000000000'],
      [`/api/mi-pedido/..%2Fconfig?c=${codigo}`, '../config'],
    ]) {
      const res = await m.miPedido(get(ruta), idRuta);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ ok: false, mensaje: MENSAJES_PEDIDO.noEncontrado });
    }
  });
  it('marca el pedido como vencido pasados los 5 días', async () => {
    const { deps, avanzar } = crearFalsos();
    const m = crearManejadores(deps);
    const { id, codigo } = await crearUno(m);
    avanzar(5 * 24 * 60 * 60 * 1000 + 1000);
    const data = await (await m.miPedido(get(`/api/mi-pedido/${id}?c=${codigo}`), id)).json();
    expect(data.pedido.vencido).toBe(true);
  });
  it(`limita las consultas a ${MAX_CONSULTAS_POR_IP_MINUTO} por IP por minuto`, async () => {
    const { deps } = crearFalsos();
    const m = crearManejadores(deps);
    const { id, codigo } = await crearUno(m);
    for (let i = 0; i < MAX_CONSULTAS_POR_IP_MINUTO; i++) {
      expect((await m.miPedido(get(`/api/mi-pedido/${id}?c=${codigo}`, '7.7.7.7'), id)).status).toBe(200);
    }
    expect((await m.miPedido(get(`/api/mi-pedido/${id}?c=${codigo}`, '7.7.7.7'), id)).status).toBe(429);
    expect((await m.miPedido(get(`/api/mi-pedido/${id}?c=${codigo}`, '8.8.8.8'), id)).status).toBe(200);
  });
});

describe('GET /api/pedidos-abiertos', () => {
  it('lista solo vehículo, pieza, estado y fecha de los pedidos abiertos y vigentes del estado', async () => {
    const { deps, pedidos, avanzar } = crearFalsos();
    const m = crearManejadores(deps);
    const viejo = await crearUno(m, { whatsapp: '6641000001' }, '6.6.6.1');
    avanzar(4 * 24 * 60 * 60 * 1000);
    const nuevo = await crearUno(m, { whatsapp: '6641000002', pieza: 'Defensa' }, '6.6.6.2');
    await crearUno(m, { whatsapp: '6641000003', estado: 'sonora' }, '6.6.6.3');
    const cancelado = await crearUno(m, { whatsapp: '6641000004' }, '6.6.6.4');
    pedidos.get(cancelado.id).estadoPedido = 'cancelada';
    avanzar(2 * 24 * 60 * 60 * 1000); // el primero ya venció
    const data = await (await m.pedidosAbiertos(get('/api/pedidos-abiertos?estado=baja-california'))).json();
    expect(data.pedidos.map((p) => p.id)).toEqual([nuevo.id]);
    expect(Object.keys(data.pedidos[0]).sort()).toEqual(['creadoAt', 'estado', 'estadoNombre', 'id', 'pieza', 'vehiculo']);
    expect(JSON.stringify(data)).not.toMatch(/66410000/);
    expect(data.pedidos.find((p) => p.id === viejo.id)).toBeUndefined();
  });
  it('un estado que no existe responde 400', async () => {
    const { deps } = crearFalsos();
    const res = await crearManejadores(deps).pedidosAbiertos(get('/api/pedidos-abiertos?estado=narnia'));
    expect(res.status).toBe(400);
  });
  it('?pedido={id} devuelve ese pedido si sigue abierto; si no, "no encontrado"', async () => {
    const { deps, avanzar } = crearFalsos();
    const m = crearManejadores(deps);
    const { id } = await crearUno(m);
    const data = await (await m.pedidosAbiertos(get(`/api/pedidos-abiertos?pedido=${id}`))).json();
    expect(data.pedido).toMatchObject({ id, estado: 'baja-california', estadoNombre: 'Baja California' });
    expect((await m.pedidosAbiertos(get('/api/pedidos-abiertos?pedido=malo'))).status).toBe(404);
    avanzar(6 * 24 * 60 * 60 * 1000);
    expect((await m.pedidosAbiertos(get(`/api/pedidos-abiertos?pedido=${id}`))).status).toBe(404);
  });
});

describe('alertas de otros estados (aceptaOtrosEstados)', () => {
  it('segunda bandera apagada: la alerta se guarda igual que siempre, sin el campo, aunque el navegador lo mande', async () => {
    for (const otrosEstados of [undefined, false, () => { throw new Error('sin red'); }]) {
      const { deps, pedidos } = crearFalsos({ otrosEstados });
      const { id } = await crearUno(crearManejadores(deps), { aceptaOtrosEstados: true });
      expect(Object.keys(pedidos.get(id))).not.toContain('aceptaOtrosEstados');
    }
  });
  it('segunda bandera encendida: guarda true solo si marcó la casilla; sin marcar (o basura) = false', async () => {
    const { deps, pedidos } = crearFalsos({ otrosEstados: true });
    const m = crearManejadores(deps);
    const casos = [[{ aceptaOtrosEstados: true }, true], [{ aceptaOtrosEstados: false }, false], [{}, false], [{ aceptaOtrosEstados: 'true' }, false]];
    for (const [extra, esperado] of casos) {
      const { id } = await crearUno(m, { ...extra, whatsapp: `664 000 00${String(casos.findIndex((c) => c[0] === extra)).padStart(2, '0')}` });
      expect(pedidos.get(id).aceptaOtrosEstados).toBe(esperado);
    }
  });
  it('/mi-pedido: cada respuesta trae el estado del yonke y si es de otro estado (sin el WhatsApp del cliente)', async () => {
    const { deps, respuestas } = crearFalsos({ otrosEstados: true });
    const m = crearManejadores(deps);
    const { id, codigo } = await crearUno(m, { aceptaOtrosEstados: true });
    respuestas.set(id, [
      { yonkeId: 'Y1', yonkeNombre: 'El Güero', tieneLaPieza: true, precio: 1500, nota: '', whatsapp: '6641111111' },
      { yonkeId: 'YJ', yonkeNombre: 'Yonke Jalisco', tieneLaPieza: true, precio: 1400, nota: '', whatsapp: '3331111111' },
      { yonkeId: 'Y2', yonkeNombre: 'Nuevo', tieneLaPieza: false, nota: '', whatsapp: '6642222222' },
    ]);
    const data = await (await m.miPedido(get(`/api/mi-pedido/${id}?c=${codigo}`), id)).json();
    expect(data.respuestas.map((r) => [r.yonkeNombre, r.estadoYonkeNombre, r.otroEstado])).toEqual([
      ['Yonke Jalisco', 'Jalisco', true], ['El Güero', 'Baja California', false], ['Nuevo', '', false],
    ]);
    expect(JSON.stringify(data)).not.toContain('6641234567');
  });
  it('/pedidos-abiertos?pedido={id} dice si la alerta acepta otros estados (para el mensaje del panel)', async () => {
    const { deps } = crearFalsos({ otrosEstados: true });
    const m = crearManejadores(deps);
    const { id } = await crearUno(m, { aceptaOtrosEstados: true });
    const { id: id2 } = await crearUno(m, { whatsapp: '664 555 5555' });
    expect((await (await m.pedidosAbiertos(get(`/api/pedidos-abiertos?pedido=${id}`))).json()).pedido.aceptaOtrosEstados).toBe(true);
    expect((await (await m.pedidosAbiertos(get(`/api/pedidos-abiertos?pedido=${id2}`))).json()).pedido.aceptaOtrosEstados).toBe(false);
  });
});

