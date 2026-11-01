import { describe, expect, it, vi } from 'vitest';
import { claveLimite } from '../../../lib/pedidosClientesServidor';
import { crearManejadorLiberar } from './liberar';

const INTERNO = '6641234567@yonkes.mecanixyonkevirtual.com';
const PASES = { 'pase-admin': 'uidAdmin', 'pase-yonke': 'uidY' };
function crearFalsos(cambios = {}) {
  const docs = {
    'usuarios/uidAdmin': { rol: 'admin', email: INTERNO },
    'usuarios/uidY': { rol: 'yonke', yonkeId: 'Y9', email: 'real@correo.mx' },
    'usuarios/uidL': { rol: 'yonkeLigero', yonkeId: 'YL', email: INTERNO },
    'usuarios/uidC': { rol: 'yonke', yonkeId: 'YC', email: '6649998877@yonkes.mecanixyonkevirtual.com' },
    'usuarios/uidS': { rol: 'servicio', email: INTERNO },
  };
  const deps = {
    uidDeToken: vi.fn(async (t) => PASES[t] ?? null),
    leerComoUsuario: vi.fn(async (_t, ruta) => docs[ruta] ?? null),
    borrarComoUsuario: vi.fn(async () => true),
    credenciales: vi.fn(() => ({ clientEmail: 'c', privateKey: 'k' })),
    borrarCuenta: vi.fn(async () => {}),
    claveLimite,
    notificar: vi.fn(async () => {}),
    ...cambios,
  };
  return { deps, m: crearManejadorLiberar(deps) };
}
const peticion = ({ token = 'pase-admin', cuerpo = { usuarioId: 'uidL' } } = {}) => new Request('https://x.mx/api/admin/liberar-numero', {
  method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
});

describe('liberar un número', () => {
  it('quita la huella de ESE número y la cuenta, con el pase del admin', async () => {
    const f = crearFalsos();
    const r = await f.m(peticion());
    expect(await r.json()).toEqual({ ok: true, huella: true, cuenta: true });
    expect(f.deps.borrarComoUsuario).toHaveBeenCalledWith('pase-admin', `pedidosClientesLimite/${claveLimite('ligeroWa', '6641234567', 'unico')}`);
    expect(f.deps.borrarCuenta).toHaveBeenCalledWith({ clientEmail: 'c', privateKey: 'k' }, 'uidL');
    expect(f.deps.notificar).toHaveBeenCalledTimes(1);
  });
  it('también un yonke ya completo que entra con WhatsApp', async () => {
    expect((await crearFalsos().m(peticion({ cuerpo: { usuarioId: 'uidC' } }))).status).toBe(200);
  });
  it('sin llave: quita la huella y dice que falta la cuenta', async () => {
    const f = crearFalsos({ credenciales: vi.fn(() => null) });
    expect(await (await f.m(peticion())).json()).toEqual({ ok: false, huella: true, cuenta: false });
    expect(f.deps.borrarCuenta).not.toHaveBeenCalled();
    expect(f.deps.notificar.mock.calls[0][0]).toContain('Falta borrar la cuenta');
  });
  it('si Google falla: lo dice, sin tronar', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const f = crearFalsos({ borrarCuenta: vi.fn(async () => { throw new Error('HTTP 403'); }) });
    expect(await (await f.m(peticion())).json()).toEqual({ ok: false, huella: true, cuenta: false });
    vi.restoreAllMocks();
  });
  it('si el aviso falla, sigue', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = crearFalsos({ notificar: vi.fn(async () => { throw new Error('x'); }) });
    expect((await f.m(peticion())).status).toBe(200);
    vi.restoreAllMocks();
  });
});

describe('quién y a qué cuentas', () => {
  it('sin sesión: 401; un yonke: 403', async () => {
    const f = crearFalsos();
    expect((await f.m(peticion({ token: '' }))).status).toBe(401);
    expect((await f.m(peticion({ token: 'pase-yonke' }))).status).toBe(403);
    expect(f.deps.borrarCuenta).not.toHaveBeenCalled();
  });
  it('NO a correo normal, admin, servicio o inexistente', async () => {
    const f = crearFalsos();
    for (const usuarioId of ['uidY', 'uidAdmin', 'uidS', 'noExiste']) expect((await f.m(peticion({ cuerpo: { usuarioId } }))).status).toBe(400);
    expect(f.deps.borrarComoUsuario).not.toHaveBeenCalled();
    expect(f.deps.borrarCuenta).not.toHaveBeenCalled();
  });
  it('cuerpo roto o id raro: 400', async () => {
    const f = crearFalsos();
    for (const cuerpo of ['{roto', {}, { usuarioId: '../x' }]) expect((await f.m(peticion({ cuerpo }))).status).toBe(400);
  });
});
