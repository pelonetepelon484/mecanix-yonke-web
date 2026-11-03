// Código temporal de las cuentas que entran con WhatsApp: el admin lo genera y el yonke lo cambia por
// una contraseña nueva. No es una contraseña: sirve una vez, vence y nunca abre una sesión por sí solo.
// Lo usan el servidor y las pantallas. Sin Firestore ni node:crypto.
import { LARGO_CODIGO_TEMPORAL } from './codigoTemporalLargo';
import { PASSWORD_MAX, PASSWORD_MIN, whatsappDiezDigitos } from './yonkeLigero';

export const HORAS_CODIGO = 24;
export const RUTA_CODIGO_TEMPORAL = '/panel/codigo-temporal';

export const MENSAJES_CODIGO = {
  noDisponible: 'No pudimos cambiar tu contraseña. Intenta más tarde.',
  whatsapp: 'Escribe tu WhatsApp a 10 dígitos.',
  codigo: 'La contraseña temporal no es válida, ya se usó o ya venció. Pídenos una nueva.',
  password: `La contraseña nueva debe tener al menos ${PASSWORD_MIN} caracteres.`,
  limite: 'Demasiados intentos. Intenta mañana o escríbenos para ayudarte.',
};

export function validarUsoCodigo(cuerpo) {
  const whatsapp = whatsappDiezDigitos(cuerpo?.whatsapp);
  if (!whatsapp) return { error: MENSAJES_CODIGO.whatsapp };
  const codigo = typeof cuerpo?.codigo === 'string' ? cuerpo.codigo.trim() : '';
  if (codigo.length !== LARGO_CODIGO_TEMPORAL) return { error: MENSAJES_CODIGO.codigo };
  const password = cuerpo?.password;
  if (typeof password !== 'string' || password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) return { error: MENSAJES_CODIGO.password };
  return { datos: { whatsapp, codigo, password } };
}

// Texto que el admin le manda al yonke por WhatsApp.
export function mensajeCodigoTemporal(codigo) {
  return `Tu contraseña temporal de Mecanix es: ${codigo}\n\nSirve una sola vez y vence en ${HORAS_CODIGO} horas. Úsala aquí para crear tu contraseña nueva: https://www.mecanixyonkevirtual.com${RUTA_CODIGO_TEMPORAL}`;
}
