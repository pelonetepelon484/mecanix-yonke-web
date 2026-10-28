// Registro de la refaccionaria en pasos, con rollback (mismo patrón que registrarTaller.ts). Las
// llamadas a Firebase llegan por "dependencias" para probar el orden y los fallos sin conexión.
// Orden: 1) cuenta de correo, 2) refaccionaria + privado/datos (un lote) con ownerUid, 3) usuario con
// rol 'refaccionaria', 4) primera aceptación de términos. Si 3 falla: se borran la refaccionaria y la
// cuenta. Si 2 falla: solo se borra la cuenta. Si 4 falla, la cuenta se queda: aceptará al entrar.

export type ErrorRegistroRefaccionaria = 'correo-existe' | 'refaccionaria' | 'usuario' | 'a-medias';

export class ErrorRegistro extends Error {
  constructor(public codigo: ErrorRegistroRefaccionaria) {
    super(codigo);
  }
}

export type DependenciasRegistroRefaccionaria = {
  crearCuenta: (email: string, password: string) => Promise<string>; // devuelve uid
  generarRefaccionariaId: () => string;
  crearRefaccionaria: (refaccionariaId: string, uid: string) => Promise<void>;
  crearUsuario: (uid: string, refaccionariaId: string, email: string) => Promise<void>;
  borrarRefaccionaria: (refaccionariaId: string) => Promise<void>;
  borrarCuenta: () => Promise<void>;
  aceptarVersion: (refaccionariaId: string) => Promise<void>;
};

export async function registrarRefaccionaria(
  datos: { email: string; password: string },
  dep: DependenciasRegistroRefaccionaria,
): Promise<{ uid: string; refaccionariaId: string; aceptada: boolean }> {
  let uid: string;
  try {
    uid = await dep.crearCuenta(datos.email, datos.password);
  } catch (error) {
    if (codigoFirebase(error) === 'auth/email-already-in-use') throw new ErrorRegistro('correo-existe');
    throw error;
  }

  const refaccionariaId = dep.generarRefaccionariaId();
  try {
    await dep.crearRefaccionaria(refaccionariaId, uid);
  } catch {
    if (!(await intentar(() => dep.borrarCuenta()))) throw new ErrorRegistro('a-medias');
    throw new ErrorRegistro('refaccionaria');
  }

  try {
    await dep.crearUsuario(uid, refaccionariaId, datos.email);
  } catch {
    const borrada = await intentar(() => dep.borrarRefaccionaria(refaccionariaId));
    const cuentaBorrada = await intentar(() => dep.borrarCuenta());
    if (!borrada || !cuentaBorrada) throw new ErrorRegistro('a-medias');
    throw new ErrorRegistro('usuario');
  }

  let aceptada = true;
  try {
    await dep.aceptarVersion(refaccionariaId);
  } catch {
    aceptada = false;
  }
  return { uid, refaccionariaId, aceptada };
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
