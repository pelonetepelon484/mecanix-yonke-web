// Interruptores del comparador de piezas: documento config/comparador en Firestore. Se cambian desde
// la consola de Firebase sin publicar de nuevo (el servidor los lee cada minuto como máximo).
//   habilitado: true exacto enciende la tarjeta de la portada, /comparador y su ruta. Sin documento,
//     otro valor o si falla la lectura: todo apagado (404).
//   requiereLogin: true exacto exige sesión de yonke o taller (o admin). Apagado por defecto.
//   limiteDiarioIp / limiteDiarioDispositivo: consultas al día sin cuenta, por IP y por navegador.
//   limiteDiarioConCuenta: consultas al día con sesión de yonke, taller o admin.
//   sugerenciasIA: true exacto enciende la búsqueda automática de equivalencias (Claude con búsqueda
//     web; tiene costo). Apagada por defecto. Sin ANTHROPIC_API_KEY en el servidor tampoco busca.
//   limiteDiarioIA: búsquedas automáticas al día en total (por defecto 10).
// Un límite que falte o no sea un número entero de 0 a 1000 usa el valor de abajo.
import { doc, getDoc } from 'firebase/firestore';

export const LIMITES_POR_DEFECTO = { limiteDiarioIp: 5, limiteDiarioDispositivo: 5, limiteDiarioConCuenta: 20, limiteDiarioIA: 10 };
// Cuentas que pueden usarlo con sesión (y que tienen el límite "con cuenta").
export const ROLES_CON_CUENTA = ['yonke', 'taller', 'admin'];

const limite = (v, defecto) => (Number.isInteger(v) && v >= 0 && v <= 1000 ? v : defecto);

export function banderasComparador(c) {
  return {
    habilitado: c?.habilitado === true,
    requiereLogin: c?.requiereLogin === true,
    limiteDiarioIp: limite(c?.limiteDiarioIp, LIMITES_POR_DEFECTO.limiteDiarioIp),
    limiteDiarioDispositivo: limite(c?.limiteDiarioDispositivo, LIMITES_POR_DEFECTO.limiteDiarioDispositivo),
    limiteDiarioConCuenta: limite(c?.limiteDiarioConCuenta, LIMITES_POR_DEFECTO.limiteDiarioConCuenta),
    sugerenciasIA: c?.sugerenciasIA === true,
    limiteDiarioIA: limite(c?.limiteDiarioIA, LIMITES_POR_DEFECTO.limiteDiarioIA),
  };
}

export async function leerConfigComparador(db) {
  try {
    const snap = await getDoc(doc(db, 'config', 'comparador'));
    return banderasComparador(snap.exists() ? snap.data() : null);
  } catch (error) {
    console.warn('[comparador] No se pudo leer config/comparador; queda apagado.', error?.code || error?.message);
    return banderasComparador(null);
  }
}
