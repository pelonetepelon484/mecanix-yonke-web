import { deleteField, Timestamp } from 'firebase/firestore';

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
// vencimiento); Básico borra la fecha.
export function cambiosPlan(plan, premiumHasta) {
  return {
    plan,
    premiumHasta: plan === 'premium' && premiumHasta
      ? Timestamp.fromDate(new Date(`${premiumHasta}T00:00:00`))
      : deleteField(),
  };
}
