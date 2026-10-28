import { describe, expect, it, vi } from 'vitest';
import { ErrorRegistro, registrarRefaccionaria, type DependenciasRegistroRefaccionaria } from './registrarRefaccionaria';

const datos = { email: 'piston@prueba.mx', password: 'abcdefgh' };

function depsOk(): DependenciasRegistroRefaccionaria {
  return {
    crearCuenta: vi.fn(async () => 'uid-1'),
    generarRefaccionariaId: vi.fn(() => 'R-1'),
    crearRefaccionaria: vi.fn(async () => {}),
    crearUsuario: vi.fn(async () => {}),
    borrarRefaccionaria: vi.fn(async () => {}),
    borrarCuenta: vi.fn(async () => {}),
    aceptarVersion: vi.fn(async () => {}),
  };
}
async function errorDe(p: Promise<unknown>): Promise<ErrorRegistro> {
  try { await p; } catch (e) { return e as ErrorRegistro; }
  throw new Error('se esperaba un error');
}

describe('registrarRefaccionaria', () => {
  it('cuenta, refaccionaria, usuario y aceptación, en ese orden', async () => {
    const dep = depsOk();
    expect(await registrarRefaccionaria(datos, dep)).toEqual({ uid: 'uid-1', refaccionariaId: 'R-1', aceptada: true });
    expect(dep.crearRefaccionaria).toHaveBeenCalledWith('R-1', 'uid-1');
    expect(dep.crearUsuario).toHaveBeenCalledWith('uid-1', 'R-1', 'piston@prueba.mx');
    expect(dep.aceptarVersion).toHaveBeenCalledWith('R-1');
    expect(dep.borrarCuenta).not.toHaveBeenCalled();
  });
  it('correo ya usado: error claro, sin crear nada', async () => {
    const dep = { ...depsOk(), crearCuenta: vi.fn(async () => { throw Object.assign(new Error('x'), { code: 'auth/email-already-in-use' }); }) };
    expect((await errorDe(registrarRefaccionaria(datos, dep))).codigo).toBe('correo-existe');
    expect(dep.crearRefaccionaria).not.toHaveBeenCalled();
  });
  it('falla la refaccionaria (p. ej. bandera apagada en las reglas): se borra la cuenta', async () => {
    const dep = { ...depsOk(), crearRefaccionaria: vi.fn(async () => { throw new Error('permission-denied'); }) };
    expect((await errorDe(registrarRefaccionaria(datos, dep))).codigo).toBe('refaccionaria');
    expect(dep.borrarCuenta).toHaveBeenCalled();
    expect(dep.crearUsuario).not.toHaveBeenCalled();
  });
  it('falla el usuario: se borran la refaccionaria y la cuenta; si el borrado falla, "a medias"', async () => {
    const dep = { ...depsOk(), crearUsuario: vi.fn(async () => { throw new Error('x'); }) };
    expect((await errorDe(registrarRefaccionaria(datos, dep))).codigo).toBe('usuario');
    expect(dep.borrarRefaccionaria).toHaveBeenCalledWith('R-1');
    expect(dep.borrarCuenta).toHaveBeenCalled();
    const dep2 = { ...dep, borrarRefaccionaria: vi.fn(async () => { throw new Error('y'); }) };
    expect((await errorDe(registrarRefaccionaria(datos, dep2))).codigo).toBe('a-medias');
  });
  it('si falla la aceptación, la cuenta se queda (aceptará al entrar)', async () => {
    const dep = { ...depsOk(), aceptarVersion: vi.fn(async () => { throw new Error('sin versión'); }) };
    expect(await registrarRefaccionaria(datos, dep)).toEqual({ uid: 'uid-1', refaccionariaId: 'R-1', aceptada: false });
    expect(dep.borrarCuenta).not.toHaveBeenCalled();
  });
});
