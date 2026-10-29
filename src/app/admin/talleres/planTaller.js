import { deleteField, Timestamp } from 'firebase/firestore';
import { comoFecha } from '../../../lib/planes';
import { ORIGEN_ADMIN, ORIGEN_PROMO } from '../../../lib/premiumGratis';

// Ayudas de la pantalla admin/talleres (fuera de page.js: Next no deja exportar otras cosas
// desde una página).

// Fecha del documento (Timestamp) a "AAAA-MM-DD" para el campo de fecha; '' si no hay.
export function fechaParaCampo(valor) {
  const fecha = valor?.toDate ? valor.toDate() : (valor ? new Date(valor) : null);
  if (!fecha || Number.isNaN(fecha.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}`;
}

// Lo que se guarda, igual que en la ficha del yonke: Premium con su fecha (o sin fecha = sin
// vencimiento); Básico borra la fecha. premiumOrigen: lo que guarda el admin queda como 'admin'
// (aunque antes viniera de la promoción); Básico lo borra.
export function cambiosPlan(plan, premiumHasta) {
  return {
    plan,
    premiumHasta: plan === 'premium' && premiumHasta
      ? Timestamp.fromDate(new Date(`${premiumHasta}T00:00:00`))
      : deleteField(),
    premiumOrigen: plan === 'premium' ? ORIGEN_ADMIN : deleteField(),
  };
}

// "Guardar plan" sin tocar nada no escribe (así un Premium de la promoción no pasa a "asignado
// por ti" solo por pulsar el botón).
export function planSinCambios(taller, plan, premiumHasta) {
  const planActual = taller?.plan === 'premium' ? 'premium' : 'freemium';
  if (plan !== planActual) return false;
  return plan !== 'premium' || fechaParaCampo(taller?.premiumHasta) === premiumHasta;
}

// De dónde vino el Premium y su vencimiento exacto (hora de Tijuana), para la lista del admin.
// null si no es Premium. Los Premium de antes de la promoción no tienen premiumOrigen: "por ti".
export function origenPremium(taller) {
  if (taller?.plan !== 'premium') return null;
  const hasta = comoFecha(taller.premiumHasta);
  const vence = hasta
    ? `Vence el ${new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Tijuana' }).format(hasta)} (hora de Tijuana)`
    : 'Sin vencimiento';
  return taller.premiumOrigen === ORIGEN_PROMO
    ? { texto: '🎁 Premium por promoción (registro)', vence }
    : { texto: '👤 Premium asignado por ti', vence };
}
