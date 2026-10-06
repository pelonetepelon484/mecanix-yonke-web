import { describe, expect, it, vi } from 'vitest';
import { ErrorRegistro, registrarTaller, type DependenciasRegistroTaller } from './registrarTaller';

const datos = { email: 'pepe@taller.mx', password: 'abcdefgh', nombre: 'Taller Pepe', whatsapp: '6641234567', ciudad: 'Tijuana' };

function depsOk(): DependenciasRegistroTaller {
  return {
    crearCuenta: vi.fn(async () => 'uid-1'),
    generarTallerId: vi.fn(() => 'T-1'),
    crearTaller: vi.fn(async () => {}),
    crearUsuario: vi.fn(async () => {}),
    borrarTaller: vi.fn(async () => {}),
    borrarCuenta: vi.fn(async () => {}),
  };
}

async function errorDe(p: Promise<unknown>): Promise<ErrorRegistro> {
  try {
    await p;
  } catch (e) {
    return e as ErrorRegistro;
  }
  throw new Error('se esperaba un error');
}

describe('registrarTaller', () => {
  it('crea cuenta, taller y usuario, en ese orden, y devuelve los ids', async () => {
    const dep = depsOk();
    const r = await registrarTaller(datos, dep);
    expect(r).toEqual({ uid: 'uid-1', tallerId: 'T-1' });
    expect(dep.crearTaller).toHaveBeenCalledWith('T-1', 'uid-1');
    expect(dep.crearUsuario).toHaveBeenCalledWith('uid-1', 'T-1', 'pepe@taller.mx');
    expect(dep.borrarCuenta).not.toHaveBeenCalled();
  });

  it('correo ya registrado: no crea nada y avisa', async () => {
    const dep = depsOk();
    dep.crearCuenta = vi.fn(async () => { throw Object.assign(new Error('x'), { code: 'auth/email-already-in-use' }); });
    const e = await errorDe(registrarTaller(datos, dep));
    expect(e.codigo).toBe('correo-existe');
    expect(dep.crearTaller).not.toHaveBeenCalled();
  });

  it('si falla el taller, borra la cuenta recién creada', async () => {
    const dep = depsOk();
    dep.crearTaller = vi.fn(async () => { throw new Error('permiso'); });
    const e = await errorDe(registrarTaller(datos, dep));
    expect(e.codigo).toBe('taller');
    expect(dep.borrarCuenta).toHaveBeenCalledTimes(1);
    expect(dep.crearUsuario).not.toHaveBeenCalled();
  });

  it('si falla el usuario, borra el taller y después la cuenta', async () => {
    const dep = depsOk();
    dep.crearUsuario = vi.fn(async () => { throw new Error('permiso'); });
    const orden: string[] = [];
    dep.borrarTaller = vi.fn(async () => { orden.push('taller'); });
    dep.borrarCuenta = vi.fn(async () => { orden.push('cuenta'); });
    const e = await errorDe(registrarTaller(datos, dep));
    expect(e.codigo).toBe('usuario');
    expect(orden).toEqual(['taller', 'cuenta']);
  });

  it('si el rollback también falla, avisa que la cuenta quedó a medias', async () => {
    const dep = depsOk();
    dep.crearUsuario = vi.fn(async () => { throw new Error('permiso'); });
    dep.borrarTaller = vi.fn(async () => { throw new Error('red'); });
    const e = await errorDe(registrarTaller(datos, dep));
    expect(e.codigo).toBe('a-medias');
    expect(dep.borrarCuenta).toHaveBeenCalledTimes(1);
  });

  it('si falla el taller y además no se puede borrar la cuenta, también es a-medias', async () => {
    const dep = depsOk();
    dep.crearTaller = vi.fn(async () => { throw new Error('permiso'); });
    dep.borrarCuenta = vi.fn(async () => { throw new Error('sesión vencida'); });
    const e = await errorDe(registrarTaller(datos, dep));
    expect(e.codigo).toBe('a-medias');
  });
});
