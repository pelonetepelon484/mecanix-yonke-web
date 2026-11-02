import { describe, expect, it, vi } from 'vitest';
import { claveLimite } from '../../../lib/pedidosClientesServidor';
import { MAX_INTENTOS_IP_DIA, MAX_INTENTOS_WHATSAPP_DIA, crearManejadorUsarCodigo } from './usarCodigo';

const CODIGO = 'abcdefghjkmn';
const NUEVA = 'contrasena-nueva';
const GUARDADO = { uid: 'uidL', codigoHash: 'h', expiraAt: 'vence' };

function crearFalsos(cambios = {}) {
  const deps = {
    credenciales: vi.fn(() => ({ clientEmail: 'c', privateKey: 'k' })),
    obtenerDb: vi.fn(async () => ({ falso: true })),
    contar: vi.fn(async () => true),
    claveLimite,
    reclamarCodigo: vi.fn(async () => GUARDADO),
    restaurarCodigo: vi.fn(async () => {}),
    cambiarPassword: vi.fn(async () => {}),
    ahora: () => new Date('2026-11-01T18:00:00Z'),
    ...cambios,
  };
  return { deps, m: crearManejadorUsarCodigo(deps) };
}
const peticion = (cuerpo = { whatsapp: '664 123 4567', codigo: ` ${CODIGO} `, password: NUEVA }) => new Request('https://x.mx/api/yonkes/usar-codigo', {
  method: 'POST', headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }, body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
});

describe('usar código temporal', () => {
  it('con código válido, consume el código y pone la contraseña nueva', async () => {
    const f = crearFalsos();
    const r = await f.m(peticion());
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    expect(f.deps.reclamarCodigo).toHaveBeenCalledWith({ falso: true }, claveLimite('codigoWa', '6641234567', 'unico'), CODIGO, f.deps.ahora());
    expect(f.deps.cambiarPassword).toHaveBeenCalledWith({ clientEmail: 'c', privateKey: 'k' }, 'uidL', NUEVA);
    expect(r.headers.get('Cache-Control')).toBe('no-store');
  });
  it('código incorrecto, usado, vencido o número sin código: mismo mensaje y no toca la cuenta', async () => {
    const f = crearFalsos({ reclamarCodigo: vi.fn(async () => null) });
    const r = await f.m(peticion());
    expect(r.status).toBe(400);
    expect((await r.json()).motivo).toBe('codigo');
    expect(f.deps.cambiarPassword).not.toHaveBeenCalled();
  });
  it('datos inválidos no gastan intentos', async () => {
    const f = crearFalsos();
    for (const cuerpo of [
      '{roto', {}, { whatsapp: '123', codigo: CODIGO, password: NUEVA }, { whatsapp: '6641234567', codigo: 'corto', password: NUEVA },
      { whatsapp: '6641234567', codigo: CODIGO, password: 'corta' }, { whatsapp: '6641234567', codigo: CODIGO, password: 'x'.repeat(129) },
    ]) expect((await f.m(peticion(cuerpo))).status).toBe(400);
    expect(f.deps.contar).not.toHaveBeenCalled();
  });
});

describe('límites y fallas', () => {
  it('cuenta por WhatsApp y por IP; al pasarse no revisa el código', async () => {
    const f = crearFalsos({ contar: vi.fn(async () => false) });
    expect((await f.m(peticion())).status).toBe(429);
    expect(f.deps.contar.mock.calls[0][2]).toBe(MAX_INTENTOS_WHATSAPP_DIA);
    expect(f.deps.reclamarCodigo).not.toHaveBeenCalled();
    const g = crearFalsos();
    await g.m(peticion());
    expect(g.deps.contar.mock.calls[1][1]).toBe(claveLimite('codigoIntentoIp', '1.2.3.4', Math.floor(g.deps.ahora().getTime() / 86400000)));
    expect(g.deps.contar.mock.calls[1][2]).toBe(MAX_INTENTOS_IP_DIA);
  });
  it('si el contador falla, se niega', async () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {});
    const f = crearFalsos({ contar: vi.fn(async () => { throw new Error('x'); }) });
    expect((await f.m(peticion())).status).toBe(503);
    expect(f.deps.reclamarCodigo).not.toHaveBeenCalled();
    consola.mockRestore();
  });
  it('sin llave no gasta intentos', async () => {
    const f = crearFalsos({ credenciales: vi.fn(() => null) });
    expect((await f.m(peticion())).status).toBe(503);
    expect(f.deps.contar).not.toHaveBeenCalled();
  });
  it('si Google falla, restaura el código y no escribe secretos en los registros', async () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {});
    const f = crearFalsos({ cambiarPassword: vi.fn(async () => { throw new Error('HTTP 403'); }) });
    expect((await f.m(peticion())).status).toBe(503);
    expect(f.deps.restaurarCodigo).toHaveBeenCalledWith({ falso: true }, claveLimite('codigoWa', '6641234567', 'unico'), GUARDADO);
    const registros = JSON.stringify(consola.mock.calls);
    expect(registros).not.toContain(CODIGO);
    expect(registros).not.toContain(NUEVA);
    consola.mockRestore();
  });
});
