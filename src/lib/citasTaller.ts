// Citas del taller (lógica pura, sin Firestore).
// Un documento por cita en talleres/{tallerId}/citas/{citaId} (ID automático).
// Función del plan Premium (con config/citas.requierePremium; ver premiumCitasOk en planes.js).
// Con Premium vencido el taller ve sus citas, les escribe por WhatsApp y las borra, pero no crea
// ni edita. Cada cita se borra sola 30 días después de su fecha (expiraAt = fecha + 30 días, con
// la política TTL de Firestore). Las reglas (firestore.rules) exigen lo mismo.
//
// La fecha y la hora se toman como las escribe el taller en su celular (hora local del celular).
import { whatsappHref } from './whatsapp';
import { normalizarPlacasContacto, normalizarTelefonoContacto } from './contactosTaller';

export const DIAS_RETENCION_CITA = 30;
// Hasta cuánto tiempo atrás se puede guardar o editar una cita (p. ej. marcar "Atendida" días
// después) y hasta cuánto hacia adelante se puede agendar. Las reglas usan los mismos números.
export const DIAS_ATRAS_CITA = 30;
export const DIAS_ADELANTE_CITA = 365;
export const MAX_NOMBRE_CITA = 100;
export const MAX_VEHICULO_CITA = 100;
export const MAX_MOTIVO_CITA = 200;
const DIA_MS = 24 * 60 * 60 * 1000;

export const ESTADOS_CITA = ['pendiente', 'confirmada', 'atendida', 'cancelada'] as const;
export type EstadoCita = typeof ESTADOS_CITA[number];
export const NOMBRES_ESTADO_CITA: Record<EstadoCita, string> = {
  pendiente: 'Pendiente', confirmada: 'Confirmada', atendida: 'Atendida', cancelada: 'Cancelada',
};

export const TEXTO_RETENCION_CITA = `Cada cita se borra sola ${DIAS_RETENCION_CITA} días después de su fecha.`;
export const ADVERTENCIA_MOTIVO_CITA = 'Solo lo necesario para el servicio. No escribas datos sensibles (salud, religión, datos bancarios, contraseñas).';
export const TEXTO_SIN_PREMIUM_CITA = 'Agendar y editar citas es del plan Premium. Puedes ver tus citas, escribir por WhatsApp y borrarlas.';

export const MENSAJES_CITA = {
  fecha: 'Escribe la fecha y la hora de la cita.',
  fechaPasada: `La fecha no puede ser de hace más de ${DIAS_ATRAS_CITA} días.`,
  fechaLejana: 'La cita no puede ser para dentro de más de un año.',
  nombre: `Escribe el nombre del cliente (máximo ${MAX_NOMBRE_CITA} letras).`,
  telefono: 'Escribe el WhatsApp a 10 dígitos, por ejemplo 6641234567, o déjalo vacío.',
  vehiculo: `El vehículo es muy largo (máximo ${MAX_VEHICULO_CITA} letras).`,
  placas: 'Las placas solo pueden tener letras, números y guiones (máximo 12).',
  motivo: `El motivo es muy largo (máximo ${MAX_MOTIVO_CITA} letras).`,
  estado: 'Escoge el estado de la cita.',
  guardarFallo: 'No pudimos guardar la cita. Revisa tu conexión e intenta de nuevo. Lo que escribiste sigue en pantalla.',
  borrarFallo: 'No pudimos borrar la cita. Intenta de nuevo.',
  estadoFallo: 'No pudimos cambiar el estado. Intenta de nuevo.',
} as const;

export type DatosCita = {
  fecha: Date; nombre: string; telefono: string; vehiculo: string; placas: string; motivo: string; estado: EstadoCita;
};
export type CitaEscrita = {
  fecha?: string; hora?: string; nombre?: string; telefono?: string; vehiculo?: string; placas?: string; motivo?: string; estado?: string;
};

// "2026-11-10" + "09:30" -> Date en la hora local del celular. null si no es una fecha real.
export function fechaDeInputs(fecha: unknown, hora: unknown): Date | null {
  if (typeof fecha !== 'string' || typeof hora !== 'string') return null;
  const f = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha.trim());
  const h = /^(\d{2}):(\d{2})$/.exec(hora.trim());
  if (!f || !h) return null;
  const [y, m, d, hh, mm] = [Number(f[1]), Number(f[2]), Number(f[3]), Number(h[1]), Number(h[2])];
  if (hh > 23 || mm > 59) return null;
  const r = new Date(y, m - 1, d, hh, mm);
  if (r.getFullYear() !== y || r.getMonth() !== m - 1 || r.getDate() !== d) return null;
  return r;
}

const dos = (n: number) => String(n).padStart(2, '0');

// Al revés, para llenar el formulario al editar.
export function inputsDeFecha(fecha: Date): { fecha: string; hora: string } {
  return {
    fecha: `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`,
    hora: `${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`,
  };
}

// Revisa lo escrito y lo deja listo para guardar. Devuelve el primer error en español.
export function validarCita(c: CitaEscrita, ahora: number = Date.now()): { ok: true; datos: DatosCita } | { ok: false; mensaje: string } {
  const fecha = fechaDeInputs(c.fecha, c.hora);
  if (!fecha) return { ok: false, mensaje: MENSAJES_CITA.fecha };
  if (fecha.getTime() < ahora - DIAS_ATRAS_CITA * DIA_MS) return { ok: false, mensaje: MENSAJES_CITA.fechaPasada };
  if (fecha.getTime() > ahora + DIAS_ADELANTE_CITA * DIA_MS) return { ok: false, mensaje: MENSAJES_CITA.fechaLejana };
  const nombre = (c.nombre ?? '').trim().replace(/\s+/g, ' ');
  if (nombre.length < 1 || nombre.length > MAX_NOMBRE_CITA) return { ok: false, mensaje: MENSAJES_CITA.nombre };
  const telefono = normalizarTelefonoContacto(c.telefono ?? '');
  if (telefono === null) return { ok: false, mensaje: MENSAJES_CITA.telefono };
  const vehiculo = (c.vehiculo ?? '').trim().replace(/\s+/g, ' ');
  if (vehiculo.length > MAX_VEHICULO_CITA) return { ok: false, mensaje: MENSAJES_CITA.vehiculo };
  const placas = normalizarPlacasContacto(c.placas ?? '');
  if (placas === null) return { ok: false, mensaje: MENSAJES_CITA.placas };
  const motivo = (c.motivo ?? '').trim();
  if (motivo.length > MAX_MOTIVO_CITA) return { ok: false, mensaje: MENSAJES_CITA.motivo };
  const estado = (c.estado ?? 'pendiente') as EstadoCita;
  if (!ESTADOS_CITA.includes(estado)) return { ok: false, mensaje: MENSAJES_CITA.estado };
  return { ok: true, datos: { fecha, nombre, telefono, vehiculo, placas, motivo, estado } };
}

// Fecha de borrado: exactamente 30 días después de la cita (las reglas lo revisan así).
export function expiraCita(fecha: Date): Date {
  return new Date(fecha.getTime() + DIAS_RETENCION_CITA * DIA_MS);
}

export function inicioDelDia(ahora: Date = new Date()): Date {
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
}

type ConFecha = { fecha?: { toDate?: () => Date } | Date | null };
export const fechaDeCita = (c: ConFecha): Date | null => {
  const f = c?.fecha;
  if (!f) return null;
  if (f instanceof Date) return f;
  return typeof f.toDate === 'function' ? f.toDate() : null;
};

// Separa las próximas (ya ordenadas por fecha) en "Hoy" y "Próximas".
export function separarHoy<T extends ConFecha>(citas: T[], ahora: Date = new Date()): { hoy: T[]; proximas: T[] } {
  const manana = new Date(inicioDelDia(ahora).getTime());
  manana.setDate(manana.getDate() + 1);
  const hoy: T[] = []; const proximas: T[] = [];
  for (const c of citas) {
    const f = fechaDeCita(c);
    if (f && f < manana) hoy.push(c); else proximas.push(c);
  }
  return { hoy, proximas };
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// "9:30 a. m." / "4:00 p. m."
export function textoHora(f: Date): string {
  const h = f.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${dos(f.getMinutes())} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

// "martes 10 de noviembre"
export function textoDia(f: Date): string {
  return `${DIAS[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()]}`;
}

export function mensajeRecordatorioCita(nombreTaller: string, nombreCliente: string, fecha: Date): string {
  const primerNombre = (nombreCliente || '').trim().split(' ')[0];
  return `Hola${primerNombre ? ` ${primerNombre}` : ''}, le recordamos su cita en ${nombreTaller || 'nuestro taller'} el ${textoDia(fecha)} a las ${textoHora(fecha)}`;
}

// null si la cita no tiene un WhatsApp válido (entonces no se muestra el botón).
export function enlaceRecordatorioCita(telefono: unknown, nombreTaller: string, nombreCliente: string, fecha: Date | null): string | null {
  if (!fecha) return null;
  return whatsappHref(telefono, mensajeRecordatorioCita(nombreTaller, nombreCliente, fecha));
}
