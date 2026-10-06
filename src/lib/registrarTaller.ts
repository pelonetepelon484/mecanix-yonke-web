// Registro del taller en pasos uno por uno, con rollback. Las llamadas a Firebase llegan por
// "dependencias" para poder probar el orden y los fallos sin conexión (ver registrarTaller.test.ts).
// Orden: 1) cuenta de correo, 2) taller con ownerUid, 3) usuario con rol 'taller'.
// Si 3 falla: se borra el taller y la cuenta. Si 2 falla: solo se borra la cuenta.

export type ErrorRegistroTaller = 'correo-existe' | 'taller' | 'usuario' | 'a-medias';

export class ErrorRegistro extends Error {
  constructor(public codigo: ErrorRegistroTaller) {
    super(codigo);
  }
}

export type DependenciasRegistroTaller = {
  crearCuenta: (email: string, password: string) => Promise<string>; // devuelve uid
  generarTallerId: () => string;
  crearTaller: (tallerId: string, uid: string) => Promise<void>;
  crearUsuario: (uid: string, tallerId: string, email: string) => Promise<void>;
  borrarTaller: (tallerId: string) => Promise<void>;
  borrarCuenta: () => Promise<void>;
};

export async function registrarTaller(
  datos: { email: string; password: string; nombre: string; whatsapp: string; ciudad: string },
  dep: DependenciasRegistroTaller,
): Promise<{ uid: string; tallerId: string }> {
  let uid: string;
  try {
    uid = await dep.crearCuenta(datos.email, datos.password);
  } catch (error) {
    if (codigoFirebase(error) === 'auth/email-already-in-use') throw new ErrorRegistro('correo-existe');
    throw error;
  }

  const tallerId = dep.generarTallerId();
  try {
    await dep.crearTaller(tallerId, uid);
  } catch {
    if (!(await intentarRollbackCuenta(dep))) throw new ErrorRegistro('a-medias');
    throw new ErrorRegistro('taller');
  }

  try {
    await dep.crearUsuario(uid, tallerId, datos.email);
  } catch {
    const tallerBorrado = await intentar(() => dep.borrarTaller(tallerId));
    const cuentaBorrada = await intentarRollbackCuenta(dep);
    if (!tallerBorrado || !cuentaBorrada) throw new ErrorRegistro('a-medias');
    throw new ErrorRegistro('usuario');
  }

  return { uid, tallerId };
}

async function intentarRollbackCuenta(dep: DependenciasRegistroTaller): Promise<boolean> {
  return intentar(() => dep.borrarCuenta());
}

async function intentar(fn: () => Promise<void>): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch {
    return false;
  }
}

function codigoFirebase(error: unknown): string | null {
  return typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : null;
}
