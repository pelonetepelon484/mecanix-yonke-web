import { doc, getDoc } from 'firebase/firestore';

// Límites del plan Básico y Premium. Todo queda APAGADO detrás de config/planes { limitesActivos }:
// si el documento no existe o limitesActivos no es exactamente true, todo funciona como antes.
//
// "Premium vigente" = plan == 'premium' y (premiumHasta vacío o en el futuro). Un Premium sin fecha
// cuenta como vigente; uno con premiumHasta vencido ya no. Todo lo demás ("freemium", "basico",
// sin plan, Premium vencido) es plan Básico. Las reglas de Firestore repiten esta misma definición
// en premiumVigente() (firestore.rules); tests/rules/planes.rules.mjs comprueba que ambas digan lo
// mismo con la misma tabla de casos (casosPremiumVigente, abajo).

export const PRECIO_PREMIUM_TEXTO = '$398.00 MXN al mes más IVA';
export const TITULO_FUNCION_PREMIUM = 'Función del plan Premium';
// Lo que incluye el plan Básico (textos públicos con el interruptor encendido). Debe coincidir con
// lo que de verdad deja hacer el panel: inventario con fotos, pedidos, datos del negocio y
// calificaciones públicas.
export const FUNCIONES_PLAN_BASICO = [
  'Tu yonke visible en el buscador público de Mecanix',
  'Inventario sin límite con fotos: vehículos, motores y piezas sueltas',
  'Pedidos: reservaciones de clientes, pedidos de talleres y alertas de clientes',
  'Contacto directo por WhatsApp',
  'Datos de tu negocio: logo, información, horario, métodos de pago y garantía',
  'Calificaciones de tus clientes',
];

// Lo que decía la tarjeta antes (se sigue mostrando con el interruptor apagado).
const FUNCIONES_PLAN_GRATUITO = [
  'Tu yonke visible en el buscador público de Mecanix',
  'Inventario sin límite: vehículos, motores y piezas sueltas',
  'Reservaciones de clientes desde la plataforma',
  'Contacto directo por WhatsApp',
  'Demanda: qué buscan los clientes en tu estado',
  'Registro de compras de reciclaje',
  'Notas de garantía en PDF para tus ventas',
  'Calificaciones de tus clientes',
];

// Tarjeta del plan sin costo en la página principal ("Así funciona para tu yonke").
export const tarjetaPlanSinCosto = (limitesActivos) => (limitesActivos
  ? { nombre: 'Plan Básico', funciones: FUNCIONES_PLAN_BASICO }
  : { nombre: 'Plan Gratuito', funciones: FUNCIONES_PLAN_GRATUITO });

export const URL_QUIERO_PREMIUM = 'https://wa.me/5216611034260?text=Hola%2C%20me%20interesa%20el%20Plan%20Premium%20de%20Mecanix%20Yonke%20Virtual';

// Acepta Timestamp de Firestore, Date, milisegundos o texto de fecha. null si no hay fecha usable.
function comoFecha(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor?.toDate === 'function') return valor.toDate();
  if (valor instanceof Date) return valor;
  if (typeof valor?.seconds === 'number') return new Date(valor.seconds * 1000);
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function esPremiumVigente(yonke, ahora = new Date()) {
  if (yonke?.plan !== 'premium') return false;
  const hasta = yonke.premiumHasta;
  if (hasta === null || hasta === undefined || hasta === '') return true;
  const fecha = comoFecha(hasta);
  return fecha !== null && fecha.getTime() > ahora.getTime();
}

// Para el admin: 'premium-vigente' | 'premium-vencido' | 'basico'.
export function estadoPlan(yonke, ahora = new Date()) {
  if (yonke?.plan !== 'premium') return 'basico';
  return esPremiumVigente(yonke, ahora) ? 'premium-vigente' : 'premium-vencido';
}

export const ETIQUETAS_ESTADO_PLAN = {
  'premium-vigente': { texto: '⭐ Premium vigente', bg: '#FAEEDA', color: '#854F0B' },
  'premium-vencido': { texto: '⚠️ Premium vencido', bg: '#FDECEA', color: '#C62828' },
  basico: { texto: '🆓 Básico', bg: '#EEF2F7', color: '#1A3C5E' },
};

// Interruptor: solo true exacto lo enciende (un texto "true" o cualquier otra cosa lo deja apagado).
export const limitesEncendidos = (configPlanes) => configPlanes?.limitesActivos === true;

// Lee config/planes. Si falla la lectura, se queda APAGADO (comportamiento de hoy).
export async function leerLimitesActivos(db) {
  try {
    const snap = await getDoc(doc(db, 'config', 'planes'));
    return snap.exists() ? limitesEncendidos(snap.data()) : false;
  } catch (error) {
    console.warn('[planes] No se pudo leer config/planes; límites apagados.', error?.code || error?.message);
    return false;
  }
}

// Tabla de casos compartida con las pruebas de reglas: { nombre, yonke(ahoraMs) } -> esperado.
// premiumHasta se expresa en milisegundos relativos a "ahora" para poder armarlo en ambos lados.
export const casosPremiumVigente = [
  { nombre: 'premium sin fecha', plan: 'premium', hastaRelativoMs: null, esperado: true },
  { nombre: 'premium con fecha futura', plan: 'premium', hastaRelativoMs: 30 * 86400000, esperado: true },
  { nombre: 'premium vencido', plan: 'premium', hastaRelativoMs: -86400000, esperado: false },
  { nombre: 'freemium', plan: 'freemium', hastaRelativoMs: null, esperado: false },
  { nombre: 'basico', plan: 'basico', hastaRelativoMs: null, esperado: false },
  { nombre: 'sin plan', plan: undefined, hastaRelativoMs: null, esperado: false },
  { nombre: 'freemium con fecha futura (sobrante)', plan: 'freemium', hastaRelativoMs: 30 * 86400000, esperado: false },
];
