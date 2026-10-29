import { doc, getDoc } from 'firebase/firestore';
import { comoFecha, esPremiumVigente } from './planes';

// Promoción "Premium gratis al registrarte" para talleres. Todo detrás de config/talleres:
//   premiumGratisHabilitado: solo true exacto la enciende (sin documento o con otro valor: apagada,
//     el registro funciona como siempre).
//   mesesPremiumGratis: entero de 1 a 12; si falta, 3. Con cualquier otro valor la promoción queda
//     APAGADA (falla cerrada). Las reglas de Firestore (promoPremiumGratisOk) repiten este criterio.
// Quien la recibe: SOLO un taller recién registrado, una vez, y nunca si ya se usó con el mismo
// WhatsApp o el mismo correo (huellas en pedidosClientesLimite, ver lib/premiumGratis/).
//
// ⚠️ [PROVISIONAL] Los textos de este archivo están pendientes de revisión legal.

export const MESES_PREMIUM_GRATIS_DEFAULT = 3;
export const ORIGEN_PROMO = 'promo';
export const ORIGEN_ADMIN = 'admin';
// Días antes del vencimiento en que el banner cambia de color y explica qué pasa al vencer.
export const DIAS_AVISO_VENCIMIENTO = 15;
const DIA = 24 * 60 * 60 * 1000;
const ZONA = 'America/Tijuana';

// Páginas públicas (en el servidor, con su revalidate de 10 min: sin lecturas por visitante):
// meses de la promoción si está encendida; null si está apagada o si falla la lectura.
export async function leerPromoTalleres(db) {
  try {
    const snap = await getDoc(doc(db, 'config', 'talleres'));
    const { habilitado, meses } = banderaPremiumGratis(snap.exists() ? snap.data() : null);
    return habilitado ? meses : null;
  } catch (error) {
    console.warn('[premiumGratis] No se pudo leer config/talleres; promoción oculta.', error?.code || error?.message);
    return null;
  }
}

export function banderaPremiumGratis(config) {
  if (config?.premiumGratisHabilitado !== true) return { habilitado: false, meses: MESES_PREMIUM_GRATIS_DEFAULT };
  const valor = config.mesesPremiumGratis;
  if (valor === undefined) return { habilitado: true, meses: MESES_PREMIUM_GRATIS_DEFAULT };
  if (!Number.isInteger(valor) || valor < 1 || valor > 12) return { habilitado: false, meses: MESES_PREMIUM_GRATIS_DEFAULT };
  return { habilitado: true, meses: valor };
}

// Fecha + n meses de calendario (29 oct -> 29 ene; si el día no existe en ese mes, el último:
// 30 nov + 3 -> 28 o 29 feb). Misma hora. En UTC para que no dependa de la zona del servidor.
export function sumarMeses(fecha, meses) {
  const d = new Date(fecha.getTime());
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + meses);
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimo));
  return d;
}

// Solo dígitos, los últimos 10 (quita +52, 1, espacios y guiones). '' si no quedan 10.
export function normalizarWhatsapp(valor) {
  const digitos = String(valor ?? '').replace(/\D/g, '');
  return digitos.length >= 10 ? digitos.slice(-10) : '';
}

// Correo para la huella: minúsculas, sin espacios, sin "+alias" y, en Gmail, sin puntos en la
// parte local (Gmail los ignora: "j.perez+x@gmail.com" y "jperez@gmail.com" son el mismo buzón).
// googlemail.com es Gmail. '' si no parece correo.
export function normalizarCorreo(valor) {
  const limpio = String(valor ?? '').toLowerCase().replace(/\s+/g, '');
  const arroba = limpio.lastIndexOf('@');
  if (arroba < 1 || arroba === limpio.length - 1) return '';
  let local = limpio.slice(0, arroba);
  let dominio = limpio.slice(arroba + 1);
  local = local.split('+')[0];
  if (dominio === 'googlemail.com') dominio = 'gmail.com';
  if (dominio === 'gmail.com') local = local.replace(/\./g, '');
  return local ? `${local}@${dominio}` : '';
}

// Datos del banner del panel: solo si el Premium vino de la promoción, tiene fecha (nunca "sin
// vencimiento") y sigue vigente. null en cualquier otro caso.
export function estadoPromoTaller(taller, ahora = new Date()) {
  if (taller?.premiumOrigen !== ORIGEN_PROMO) return null;
  const hasta = comoFecha(taller.premiumHasta);
  if (!hasta || !esPremiumVigente(taller, ahora)) return null;
  const dias = Math.max(1, Math.ceil((hasta.getTime() - ahora.getTime()) / DIA));
  return { hasta, dias, porVencer: dias <= DIAS_AVISO_VENCIMIENTO };
}

export function fechaLargaTijuana(fecha) {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: ZONA }).format(fecha);
}

const textoDias = (n) => (n === 1 ? 'te queda 1 día' : `te quedan ${n} días`);
const textoMeses = (n) => (n === 1 ? '1 mes' : `${n} meses`);

// "N meses de Premium gratis al registrarte" (portada, tarjetas de talleres y /bienvenida).
export const textoPromoRegistro = (meses) => `${textoMeses(meses)} de Premium gratis al registrarte`;

export const INCLUYE_PREMIUM_TALLER = 'Incluye órdenes de servicio, historial de servicios, recordatorios de mantenimiento y seguimiento de órdenes.';
export const AL_VENCER_PREMIUM_TALLER = 'Al vencer volverás al plan Básico: seguirás haciendo cotizaciones y pidiendo piezas, y podrás ver, reimprimir y descargar tus órdenes y tu historial, pero no crear ni editar órdenes ni agregar servicios al historial.';

export function textosBannerPromo({ hasta, dias, porVencer }) {
  const fecha = fechaLargaTijuana(hasta);
  return porVencer
    ? { titulo: `Tu Premium gratis vence el ${fecha} · ${textoDias(dias)}`, texto: AL_VENCER_PREMIUM_TALLER }
    : { titulo: `Tienes Premium gratis hasta el ${fecha} · ${textoDias(dias)}`, texto: INCLUYE_PREMIUM_TALLER };
}
