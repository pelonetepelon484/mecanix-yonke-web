// Historial de servicios del taller (etapa 2): lógica pura, sin Firestore.
// Un documento por vehículo en talleres/{tallerId}/historial/{vehiculoId} con sus servicios dentro.
// Se alimenta SOLO de órdenes entregadas. NUNCA guarda nombre ni teléfono del cliente: el teléfono
// se lee de la orden en el momento de abrir WhatsApp (si la orden todavía existe) y no se copia.
// Las reglas de Firestore (firestore.rules) exigen lo mismo; esto es para la pantalla.
import { whatsappHref } from './whatsapp';

export const MAX_SERVICIOS_HISTORIAL = 60;
export const MAX_DESCRIPCION_SERVICIO = 1000;
export const MAX_PIEZAS_SERVICIO = 20;
export const MAX_PIEZA_TEXTO = 200;
export const MAX_PLACAS = 12;
// 18 meses sin actualizarse: lo borra la política TTL de Firestore (expiraAt).
export const DIAS_RETENCION_HISTORIAL = 548;
const DIA_MS = 24 * 60 * 60 * 1000;

export const ADVERTENCIA_HISTORIAL = 'No escribas nombres ni teléfonos de clientes en las descripciones';

export const MENSAJES_HISTORIAL = {
  placas: `Escribe las placas del vehículo (letras, números o guiones, máximo ${MAX_PLACAS}).`,
  yaEnHistorial: 'Esta orden ya está en el historial.',
  otroVehiculo: (v: string) => `Esas placas ya están en tu historial con otro vehículo (${v}). Revisa las placas.`,
  lleno: `Este vehículo ya tiene ${MAX_SERVICIOS_HISTORIAL} servicios en el historial.`,
  noEntregada: 'Solo las órdenes entregadas se pueden agregar al historial.',
  guardarFallo: 'No pudimos agregar la orden al historial. Revisa tu conexión e intenta de nuevo.',
} as const;

// Mayúsculas y sin espacios. null si queda vacía, es muy larga o trae otros caracteres.
export function normalizarPlacas(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const p = valor.toUpperCase().replace(/\s+/g, '');
  return /^[A-Z0-9-]{1,12}$/.test(p) ? p : null;
}

type Item = { descripcion?: unknown };
const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Descripción del servicio: los trabajos de la orden, separados por "; ", máximo 1000.
export function descripcionDeTrabajos(trabajos: unknown): string {
  const lista = Array.isArray(trabajos) ? trabajos : [];
  return lista.map((t: Item) => texto(t?.descripcion, MAX_PIEZA_TEXTO)).filter(Boolean).join('; ').slice(0, MAX_DESCRIPCION_SERVICIO);
}

// Piezas: solo sus descripciones (sin precios ni cantidades), máximo 20.
export function piezasDeOrden(piezas: unknown): string[] {
  const lista = Array.isArray(piezas) ? piezas : [];
  return lista.map((p: Item) => texto(p?.descripcion, MAX_PIEZA_TEXTO)).filter(Boolean).slice(0, MAX_PIEZAS_SERVICIO);
}

export type OrdenParaHistorial = {
  estado?: string;
  vehiculo?: { marca?: string; modelo?: string; anio?: number; kilometraje?: number; placas?: string };
  trabajos?: unknown;
  piezas?: unknown;
  fechaEntrega?: unknown;
};

export type ServicioHistorial = { folio: string; fecha: unknown; kilometraje?: number; descripcion: string; piezas: string[] };

// El servicio que se guarda: folio, fecha de entrega (el MISMO valor de la orden), kilometraje si
// lo tiene, descripción y piezas. Nada del cliente.
export function servicioDesdeOrden(orden: OrdenParaHistorial, folio: string): ServicioHistorial {
  const km = orden.vehiculo?.kilometraje;
  return {
    folio,
    fecha: orden.fechaEntrega,
    ...(Number.isInteger(km) ? { kilometraje: km as number } : {}),
    descripcion: descripcionDeTrabajos(orden.trabajos),
    piezas: piezasDeOrden(orden.piezas),
  };
}

export function expiraHistorial(ahora: number = Date.now()): Date {
  return new Date(ahora + DIAS_RETENCION_HISTORIAL * DIA_MS);
}

const minusculas = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

// ¿La orden es del mismo vehículo que el documento del historial? (marca y modelo sin importar
// mayúsculas, mismo año). Las reglas comparan igual.
export function mismoVehiculo(orden: OrdenParaHistorial, vehiculo: { marca?: string; modelo?: string; anio?: number }): boolean {
  return minusculas(orden.vehiculo?.marca) === minusculas(vehiculo.marca)
    && minusculas(orden.vehiculo?.modelo) === minusculas(vehiculo.modelo)
    && orden.vehiculo?.anio === vehiculo.anio;
}

export const nombreVehiculo = (v: { marca?: string; modelo?: string; anio?: number }) =>
  [v.marca, v.modelo, v.anio].filter((x) => x !== undefined && x !== null && x !== '').join(' ');

// WhatsApp: con el teléfono de la orden (leído en ese momento), wa.me con el número; sin él,
// wa.me sin número para que el taller elija el contacto. Siempre con el mensaje ya escrito.
export function mensajeWhatsappHistorial(nombreTaller: string, vehiculo: { marca?: string; modelo?: string; anio?: number; placas?: string }): string {
  const v = nombreVehiculo(vehiculo);
  const placas = vehiculo.placas ? ` (placas ${vehiculo.placas})` : '';
  return `Hola, le escribimos de ${nombreTaller || 'su taller'} sobre su ${v}${placas}.`;
}

export function enlaceWhatsappHistorial(telefono: unknown, mensaje: string): string {
  return whatsappHref(telefono, mensaje) ?? `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
}
