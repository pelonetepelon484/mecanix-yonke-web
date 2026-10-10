// Fechas del mapa de búsquedas: siempre en horario de Tijuana (America/Tijuana ajusta solo el
// horario de verano), sin importar desde dónde se abra el panel. Ej. "9 oct 2026, 2:35 p.m.".

const VEINTICUATRO_HORAS = 24 * 60 * 60 * 1000;

// `fecha` de Firestore llega como Timestamp; en pruebas o datos viejos puede ser Date/ISO.
export function aFecha(fecha) {
  if (!fecha) return null;
  const f = fecha.toDate ? fecha.toDate() : new Date(fecha);
  return Number.isNaN(f.getTime()) ? null : f;
}

export function formatearFechaTijuana(fecha) {
  const f = aFecha(fecha);
  if (!f) return '—';
  return f.toLocaleString('es-MX', {
    timeZone: 'America/Tijuana', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

// "Últimas 24 horas" respecto a `ahora` (el momento en que se cargaron los datos).
export function esDeLasUltimas24Horas(fecha, ahora) {
  const f = aFecha(fecha);
  if (!f) return false;
  const diferencia = ahora - f.getTime();
  return diferencia >= 0 && diferencia < VEINTICUATRO_HORAS;
}
