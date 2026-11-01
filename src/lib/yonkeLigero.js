// Lógica pura del yonke ligero (registro mínimo que solo contesta búsquedas activas): lo usan el
// servidor y, más adelante, las pantallas de registro y de entrada. Sin Firestore ni node:crypto.
import { isCiudadValida } from '../app/lib/ciudades';
import { esIdPedido } from './pedidosClientes';
import { normalizarWhatsapp, whatsappHref } from './whatsapp';

// Dominio del correo interno de la cuenta: nunca recibe correo y el yonke nunca lo ve; solo sirve
// de nombre de usuario en Firebase Auth. No cambiarlo: las cuentas ya creadas dependen de él.
export const DOMINIO_CORREO_INTERNO = 'yonkes.mecanixyonkevirtual.com';

export const NOMBRE_MIN = 2;
export const NOMBRE_MAX = 100;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
// Se usan si config/yonkesLigeros no trae un entero válido.
export const MAX_POR_IP_DIA = 5;
export const MAX_POR_DIA = 30;

export const MENSAJES_LIGERO = {
  noDisponible: 'El registro rápido no está disponible por ahora. Intenta más tarde.',
  nombre: `Escribe el nombre de tu yonke (de ${NOMBRE_MIN} a ${NOMBRE_MAX} caracteres).`,
  nombreReservado: 'Ese nombre no se puede usar. Escribe el nombre de tu yonke.',
  whatsapp: 'Escribe tu WhatsApp a 10 dígitos.',
  password: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`,
  terminos: 'Debes aceptar los Términos y Condiciones y el Aviso de Privacidad para registrarte.',
  alerta: 'Esta búsqueda activa ya no está disponible.',
  limite: 'Se alcanzó el límite de registros por hoy. Intenta mañana.',
  yaRegistrado: 'Este WhatsApp ya está registrado. Inicia sesión o escríbenos para ayudarte.',
};

// 10 dígitos de México, o null. No acepta números que no pueden existir (empiezan con 0 o 1, o son
// el mismo dígito repetido).
export function whatsappDiezDigitos(numero) {
  const normalizado = normalizarWhatsapp(numero);
  if (!normalizado) return null;
  const diez = normalizado.slice(2);
  return /^[2-9][0-9]{9}$/.test(diez) && !/^(\d)\1{9}$/.test(diez) ? diez : null;
}

export const correoInterno = (diezDigitos) => `${diezDigitos}@${DOMINIO_CORREO_INTERNO}`;

// Cuenta que entra con WhatsApp: su contraseña no se recupera por correo (ese correo no existe).
export const esCuentaInterna = (correo) => typeof correo === 'string' && correo.endsWith(`@${DOMINIO_CORREO_INTERNO}`);

// Yonke de registro ligero: sin inventario ni ficha pública. No cuenta en la portada ni en el buscador
// y vuelve a contar al completar su registro (tipoRegistro 'completo'). Los demás no traen el campo.
export const esRegistroLigero = (yonke) => yonke?.tipoRegistro === 'ligero';

// 10 dígitos de una cuenta interna, o null.
export function whatsappDeCuentaInterna(correo) {
  if (!esCuentaInterna(correo)) return null;
  const local = correo.slice(0, correo.indexOf('@'));
  return /^[0-9]{10}$/.test(local) ? local : null;
}


// Lo escrito en la pantalla de entrada: un WhatsApp válido, o null si es un correo u otra cosa.
export const whatsappDeEntrada = (texto) => (typeof texto === 'string' && !texto.includes('@') ? whatsappDiezDigitos(texto) : null);

// Correo con el que se inicia sesión: el interno si escribió su WhatsApp; si no, lo escrito.
export function correoDeEntrada(texto) {
  const whatsapp = whatsappDeEntrada(texto);
  return whatsapp ? correoInterno(whatsapp) : String(texto ?? '').trim();
}

// "¿Olvidaste tu contraseña?" con WhatsApp: se la restablece el admin. Debe escribir desde ese número.
export const WHATSAPP_RECUPERAR = '6611034260';
export const TEXTO_RECUPERAR_WHATSAPP = 'Tu contraseña la restablecemos nosotros. Escríbenos desde el WhatsApp registrado en tu cuenta. Por seguridad, podremos solicitar información adicional para comprobar que estás autorizado para administrar el yonke.';
export const enlaceRecuperarWhatsapp = (diezDigitos) => whatsappHref(
  WHATSAPP_RECUPERAR, `Hola, olvidé mi contraseña de Mecanix. Mi yonke está registrado con el WhatsApp ${diezDigitos}.`,
);

// Nadie se presenta ante los clientes como Mecanix ni aparenta una insignia.
const soloLetras = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
export function nombreReservado(nombre) {
  const letras = soloLetras(nombre);
  return letras.includes('mecanix') || letras.includes('verificad');
}

// Tope diario: config/pedidosClientes.limiteRespuestasLigero, entero de 1 en adelante. Sin él las
// reglas no dejan responder.
export function limiteRespuestasLigero(config) {
  const v = config?.limiteRespuestasLigero;
  return Number.isInteger(v) && v >= 1 ? v : null;
}
export const respuestasRestantes = (limite, usadas) => Math.max(0, limite - usadas);
export const textoRestantes = (n) => `Te quedan ${n} respuesta${n === 1 ? '' : 's'} hoy`;
export const textoTopeLigero = (limite, limiteCompleto) => `Llegaste a tus ${limite} respuestas de hoy. Completa tu registro${limiteCompleto ? ` y responde hasta ${limiteCompleto} al día` : ' para responder más al día'}.`;
export const TEXTO_AVISO_NUMERO = 'Importante: Mecanix no verifica este número mediante un código al momento del registro. Registra únicamente un número de WhatsApp que controles o para cuyo uso tengas autorización. Este número podrá mostrarse a los clientes que reciban tus respuestas para que puedan contactarte.';
export const TEXTO_LIGERO_SIN_TOPE = 'Por ahora no se pueden responder búsquedas. Intenta más tarde.';
export const TEXTO_SIN_BUSQUEDAS = 'Por ahora no hay búsquedas activas en tu estado.';
export const TEXTO_COMPLETAR = 'Completar mi registro';
export const RUTA_LIGERO = '/panel/ligero';
export const RUTA_COMPLETAR = '/panel/ligero/completar';

// "Completar mi registro": ciudad (de la lista en Baja California; texto libre en los demás),
// dirección, teléfono y correo opcional, que es solo de contacto: sigue entrando con su WhatsApp.
export const ESTADO_CON_CIUDADES = 'baja-california';
export const DIRECCION_MAX = 300;
export const CIUDAD_MAX = 100;
export const TELEFONO_MAX = 40;
export const CORREO_MAX = 254;
export const MENSAJES_COMPLETAR = {
  noDisponible: 'No pudimos completar tu registro. Intenta de nuevo.',
  ciudad: 'Elige tu ciudad.',
  direccion: 'Escribe la dirección de tu yonke.',
  telefono: 'Escribe un teléfono a 10 dígitos.',
  correo: 'El correo no es válido.',
};
const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function validarCompletarRegistro(cuerpo, estado) {
  const texto = (v) => (typeof v === 'string' ? v.trim() : '');
  const ciudad = texto(cuerpo?.ciudad);
  const direccion = texto(cuerpo?.direccion);
  const telefono = texto(cuerpo?.telefono);
  const correo = texto(cuerpo?.correo);
  const ciudadBien = estado === ESTADO_CON_CIUDADES ? isCiudadValida(ciudad) : ciudad.length >= 1 && ciudad.length <= CIUDAD_MAX;
  if (!ciudadBien) return { error: MENSAJES_COMPLETAR.ciudad };
  if (direccion.length < 1 || direccion.length > DIRECCION_MAX) return { error: MENSAJES_COMPLETAR.direccion };
  if (telefono.length > TELEFONO_MAX || !normalizarWhatsapp(telefono)) return { error: MENSAJES_COMPLETAR.telefono };
  if (correo && (correo.length > CORREO_MAX || !CORREO_VALIDO.test(correo))) return { error: MENSAJES_COMPLETAR.correo };
  return { datos: { ciudad, direccion, telefono, correo } };
}

// Datos que manda el navegador. Devuelve { error } o { datos } ya limpios. El estado NUNCA se toma
// de aquí: sale de la alerta.
export function validarRegistroLigero(cuerpo) {
  const nombre = typeof cuerpo?.nombre === 'string' ? cuerpo.nombre.trim().replace(/\s+/g, ' ') : '';
  if (nombre.length < NOMBRE_MIN || nombre.length > NOMBRE_MAX) return { error: MENSAJES_LIGERO.nombre };
  if (nombreReservado(nombre)) return { error: MENSAJES_LIGERO.nombreReservado };
  const whatsapp = whatsappDiezDigitos(cuerpo?.whatsapp);
  if (!whatsapp) return { error: MENSAJES_LIGERO.whatsapp };
  const password = cuerpo?.password;
  if (typeof password !== 'string' || password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) return { error: MENSAJES_LIGERO.password };
  if (cuerpo?.aceptaTerminos !== true) return { error: MENSAJES_LIGERO.terminos };
  if (!esIdPedido(cuerpo?.pedidoId)) return { error: MENSAJES_LIGERO.alerta };
  return { datos: { nombre, whatsapp, password, pedidoId: cuerpo.pedidoId } };
}

// config/yonkesLigeros: solo true exacto enciende el alta. Topes: entero de 1 en adelante.
const topeValido = (v, respaldo) => (Number.isInteger(v) && v >= 1 ? v : respaldo);
export function configLigeros(config) {
  return {
    habilitado: config?.habilitado === true,
    maxPorIpDia: topeValido(config?.maxPorIpDia, MAX_POR_IP_DIA),
    maxPorDia: topeValido(config?.maxPorDia, MAX_POR_DIA),
  };
}

// Conjunto con los 10 dígitos de WhatsApp y teléfono de los yonkes (los completos los guardan en
// formato libre: "664 123 4567").
export function numerosDeYonkes(yonkes) {
  const numeros = new Set();
  for (const y of yonkes) {
    for (const n of [y?.whatsapp, y?.telefono]) {
      const normalizado = normalizarWhatsapp(n);
      if (normalizado) numeros.add(normalizado.slice(2));
    }
  }
  return numeros;
}
