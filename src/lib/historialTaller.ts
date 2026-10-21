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

// ---------- Recordatorios (etapa 3) ----------
// Lista APARTE dentro del vehículo (recordatorios[], hasta 10), no dentro de servicios[] (los
// servicios anteriores no se pueden modificar). Sin datos personales. proximoAviso = el menor
// (fecha - avisarDiasAntes) de los pendientes, o null: es lo que consulta "Servicios por vencer".
// Las reglas de Firestore revisan lo mismo. Fechas en milisegundos aquí; datos.js las convierte.
// Tope de 10 (no 20): las reglas revisan la lista posición por posición y Firestore corta cada
// revisión a 1,000 operaciones; medido en el emulador, 10 caben y 12 ya no. Por lo mismo, cada
// guardado cambia pocos recordatorios (ver pasosParaAgregar).

export const MAX_RECORDATORIOS = 10;
export const MAX_TIPO_RECORDATORIO = 60;
export const AVISAR_DIAS_ANTES_POR_OMISION = 15;
export const MAX_AVISAR_DIAS_ANTES = 60;
export const MAX_MESES_RECORDATORIO = 120;
export const DIAS_AVISO_BORRADO = 30;

// Servicios periódicos comunes (intervalo editable al agregar).
export const SERVICIOS_PERIODICOS = [
  { tipo: 'Cambio de aceite', meses: 6 },
  { tipo: 'Frenos', meses: 12 },
  { tipo: 'Afinación', meses: 12 },
  { tipo: 'Batería', meses: 24 },
  { tipo: 'Rotación y revisión de llantas', meses: 6 },
  { tipo: 'Anticongelante', meses: 24 },
  { tipo: 'Filtro de aire', meses: 12 },
  { tipo: 'Alineación y balanceo', meses: 12 },
] as const;

export const MENSAJES_RECORDATORIO = {
  tipo: `Escribe el servicio del recordatorio (máximo ${MAX_TIPO_RECORDATORIO} letras).`,
  meses: `El intervalo debe ser de 1 a ${MAX_MESES_RECORDATORIO} meses.`,
  dias: `Los días de aviso deben ser de 0 a ${MAX_AVISAR_DIAS_ANTES}.`,
  lleno: `Este vehículo ya tiene ${MAX_RECORDATORIOS} recordatorios. Borra algunos atendidos.`,
  guardarFallo: 'No pudimos guardar el recordatorio. Revisa tu conexión e intenta de nuevo.',
} as const;

export type EstadoRecordatorio = 'pendiente' | 'atendido';
export type Recordatorio = {
  id: string; tipo: string; fecha: number; avisarDiasAntes: number; folio: string; estado: EstadoRecordatorio; creadoAt: number;
};

// Id corto al azar (8 letras minúsculas y números).
export function idRecordatorio(aleatorio: () => number = Math.random): string {
  const alfabeto = 'abcdefghijkmnpqrstuvwxyz23456789';
  return Array.from({ length: 8 }, () => alfabeto[Math.floor(aleatorio() * alfabeto.length)]).join('');
}

// Misma fecha N meses después (si el día no existe en ese mes, el último día del mes).
export function sumarMeses(fechaMs: number, meses: number): number {
  const f = new Date(fechaMs);
  const dia = f.getDate();
  f.setDate(1);
  f.setMonth(f.getMonth() + meses);
  const ultimo = new Date(f.getFullYear(), f.getMonth() + 1, 0).getDate();
  f.setDate(Math.min(dia, ultimo));
  return f.getTime();
}

export const avisoDe = (r: Pick<Recordatorio, 'fecha' | 'avisarDiasAntes'>) => r.fecha - r.avisarDiasAntes * DIA_MS;

// El menor aviso de los pendientes, o null.
export function calcularProximoAviso(recordatorios: Recordatorio[]): number | null {
  const avisos = recordatorios.filter((r) => r.estado === 'pendiente').map(avisoDe);
  return avisos.length ? Math.min(...avisos) : null;
}

export const tipoValido = (t: unknown) => typeof t === 'string' && t.trim().length >= 1 && t.trim().length <= MAX_TIPO_RECORDATORIO;
export const mesesValidos = (m: unknown) => Number.isInteger(m) && (m as number) >= 1 && (m as number) <= MAX_MESES_RECORDATORIO;
export const diasValidos = (d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= MAX_AVISAR_DIAS_ANTES;

const mismoTipo = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Pasos (listas sucesivas, un guardado cada una) para agregar UN recordatorio nuevo (fecha =
// entrega + meses), sin pasar el límite de las reglas:
// 1) si ya hay 10, quitar el atendido más viejo (si no hay atendidos, error "lleno");
// 2) el pendiente del mismo tipo queda 'atendido' y se agrega el nuevo al final.
export function pasosParaAgregar(
  existentes: Recordatorio[],
  nuevo: { tipo: string; meses: number },
  { fechaEntrega, folio, ahora, id = idRecordatorio }: { fechaEntrega: number; folio: string; ahora: number; id?: () => string },
): Recordatorio[][] {
  if (!tipoValido(nuevo.tipo)) throw new Error(MENSAJES_RECORDATORIO.tipo);
  if (!mesesValidos(nuevo.meses)) throw new Error(MENSAJES_RECORDATORIO.meses);
  const pasos: Recordatorio[][] = [];
  let lista = existentes.map((r) => ({ ...r }));
  if (lista.length >= MAX_RECORDATORIOS) {
    const i = lista.findIndex((r) => r.estado === 'atendido');
    if (i === -1) throw new Error(MENSAJES_RECORDATORIO.lleno);
    lista = lista.filter((_, k) => k !== i);
    pasos.push(lista);
  }
  lista = lista.map((r) => (r.estado === 'pendiente' && mismoTipo(r.tipo, nuevo.tipo) ? { ...r, estado: 'atendido' as const } : r));
  lista.push({
    id: id(), tipo: nuevo.tipo.trim(), fecha: sumarMeses(fechaEntrega, nuevo.meses), avisarDiasAntes: AVISAR_DIAS_ANTES_POR_OMISION,
    folio, estado: 'pendiente', creadoAt: ahora,
  });
  pasos.push(lista);
  return pasos;
}

// Cambios desde el detalle (solo pendientes se adelantan o cambian días de aviso).
export function cambiarRecordatorio(lista: Recordatorio[], id: string, cambios: { fecha?: number; avisarDiasAntes?: number; estado?: EstadoRecordatorio }): Recordatorio[] {
  if (cambios.avisarDiasAntes !== undefined && !diasValidos(cambios.avisarDiasAntes)) throw new Error(MENSAJES_RECORDATORIO.dias);
  return lista.map((r) => (r.id === id ? { ...r, ...cambios } : r));
}

export const quitarRecordatorio = (lista: Recordatorio[], id: string) => lista.filter((r) => r.id !== id);

// Pendientes que ya tocan aviso (aviso <= ahora), del más antiguo al más reciente.
export const pendientesPorAvisar = (lista: Recordatorio[], ahora: number) =>
  lista.filter((r) => r.estado === 'pendiente' && avisoDe(r) <= ahora).sort((a, b) => a.fecha - b.fecha);

export function mensajeWhatsappRecordatorio(
  nombreTaller: string, vehiculo: { marca?: string; modelo?: string; anio?: number; placas?: string }, tipos: string[], fechaTexto: string,
): string {
  const servicio = tipos.join(', ') || 'un servicio';
  const v = nombreVehiculo(vehiculo);
  return `Hola, le escribimos de ${nombreTaller || 'su taller'}. Le recordamos que su vehículo con placas ${vehiculo.placas ?? ''}${v ? ` (${v})` : ''} tiene pendiente: ${servicio}${fechaTexto ? `, para el ${fechaTexto}` : ''}. Por favor esté atento al kilometraje y avísenos al llegar o acercarse a los 5 mil km.`;
}
