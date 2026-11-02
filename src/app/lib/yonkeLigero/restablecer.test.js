import { describe, expect, it, vi } from 'vitest';
import { claveLimite } from '../../../lib/pedidosClientesServidor';
import { MAX_RESTABLECER_DIA, crearManejadorRestablecer } from './restablecer';

const INTERNO = '6641234567@yonkes.mecanixyonkevirtual.com';
const PASES = { 'pase-admin': 'uidAdmin', 'pase-yonke': 'uidY', 'pase-taller': 'uidT' };
const TEMPORAL = 'Temporal-Secreta-99';
const BLOQUEO = 'bloqueo-que-nadie-conoce';

function crearFalsos(cambios = {}) {
  const deshacer = vi.fn(async () => {});
  const docs = {
    'usuarios/uidAdmin': { rol: 'admin', email: INTERNO }, // ni con correo interno se toca a un admin
    'usuarios/uidY': { rol: 'yonke', yonkeId: 'Y9', email: 'real@correo.mx' },
    'usuarios/uidT': { rol: 'taller', tallerId: 'T1', email: 't@t.mx' },
    'usuarios/uidL': { rol: 'yonkeLigero', yonkeId: 'YL', email: INTERNO },
    'usuarios/uidC': { rol: 'yonke', yonkeId: 'YC', email: '6649998877@yonkes.mecanixyonkevirtual.com' },
    'usuarios/uidS': { rol: 'servicio', email: INTERNO },
    'yonkes/YL': { nombre: 'Yonke Ligero' },
  };
  const deps = {
    uidDeToken: vi.fn(async (t) => PASES[t] ?? null),
    leerComoUsuario: vi.fn(async (_t, ruta) => docs[ruta] ?? null),
    credenciales: vi.fn(() => ({ clientEmail: 'c', privateKey: 'k' })),
    obtenerDb: vi.fn(async () => ({ falso: true })),
    contar: vi.fn(async () => true),
    claveLimite,
    generarTemporal: vi.fn(() => TEMPORAL),
    generarBloqueo: vi.fn(() => BLOQUEO),
    hashCodigo: vi.fn((c) => `hash-${c}`),
    guardarCodigo: vi.fn(async () => deshacer),
    cambiarPassword: vi.fn(async () => {}),
    notificar: vi.fn(async () => {}),
    ahora: () => new Date('2026-11-01T18:00:00Z'),
    ...cambios,
  };
  return { deps, deshacer, m: crearManejadorRestablecer(deps) };
}
const peticion = ({ token = 'pase-admin', cuerpo = { usuarioId: 'uidL' } } = {}) => new Request('https://x.mx/api/admin/restablecer-password', {
  method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
});

describe('restablecer contraseña', () => {
  it('el admin recibe el código una vez; la contraseña queda en una que nadie conoce', async () => {
    const f = crearFalsos();
    const r = await f.m(peticion());
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, temporal: TEMPORAL });
    expect(f.deps.cambiarPassword).toHaveBeenCalledWith({ clientEmail: 'c', privateKey: 'k' }, 'uidL', BLOQUEO);
    expect(r.headers.get('Cache-Control')).toBe('no-store');
  });
  it('guarda solo el hash, 24 horas, por WhatsApp, con el admin que lo generó', async () => {
    const f = crearFalsos();
    await f.m(peticion());
    const [, guardado] = f.deps.guardarCodigo.mock.calls[0];
    expect(guardado).toEqual({
      clave: claveLimite('codigoWa', '6641234567', 'unico'), uid: 'uidL', yonkeId: 'YL', adminUid: 'uidAdmin',
      codigoHash: `hash-${TEMPORAL}`, expiraAt: new Date('2026-11-02T18:00:00Z'),
    });
    expect(JSON.stringify(guardado)).not.toContain(`"${TEMPORAL}"`);
  });
  it('un yonke ya completo que entra con WhatsApp también', async () => {
    expect((await crearFalsos().m(peticion({ cuerpo: { usuarioId: 'uidC' } }))).status).toBe(200);
  });
  it('te avisa con el nombre del yonke y sin la contraseña; si el aviso falla, sigue', async () => {
    const f = crearFalsos();
    await f.m(peticion());
    const aviso = f.deps.notificar.mock.calls[0][0];
    expect(aviso).toContain('Yonke Ligero');
    expect(aviso).not.toContain(TEMPORAL);
    const g = crearFalsos({ notificar: vi.fn(async () => { throw new Error('x'); }) });
    expect((await g.m(peticion())).status).toBe(200);
  });
});

describe('quién puede', () => {
  it('sin sesión o con pase falso: 401', async () => {
    const f = crearFalsos();
    expect((await f.m(peticion({ token: '' }))).status).toBe(401);
    expect((await f.m(peticion({ token: 'pase-falso' }))).status).toBe(401);
    expect(f.deps.cambiarPassword).not.toHaveBeenCalled();
  });
  it('un yonke o un taller: 403', async () => {
    const f = crearFalsos();
    for (const token of ['pase-yonke', 'pase-taller']) expect((await f.m(peticion({ token }))).status).toBe(403);
    expect(f.deps.cambiarPassword).not.toHaveBeenCalled();
  });
});

describe('a qué cuentas', () => {
  it('NO a correo normal, taller, admin, servicio ni cuentas inexistentes', async () => {
    const f = crearFalsos();
    for (const usuarioId of ['uidY', 'uidT', 'uidAdmin', 'uidS', 'noExiste']) {
      const r = await f.m(peticion({ cuerpo: { usuarioId } }));
      expect(r.status).toBe(400);
      expect((await r.json()).motivo).toBe('noAplica');
    }
    expect(f.deps.cambiarPassword).not.toHaveBeenCalled();
  });
  it('cuerpo roto o id raro: 400', async () => {
    const f = crearFalsos();
    for (const cuerpo of ['{roto', {}, { usuarioId: '../yonkes/x' }, { usuarioId: 5 }]) expect((await f.m(peticion({ cuerpo }))).status).toBe(400);
  });
});

describe('fallas', () => {
  it('sin llave: "no configurado", y no gasta el contador', async () => {
    const f = crearFalsos({ credenciales: vi.fn(() => null) });
    const r = await f.m(peticion());
    expect(r.status).toBe(503);
    expect((await r.json()).motivo).toBe('noConfigurado');
    expect(f.deps.contar).not.toHaveBeenCalled();
  });
  it('límite diario, y si el contador falla se niega', async () => {
    const f = crearFalsos({ contar: vi.fn(async () => false) });
    expect((await f.m(peticion())).status).toBe(429);
    expect(f.deps.contar.mock.calls[0][2]).toBe(MAX_RESTABLECER_DIA);
    const g = crearFalsos({ contar: vi.fn(async () => { throw new Error('x'); }) });
    expect((await g.m(peticion())).status).toBe(503);
    expect(g.deps.cambiarPassword).not.toHaveBeenCalled();
  });
  it('si Google falla, deshace el código y no lo muestra ni avisa', async () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {});
    const f = crearFalsos({ cambiarPassword: vi.fn(async () => { throw new Error('HTTP 403'); }) });
    const r = await f.m(peticion());
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain(TEMPORAL);
    expect(f.deshacer).toHaveBeenCalled();
    expect(f.deps.notificar).not.toHaveBeenCalled();
    expect(JSON.stringify(consola.mock.calls)).not.toContain(TEMPORAL);
    consola.mockRestore();
  });
});
