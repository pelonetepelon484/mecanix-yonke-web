import { beforeEach, describe, expect, it, vi } from 'vitest';
import { claveLimite } from '../../../lib/pedidosClientesServidor';
import { MENSAJES_LIGERO } from '../../../lib/yonkeLigero';
import { VIDA_HUELLA_MS, crearManejadorRegistroLigero } from './manejadores';

const AHORA = new Date('2026-11-01T18:00:00Z');
const ID = 'Pedido00000000000007';
const fecha = (ms) => ({ toDate: () => new Date(AHORA.getTime() + ms) });
const CONTRASENA = 'contrasena-secreta-123';

function crearFalsos(cambios = {}) {
  const huellas = new Set();
  const cuenta = { uid: 'uidNuevo', borrar: vi.fn(async () => {}), cerrar: vi.fn(async () => {}) };
  const deps = {
    leerConfig: vi.fn(async () => ({ habilitado: true })),
    obtenerDb: vi.fn(async () => ({ falso: true })),
    contar: vi.fn(async () => true),
    claveLimite,
    leerPedido: vi.fn(async () => ({ estadoPedido: 'abierta', estado: 'sonora', expiraAt: fecha(1000) })),
    huellaExiste: vi.fn(async (_db, h) => huellas.has(h)),
    leerYonkes: vi.fn(async () => [{ whatsapp: '6649998877', telefono: '664 777 6655' }]),
    versionTerminos: vi.fn(async () => '2026-10-26'),
    crearCuenta: vi.fn(async () => cuenta),
    guardar: vi.fn(async (_db, d) => {
      if (huellas.has(d.huella)) return 'yaUsada';
      huellas.add(d.huella);
      return 'ok';
    }),
    notificar: vi.fn(async () => {}),
    nombreEstado: vi.fn(async () => 'Sonora'),
    ahora: () => AHORA,
    ...cambios,
  };
  return { deps, cuenta, huellas, m: crearManejadorRegistroLigero(deps) };
}
const peticion = (cuerpo = {}, ip = '1.1.1.1') => new Request('https://x.mx/api/yonkes/registro-ligero', {
  method: 'POST', headers: { 'x-forwarded-for': ip },
  body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify({ nombre: 'Yonke Tigre', whatsapp: '664 123 4567', password: CONTRASENA, aceptaTerminos: true, pedidoId: ID, ...cuerpo }),
});

beforeEach(() => { vi.restoreAllMocks(); });

describe('alta del yonke ligero', () => {
  it('crea la cuenta y guarda, con el estado de la alerta, el correo interno y la huella', async () => {
    const f = crearFalsos();
    const r = await f.m(peticion({ estado: 'jalisco' }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, estado: 'sonora' });
    expect(f.deps.crearCuenta).toHaveBeenCalledWith('6641234567@yonkes.mecanixyonkevirtual.com', CONTRASENA);
    expect(f.deps.guardar.mock.calls[0][1]).toEqual({
      uid: 'uidNuevo', nombre: 'Yonke Tigre', whatsapp: '6641234567', estado: 'sonora', correo: '6641234567@yonkes.mecanixyonkevirtual.com',
      version: '2026-10-26', huella: claveLimite('ligeroWa', '6641234567', 'unico'), vidaHuellaMs: VIDA_HUELLA_MS,
    });
    expect(f.cuenta.borrar).not.toHaveBeenCalled();
    expect(f.cuenta.cerrar).toHaveBeenCalledTimes(1);
  });

  it('avisa al admin sin el número ni la contraseña, y si el aviso falla el registro sigue', async () => {
    const f = crearFalsos();
    await f.m(peticion());
    const mensaje = f.deps.notificar.mock.calls[0][0];
    expect(mensaje).toContain('Yonke Tigre');
    expect(mensaje).toContain('Sonora');
    expect(mensaje).not.toContain('6641234567');
    expect(mensaje).not.toContain(CONTRASENA);
    const g = crearFalsos({ notificar: vi.fn(async () => { throw new Error('sin red'); }) });
    expect((await g.m(peticion())).status).toBe(200);
  });

  it('la huella se guarda con el número ya normalizado: el mismo número en otro formato no pasa', async () => {
    const f = crearFalsos();
    expect((await f.m(peticion({ whatsapp: '6641234567' }))).status).toBe(200);
    const r = await f.m(peticion({ whatsapp: '+52 (664) 123-4567' }));
    expect(r.status).toBe(409);
    expect((await r.json()).mensaje).toBe(MENSAJES_LIGERO.yaRegistrado);
    expect(f.deps.crearCuenta).toHaveBeenCalledTimes(1);
  });
});

describe('bandera', () => {
  it('apagada, ausente, de texto o sin poder leerla: no disponible y no toca nada', async () => {
    for (const leerConfig of [async () => null, async () => ({ habilitado: false }), async () => ({ habilitado: 'true' }), async () => { throw new Error('x'); }]) {
      const f = crearFalsos({ leerConfig });
      expect((await f.m(peticion())).status).toBe(503);
      expect(f.deps.obtenerDb).not.toHaveBeenCalled();
      expect(f.deps.crearCuenta).not.toHaveBeenCalled();
    }
  });
  it('sin usuario de servicio: no disponible', async () => {
    const f = crearFalsos({ obtenerDb: vi.fn(async () => null) });
    expect((await f.m(peticion())).status).toBe(503);
  });
});

describe('datos', () => {
  it('cuerpo roto o dato inválido: 400, sin gastar contadores', async () => {
    const f = crearFalsos();
    expect((await f.m(peticion('{no es json'))).status).toBe(400);
    for (const malo of [{ whatsapp: '123' }, { password: 'corta' }, { aceptaTerminos: false }, { nombre: 'Yonke Mecanix' }, { pedidoId: 'x' }]) {
      expect((await f.m(peticion(malo))).status).toBe(400);
    }
    expect(f.deps.contar).not.toHaveBeenCalled();
  });
});

describe('límites', () => {
  const porTipo = (tipo, n) => vi.fn(async (_db, clave) => !clave.startsWith(tipo) || n);
  it('por IP: 429 antes de leer la alerta, y cada IP cuenta aparte', async () => {
    const f = crearFalsos({ contar: porTipo('ligeroIp', false) });
    const r = await f.m(peticion());
    expect(r.status).toBe(429);
    expect((await r.json()).mensaje).toBe(MENSAJES_LIGERO.limite);
    expect(f.deps.leerPedido).not.toHaveBeenCalled();
    const g = crearFalsos();
    await g.m(peticion({}, '2.2.2.2'));
    await g.m(peticion({ whatsapp: '6641234560' }, '3.3.3.3'));
    const [uno, dos] = g.deps.contar.mock.calls.filter(([, c]) => c.startsWith('ligeroIp')).map(([, c]) => c);
    expect(uno).not.toBe(dos);
  });
  it('respeta los topes de config/yonkesLigeros', async () => {
    const f = crearFalsos({ leerConfig: vi.fn(async () => ({ habilitado: true, maxPorIpDia: 2, maxPorDia: 9 })) });
    await f.m(peticion());
    const topes = Object.fromEntries(f.deps.contar.mock.calls.map(([, c, max]) => [c.split('_')[0], max]));
    expect(topes).toEqual({ ligeroIp: 2, ligeroDia: 9 });
  });
  it('máximo del día: 429 sin crear cuenta, y un número repetido no lo gasta', async () => {
    const f = crearFalsos({ contar: porTipo('ligeroDia', false) });
    expect((await f.m(peticion())).status).toBe(429);
    expect(f.deps.crearCuenta).not.toHaveBeenCalled();
    const g = crearFalsos();
    await g.m(peticion({ whatsapp: '6649998877' }));
    expect(g.deps.contar.mock.calls.some(([, c]) => c.startsWith('ligeroDia'))).toBe(false);
  });
  it('si el contador falla, se niega (falla cerrada)', async () => {
    const f = crearFalsos({ contar: vi.fn(async () => { throw new Error('sin red'); }) });
    expect((await f.m(peticion())).status).toBe(429);
    expect(f.deps.crearCuenta).not.toHaveBeenCalled();
  });
});

describe('alerta', () => {
  it('vencida, cerrada o inexistente: 410 y nada creado', async () => {
    for (const leerPedido of [
      async () => null,
      async () => ({ estadoPedido: 'cerrada', estado: 'sonora', expiraAt: fecha(1000) }),
      async () => ({ estadoPedido: 'abierta', estado: 'sonora', expiraAt: fecha(-1000) }),
    ]) {
      const f = crearFalsos({ leerPedido });
      const r = await f.m(peticion());
      expect(r.status).toBe(410);
      expect((await r.json()).motivo).toBe('alerta');
      expect(f.deps.crearCuenta).not.toHaveBeenCalled();
    }
  });
});

describe('número ya registrado', () => {
  it('contra un yonke completo, por WhatsApp o teléfono en formato libre', async () => {
    for (const whatsapp of ['6649998877', '6647776655']) {
      const f = crearFalsos();
      expect((await f.m(peticion({ whatsapp }))).status).toBe(409);
      expect(f.deps.crearCuenta).not.toHaveBeenCalled();
    }
  });
  it('si la cuenta ya existe en Firebase (número apartado): 409', async () => {
    const f = crearFalsos({ crearCuenta: vi.fn(async () => { throw Object.assign(new Error('x'), { code: 'auth/email-already-in-use' }); }) });
    expect((await f.m(peticion())).status).toBe(409);
    expect(f.deps.guardar).not.toHaveBeenCalled();
  });
  it('dos registros simultáneos: solo pasa uno, y la cuenta del otro se borra', async () => {
    const f = crearFalsos({ guardar: vi.fn(async () => 'yaUsada') });
    expect((await f.m(peticion())).status).toBe(409);
    expect(f.cuenta.borrar).toHaveBeenCalledTimes(1);
    expect(f.deps.notificar).not.toHaveBeenCalled();
  });
});

describe('si algo falla a medias', () => {
  it('si no se pudo guardar, borra la cuenta y cierra su conexión', async () => {
    const f = crearFalsos({ guardar: vi.fn(async () => { throw new Error('permission-denied'); }) });
    expect((await f.m(peticion())).status).toBe(503);
    expect(f.cuenta.borrar).toHaveBeenCalledTimes(1);
    expect(f.cuenta.cerrar).toHaveBeenCalledTimes(1);
  });
  it('si falla crear la cuenta: no disponible, sin guardar', async () => {
    const f = crearFalsos({ crearCuenta: vi.fn(async () => { throw Object.assign(new Error('x'), { code: 'auth/network-request-failed' }); }) });
    expect((await f.m(peticion())).status).toBe(503);
    expect(f.deps.guardar).not.toHaveBeenCalled();
  });
});

describe('la contraseña nunca sale', () => {
  it('ni en respuestas ni en registros, ni cuando algo falla', async () => {
    const consola = [vi.spyOn(console, 'error').mockImplementation(() => {}), vi.spyOn(console, 'warn').mockImplementation(() => {}), vi.spyOn(console, 'log').mockImplementation(() => {})];
    for (const cambios of [{}, { guardar: vi.fn(async () => { throw new Error('x'); }) }, { crearCuenta: vi.fn(async () => { throw new Error('x'); }) }, { notificar: vi.fn(async () => { throw new Error('x'); }) }]) {
      const f = crearFalsos(cambios);
      const r = await f.m(peticion());
      expect(await r.text()).not.toContain(CONTRASENA);
      expect(JSON.stringify(f.deps.guardar.mock.calls)).not.toContain(CONTRASENA);
      expect(JSON.stringify(f.deps.notificar.mock.calls)).not.toContain(CONTRASENA);
    }
    expect(JSON.stringify(consola.flatMap((c) => c.mock.calls))).not.toContain(CONTRASENA);
  });
});
