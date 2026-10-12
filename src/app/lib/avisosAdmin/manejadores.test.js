import { describe, expect, it, vi } from 'vitest';
import { claveLimite } from '../../../lib/pedidosClientesServidor';
import {
  MAX_AVISOS_ENTREGA_IP_HORA, MAX_AVISOS_ENTREGA_TOTAL_HORA, MAX_AVISOS_SOLICITUD_TALLER_HORA, crearManejadoresAvisos,
} from './manejadores';

// Firestore, Google y CallMeBot falsos: "leerComoUsuario" imita las reglas (cada pase solo ve lo
// que las reglas le dejan ver), y los contadores viven en memoria.
const PASES = { 'pase-taller-1': 'uidT1', 'pase-taller-2': 'uidT2', 'pase-yonke-nuevo': 'uidY1', 'pase-yonke-de-baja-california': 'uidYBC' };
const solicitud = (tallerId, extra = {}) => ({
  tallerId, tallerNombre: 'Taller El Güero', pieza: 'Alternador', vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2010 }, estado: 'baja-california', ...extra,
});

function crearFalsos({ obtenerDb, contar, notificar } = {}) {
  let ahora = new Date('2026-10-11T18:00:00Z');
  const contadores = new Map();
  const docs = {
    'solicitudesPiezas/S1': solicitud('T1'),
    'solicitudesPiezas/S2': solicitud('T2', { tallerNombre: 'Taller Dos' }),
    'talleres/T1': { ownerUid: 'uidT1', nombre: 'Taller El Güero' },
    'talleres/T2': { ownerUid: 'uidT2', nombre: 'Taller Dos' },
    'usuarios/uidY1': { rol: 'yonke', yonkeId: 'Y1', email: 'yonke@ejemplo.com' },
    'usuarios/uidT1': { rol: 'taller', tallerId: 'T1', email: 'taller@ejemplo.com' },
    'yonkes/Y1': { ownerUid: 'uidY1', nombre: 'Yonke Nuevo', ciudad: 'Tijuana', telefono: '6641234567' },
    'yonkes/YE': { ownerUid: 'otro', nombre: 'Yonke Exprés', entregaInmediata: true, activo: true },
    'yonkes/YN': { ownerUid: 'otro', nombre: 'Yonke Normal', activo: true },
    'yonkes/YI': { ownerUid: 'otro', nombre: 'Yonke Inactivo', entregaInmediata: true, activo: false },
  };
  // Lo que cada usuario puede leer según las reglas (resumen de firestore.rules).
  function reglasDejanLeer(uid, ruta) {
    const d = docs[ruta];
    if (!d) return false;
    const [col, id] = ruta.split('/');
    if (col === 'yonkes') return true;
    if (col === 'usuarios') return id === uid;
    if (col === 'talleres') return d.ownerUid === uid;
    if (col === 'solicitudesPiezas') {
      const taller = docs[`talleres/${d.tallerId}`];
      // El dueño, o un yonke de ese estado mientras está abierta.
      return taller?.ownerUid === uid || uid === 'uidYBC';
    }
    return false;
  }
  const deps = {
    obtenerDb: obtenerDb ?? vi.fn(async () => ({ falso: true })),
    contar: contar ?? vi.fn(async (_db, clave, max) => {
      const c = contadores.get(clave) || 0;
      if (c >= max) return false;
      contadores.set(clave, c + 1);
      return true;
    }),
    claveLimite: (tipo, valor, ventana) => claveLimite(tipo, valor, ventana, 'sal-de-prueba'),
    uidDeToken: vi.fn(async (token) => PASES[token] ?? null),
    leerComoUsuario: vi.fn(async (token, ruta) => {
      const uid = PASES[token];
      return uid && reglasDejanLeer(uid, ruta) ? docs[ruta] : null;
    }),
    leerYonke: vi.fn(async (_db, id) => docs[`yonkes/${id}`] ?? null),
    notificar: notificar ?? vi.fn(async () => {}),
    ahora: () => ahora,
  };
  return { deps, docs, contadores, avanzar: (ms) => { ahora = new Date(ahora.getTime() + ms); } };
}

function peticion({ token, body, ip = '200.1.2.3', crudo } = {}) {
  const headers = new Headers({ 'Content-Type': 'application/json', 'x-forwarded-for': ip });
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return new Request('https://mecanixyonkevirtual.com/api/x', { method: 'POST', headers, body: crudo ?? JSON.stringify(body ?? {}) });
}
const HORA = 60 * 60 * 1000;

describe('aviso de "nuevo pedido de pieza" (taller con sesión)', () => {
  it('con el pase del dueño: avisa con lo GUARDADO, no con lo que mande el navegador', async () => {
    const f = crearFalsos();
    const m = crearManejadoresAvisos(f.deps);
    const r = await m.solicitudPieza(peticion({ token: 'pase-taller-1', body: { solicitudId: 'S1', tallerNombre: 'FALSO', pieza: 'spam' } }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, avisado: true });
    const mensaje = f.deps.notificar.mock.calls[0][0];
    expect(mensaje).toContain('Taller: Taller El Güero');
    expect(mensaje).toContain('Pieza: Alternador');
    expect(mensaje).toContain('Vehículo: Nissan Sentra 2010');
    expect(mensaje).toContain('Estado: baja-california');
    expect(mensaje).not.toContain('FALSO');
    expect(mensaje).not.toContain('spam');
  });
  it('sin pase: 401 y no avisa ni toca los contadores', async () => {
    const f = crearFalsos();
    const r = await crearManejadoresAvisos(f.deps).solicitudPieza(peticion({ body: { solicitudId: 'S1' } }));
    expect(r.status).toBe(401);
    expect(f.deps.notificar).not.toHaveBeenCalled();
    expect(f.deps.contar).not.toHaveBeenCalled();
  });
  it('pase falso o vencido: 401', async () => {
    const f = crearFalsos();
    const r = await crearManejadoresAvisos(f.deps).solicitudPieza(peticion({ token: 'pase-inventado-que-google-rechaza', body: { solicitudId: 'S1' } }));
    expect(r.status).toBe(401);
    expect(f.deps.notificar).not.toHaveBeenCalled();
  });
  it('pase de OTRO taller con un pedido ajeno: 403', async () => {
    const f = crearFalsos();
    const r = await crearManejadoresAvisos(f.deps).solicitudPieza(peticion({ token: 'pase-taller-2', body: { solicitudId: 'S1' } }));
    expect(r.status).toBe(403);
    expect(f.deps.notificar).not.toHaveBeenCalled();
    expect(f.deps.contar).not.toHaveBeenCalled();
  });
  it('un yonke que SÍ puede leer el pedido abierto (su estado) tampoco puede pedir el aviso: 403', async () => {
    const f = crearFalsos();
    const r = await crearManejadoresAvisos(f.deps).solicitudPieza(peticion({ token: 'pase-yonke-de-baja-california', body: { solicitudId: 'S1' } }));
    expect(r.status).toBe(403);
    expect(f.deps.notificar).not.toHaveBeenCalled();
  });
  it('pedido que no existe: 403 (igual que ajeno, no revela nada)', async () => {
    const f = crearFalsos();
    const r = await crearManejadoresAvisos(f.deps).solicitudPieza(peticion({ token: 'pase-taller-1', body: { solicitudId: 'NO-EXISTE' } }));
    expect(r.status).toBe(403);
  });
  it('número de pedido raro (rutas, vacío): 400 sin leer nada', async () => {
    const f = crearFalsos();
    const m = crearManejadoresAvisos(f.deps);
    for (const solicitudId of ['', '../talleres/T1', 'S1/privado/contacto', 42]) {
      const r = await m.solicitudPieza(peticion({ token: 'pase-taller-1', body: { solicitudId } }));
      expect(r.status).toBe(400);
    }
    const r = await m.solicitudPieza(peticion({ token: 'pase-taller-1', crudo: 'no es json' }));
    expect(r.status).toBe(400);
    expect(f.deps.leerComoUsuario).not.toHaveBeenCalled();
  });
  it('repetido: un solo aviso por pedido, los demás se ignoran', async () => {
    const f = crearFalsos();
    const m = crearManejadoresAvisos(f.deps);
    await m.solicitudPieza(peticion({ token: 'pase-taller-1', body: { solicitudId: 'S1' } }));
    const r = await m.solicitudPieza(peticion({ token: 'pase-taller-1', body: { solicitudId: 'S1' } }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, avisado: false, motivo: 'repetido' });
    f.avanzar(2 * HORA);
    await m.solicitudPieza(peticion({ token: 'pase-taller-1', body: { solicitudId: 'S1' } }));
    expect(f.deps.notificar).toHaveBeenCalledTimes(1);
  });
  it(`tope de ${MAX_AVISOS_SOLICITUD_TALLER_HORA} avisos por taller por hora; a la hora siguiente vuelve a avisar`, async () => {
    const f = crearFalsos();
    for (let i = 0; i < 12; i++) f.docs[`solicitudesPiezas/P${i}`] = solicitud('T1');
    const m = crearManejadoresAvisos(f.deps);
    const estados = [];
    for (let i = 0; i < 11; i++) estados.push((await m.solicitudPieza(peticion({ token: 'pase-taller-1', body: { solicitudId: `P${i}` } }))).status);
    expect(estados.slice(0, 10)).toEqual(Array(10).fill(200));
    expect(estados[10]).toBe(429);
    expect(f.deps.notificar).toHaveBeenCalledTimes(10);
    // Otro taller no se ve afectado por el tope del primero.
    expect((await m.solicitudPieza(peticion({ token: 'pase-taller-2', body: { solicitudId: 'S2' } }))).status).toBe(200);
    f.avanzar(HORA);
    expect((await m.solicitudPieza(peticion({ token: 'pase-taller-1', body: { solicitudId: 'P11' } }))).status).toBe(200);
  });
  it('si el contador falla: no hay aviso (falla cerrada) y la respuesta no truena', async () => {
    const f = crearFalsos({ contar: vi.fn(async () => { throw new Error('permission-denied'); }) });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await crearManejadoresAvisos(f.deps).solicitudPieza(peticion({ token: 'pase-taller-1', body: { solicitudId: 'S1' } }));
    expect(r.status).toBe(429);
    expect(f.deps.notificar).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
  it('sin usuario de servicio (faltan credenciales): no hay aviso', async () => {
    const f = crearFalsos({ obtenerDb: vi.fn(async () => null) });
    const r = await crearManejadoresAvisos(f.deps).solicitudPieza(peticion({ token: 'pase-taller-1', body: { solicitudId: 'S1' } }));
    expect(r.status).toBe(503);
    expect(f.deps.notificar).not.toHaveBeenCalled();
  });
});

describe('aviso de "nuevo yonke registrado" (yonke recién registrado, con sesión)', () => {
  it('con su pase: avisa con su ficha y su correo guardados, una sola vez', async () => {
    const f = crearFalsos();
    const m = crearManejadoresAvisos(f.deps);
    const r = await m.registroYonke(peticion({ token: 'pase-yonke-nuevo', body: { nombre: 'FALSO' } }));
    expect(await r.json()).toEqual({ ok: true, avisado: true });
    const mensaje = f.deps.notificar.mock.calls[0][0];
    expect(mensaje).toContain('Nombre: Yonke Nuevo');
    expect(mensaje).toContain('Ciudad: Tijuana');
    expect(mensaje).toContain('Teléfono: 6641234567');
    expect(mensaje).toContain('Correo: yonke@ejemplo.com');
    expect(mensaje).not.toContain('FALSO');
    const otra = await m.registroYonke(peticion({ token: 'pase-yonke-nuevo' }));
    expect(await otra.json()).toEqual({ ok: true, avisado: false, motivo: 'repetido' });
    expect(f.deps.notificar).toHaveBeenCalledTimes(1);
  });
  it('sin pase o con pase falso: 401', async () => {
    const f = crearFalsos();
    const m = crearManejadoresAvisos(f.deps);
    expect((await m.registroYonke(peticion({}))).status).toBe(401);
    expect((await m.registroYonke(peticion({ token: 'pase-inventado-que-google-rechaza' }))).status).toBe(401);
    expect(f.deps.notificar).not.toHaveBeenCalled();
  });
  it('un taller (no yonke) no puede disparar el aviso de registro: 403', async () => {
    const f = crearFalsos();
    expect((await crearManejadoresAvisos(f.deps).registroYonke(peticion({ token: 'pase-taller-1' }))).status).toBe(403);
    expect(f.deps.notificar).not.toHaveBeenCalled();
  });
  it('usuario que apunta a un yonke que no es suyo: 403', async () => {
    const f = crearFalsos();
    f.docs['usuarios/uidY1'] = { rol: 'yonke', yonkeId: 'YE', email: 'x@y.com' };
    expect((await crearManejadoresAvisos(f.deps).registroYonke(peticion({ token: 'pase-yonke-nuevo' }))).status).toBe(403);
    expect(f.deps.notificar).not.toHaveBeenCalled();
  });
});

describe('aviso de "entrega inmediata" (cliente sin cuenta)', () => {
  const cuerpo = (yonkeId = 'YE') => ({ yonkeId, pieza: 'Alternador', marca: 'Nissan', modelo: 'Sentra', anio: 2010, yonkeNombre: 'FALSO' });

  it('yonke con entrega inmediata: avisa con el nombre GUARDADO del yonke', async () => {
    const f = crearFalsos();
    const r = await crearManejadoresAvisos(f.deps).entregaInmediata(peticion({ body: cuerpo() }));
    expect(await r.json()).toEqual({ ok: true, avisado: true });
    const mensaje = f.deps.notificar.mock.calls[0][0];
    expect(mensaje).toBe('⚡ PEDIDO ENTREGA INMEDIATA\nPieza: Alternador\nVehículo: Nissan Sentra 2010\nYonke: Yonke Exprés');
  });
  it('yonke que no existe, sin entrega inmediata o inactivo: 404 y no avisa', async () => {
    const f = crearFalsos();
    const m = crearManejadoresAvisos(f.deps);
    for (const id of ['NOEXISTE', 'YN', 'YI']) {
      expect((await m.entregaInmediata(peticion({ body: cuerpo(id) }))).status).toBe(404);
    }
    expect(f.deps.notificar).not.toHaveBeenCalled();
  });
  it('sin identificador de yonke o con uno raro: 400', async () => {
    const f = crearFalsos();
    const m = crearManejadoresAvisos(f.deps);
    expect((await m.entregaInmediata(peticion({ body: { pieza: 'x' } }))).status).toBe(400);
    expect((await m.entregaInmediata(peticion({ body: cuerpo('../usuarios/x') }))).status).toBe(400);
    expect((await m.entregaInmediata(peticion({ crudo: '{' }))).status).toBe(400);
    expect(f.deps.notificar).not.toHaveBeenCalled();
  });
  it(`límite de ${MAX_AVISOS_ENTREGA_IP_HORA} por hora por dirección de internet`, async () => {
    const f = crearFalsos();
    const m = crearManejadoresAvisos(f.deps);
    const estados = [];
    for (let i = 0; i < 6; i++) estados.push((await m.entregaInmediata(peticion({ body: cuerpo() }))).status);
    expect(estados).toEqual([200, 200, 200, 200, 200, 429]);
    // Otra dirección sí puede.
    expect((await m.entregaInmediata(peticion({ body: cuerpo(), ip: '200.9.9.9' }))).status).toBe(200);
    f.avanzar(HORA);
    expect((await m.entregaInmediata(peticion({ body: cuerpo() }))).status).toBe(200);
  });
  it(`tope total de ${MAX_AVISOS_ENTREGA_TOTAL_HORA} avisos por hora, aunque vengan de muchas direcciones`, async () => {
    const f = crearFalsos();
    const m = crearManejadoresAvisos(f.deps);
    const estados = [];
    for (let i = 0; i < 12; i++) estados.push((await m.entregaInmediata(peticion({ body: cuerpo(), ip: `10.0.0.${i}` }))).status);
    expect(estados.slice(0, 10)).toEqual(Array(10).fill(200));
    expect(estados.slice(10)).toEqual([429, 429]);
    expect(f.deps.notificar).toHaveBeenCalledTimes(10);
  });
  it('las peticiones a yonkes sin entrega inmediata no gastan el tope total', async () => {
    const f = crearFalsos();
    const m = crearManejadoresAvisos(f.deps);
    for (let i = 0; i < 20; i++) await m.entregaInmediata(peticion({ body: cuerpo('YN'), ip: `10.1.0.${i}` }));
    expect((await m.entregaInmediata(peticion({ body: cuerpo() }))).status).toBe(200);
  });
  it('si el contador falla: no hay aviso (falla cerrada)', async () => {
    const f = crearFalsos({ contar: vi.fn(async () => { throw new Error('unavailable'); }) });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await crearManejadoresAvisos(f.deps).entregaInmediata(peticion({ body: cuerpo() }))).status).toBe(429);
    expect(f.deps.notificar).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
  it('la dirección de internet no se guarda en claro en la clave del contador', async () => {
    const f = crearFalsos();
    await crearManejadoresAvisos(f.deps).entregaInmediata(peticion({ body: cuerpo(), ip: '200.1.2.3' }));
    expect([...f.contadores.keys()].join(' ')).not.toContain('200.1.2.3');
  });
});
