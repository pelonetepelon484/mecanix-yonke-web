// Seguimiento público de órdenes (etapa 1): lógica pura, sin Firestore.
// - El enlace es https://www.mecanixyonkevirtual.com/seguimiento/{token}: token de 32 bytes al azar
//   en base64url (43 caracteres). El token completo vive SOLO en la orden (seguimientoToken, que lee
//   el dueño); el documento público es seguimientos/{huella}, huella = SHA-256 hex del token.
// - El documento público lleva solo: taller (nombre y WhatsApp), marca/modelo/año, estado, nota,
//   fecha de actualización y vencimiento. NUNCA datos del cliente, placas, precios ni el folio
//   (el folio se guarda solo para sincronizar y seguimientoPublico() no lo devuelve).
// - Vence a más tardar cuando vence la orden y a más tardar 30 días después de la PRIMERA entrega.
// Las reglas de Firestore (firestore.rules -> seguimientos) exigen lo mismo; esto es para la app.
import { NOMBRE_ESTADO_ORDEN, ESTADOS_ORDEN, type EstadoOrden } from './ordenes';
import { whatsappHref } from './whatsapp';

// Siempre el dominio principal (con www): en un subdominio de yonke el middleware mandaría
// /seguimiento/... a la página del yonke. Nunca window.location.origin.
export const URL_BASE_SEGUIMIENTO = 'https://www.mecanixyonkevirtual.com/seguimiento/';
export const DIAS_SEGUIMIENTO_TRAS_ENTREGA = 30;
export const MAX_NOTA_SEGUIMIENTO = 200;
// Margen contra el reloj del celular cuando la entrega es AHORA (la hora real la pone el servidor):
// el vencimiento se calcula 10 minutos antes para no pasarse del límite que exigen las reglas.
const MARGEN_RELOJ_MS = 10 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

export const ADVERTENCIA_NOTA_SEGUIMIENTO = 'No escribas nombres ni teléfonos de clientes';
export const ADVERTENCIA_ENLACE_SEGUIMIENTO = 'Cualquier persona que tenga este enlace puede ver el estado de la orden, el vehículo y la nota. Compártelo solo con tu cliente. Si lo compartiste por error, desactívalo.';
export const AVISO_ENTREGA_SEGUIMIENTO = 'El enlace de seguimiento dejará de abrir 30 días después de hoy';

export const MENSAJES_SEGUIMIENTO = {
  notaLarga: `La nota puede tener máximo ${MAX_NOTA_SEGUIMIENTO} caracteres.`,
  notaTelefono: 'La nota no puede llevar números de teléfono. Quítalo e intenta de nuevo.',
  notaCorreo: 'La nota no puede llevar correos electrónicos (el signo @). Quítalo e intenta de nuevo.',
  anteriorAlAviso: 'Esta orden se creó antes del aviso de privacidad que incluye el seguimiento en línea, por eso no puede tener enlace de seguimiento.',
  vencido: 'Ya pasaron 30 días desde la entrega: esta orden ya no puede tener enlace de seguimiento.',
  sinPremium: 'Activar el enlace de seguimiento es del plan Premium.',
  fallo: 'No pudimos guardar el enlace de seguimiento. Revisa tu conexión e intenta de nuevo.',
  desactivarFallo: 'No pudimos desactivar el enlace. Revisa tu conexión e intenta de nuevo.',
  // Página pública
  noEncontrado: 'Este enlace de seguimiento no existe o ya venció. Pregunta a tu taller.',
  noDisponible: 'El seguimiento en línea no está disponible por ahora. Intenta más tarde.',
  limiteConsultas: 'Estás consultando muy seguido. Espera un minuto y vuelve a intentar.',
} as const;

// ---------- Token y huella ----------

export function esTokenSeguimiento(t: unknown): t is string {
  return typeof t === 'string' && /^[A-Za-z0-9_-]{43}$/.test(t);
}

// 32 bytes al azar (crypto.getRandomValues, en el navegador del taller) en base64url sin relleno.
export function generarTokenSeguimiento(azar: (b: Uint8Array) => Uint8Array = (b) => globalThis.crypto.getRandomValues(b)): string {
  const bytes = azar(new Uint8Array(32));
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// SHA-256 en hexadecimal (minúsculas), igual que las reglas (hashing.sha256(...).toHexString().lower())
// y que hashCodigo() del servidor.
export async function huellaSeguimiento(token: string): Promise<string> {
  const datos = new TextEncoder().encode(token);
  const resumen = await globalThis.crypto.subtle.digest('SHA-256', datos);
  return Array.from(new Uint8Array(resumen), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function enlaceSeguimiento(token: string): string {
  return `${URL_BASE_SEGUIMIENTO}${token}`;
}

// Saca el token de un enlace pegado (admin). null si no es un enlace de seguimiento válido.
export function tokenDeEnlace(texto: unknown): string | null {
  if (typeof texto !== 'string') return null;
  const limpio: string = texto.trim();
  if (/^[A-Za-z0-9_-]{43}$/.test(limpio)) return limpio;
  const m = limpio.match(/\/seguimiento\/([A-Za-z0-9_-]{43})(?:[/?#].*)?$/);
  return m ? m[1] : null;
}

// ---------- Nota pública ----------

// null si está bien. Rechaza 10 o más dígitos seguidos (también separados por espacios, guiones,
// puntos o paréntesis, como se escribe un teléfono) y cualquier «@».
export function validarNotaSeguimiento(nota: unknown): string | null {
  const t = typeof nota === 'string' ? nota : '';
  if (t.length > MAX_NOTA_SEGUIMIENTO) return MENSAJES_SEGUIMIENTO.notaLarga;
  if (/\d(?:[\s().-]*\d){9,}/.test(t)) return MENSAJES_SEGUIMIENTO.notaTelefono;
  if (t.includes('@') || t.includes('＠')) return MENSAJES_SEGUIMIENTO.notaCorreo;
  return null;
}

// ---------- Vencimiento ----------

type ConFecha = { toDate?: () => Date; toMillis?: () => number } | Date | null | undefined;
function aMs(v: unknown): number | null {
  if (v instanceof Date) return v.getTime();
  const f = v as ConFecha & { toMillis?: () => number };
  if (f && typeof f.toMillis === 'function') return f.toMillis();
  if (f && typeof (f as { toDate?: () => Date }).toDate === 'function') return (f as { toDate: () => Date }).toDate().getTime();
  return null;
}

// Vencimiento del enlace: lo más temprano entre el vencimiento de la orden y la primera entrega + 30
// días. primeraEntrega: la fecha guardada; 'ahora' si la orden se entrega en este guardado (la hora
// la pone el servidor: se usa la del celular menos 10 minutos de margen); null si nunca se entregó.
export function venceSeguimiento(expiraOrden: unknown, primeraEntrega: unknown | 'ahora', ahora: Date = new Date()): Date | null {
  const orden = aMs(expiraOrden);
  if (orden === null) return null;
  let tope = Infinity;
  if (primeraEntrega === 'ahora') tope = ahora.getTime() + DIAS_SEGUIMIENTO_TRAS_ENTREGA * DIA_MS - MARGEN_RELOJ_MS;
  else {
    const p = aMs(primeraEntrega);
    if (p !== null) tope = p + DIAS_SEGUIMIENTO_TRAS_ENTREGA * DIA_MS;
  }
  return new Date(Math.min(orden, tope));
}

// ---------- Documento público ----------

export type DocumentoSeguimiento = {
  tallerId: string; folio: string; tallerNombre: string; tallerWhatsapp: string;
  marca: string; modelo: string; anio: number; estado: string; nota: string; expiraAt: Date;
};

type OrdenParaSeguimiento = {
  estado?: string; vehiculo?: { marca?: string; modelo?: string; anio?: number }; notaSeguimiento?: string;
};

// Lo que se escribe en seguimientos/{huella} (sin actualizadoAt: lo pone el servidor). Solo los
// campos que exigen las reglas, copiados de la orden que se guarda y del taller.
export function documentoSeguimiento(
  { tallerId, folio, orden, taller, expiraAt }:
  { tallerId: string; folio: string; orden: OrdenParaSeguimiento; taller: { nombre?: string; whatsapp?: string } | null; expiraAt: Date },
): DocumentoSeguimiento {
  return {
    tallerId,
    folio,
    tallerNombre: taller?.nombre ?? '',
    tallerWhatsapp: taller?.whatsapp ?? '',
    marca: orden.vehiculo?.marca ?? '',
    modelo: orden.vehiculo?.modelo ?? '',
    anio: orden.vehiculo?.anio as number,
    estado: orden.estado ?? '',
    nota: orden.notaSeguimiento ?? '',
    expiraAt,
  };
}

export type SeguimientoPublico = {
  tallerNombre: string; tallerWhatsapp: string; marca: string; modelo: string; anio: number | null;
  estado: string; estadoNombre: string; nota: string; actualizadoAt: string | null;
};

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

// LISTA BLANCA de lo que ve el público. Cualquier otro campo del documento (folio, tallerId,
// expiraAt o lo que se agregue después) NO sale. null si el documento no sirve o ya venció.
export function seguimientoPublico(d: unknown, ahora: Date = new Date()): SeguimientoPublico | null {
  if (!d || typeof d !== 'object') return null;
  const s = d as Record<string, unknown>;
  const vence = aMs(s.expiraAt);
  if (vence === null || vence <= ahora.getTime()) return null;
  const estado = ESTADOS_ORDEN.includes(s.estado as EstadoOrden) ? (s.estado as EstadoOrden) : null;
  if (!estado) return null;
  const act = aMs(s.actualizadoAt);
  return {
    tallerNombre: texto(s.tallerNombre, 100),
    tallerWhatsapp: texto(s.tallerWhatsapp, 20),
    marca: texto(s.marca, 60),
    modelo: texto(s.modelo, 60),
    anio: Number.isInteger(s.anio) ? (s.anio as number) : null,
    estado,
    estadoNombre: NOMBRE_ESTADO_ORDEN[estado],
    nota: texto(s.nota, MAX_NOTA_SEGUIMIENTO),
    actualizadoAt: act === null ? null : new Date(act).toISOString(),
  };
}

// ---------- WhatsApp ----------

const nombreVehiculo = (v: { marca?: string; modelo?: string; anio?: number | null }) =>
  [v.marca, v.modelo, v.anio].filter((x) => x !== undefined && x !== null && x !== '').join(' ');

// Taller -> cliente: con el teléfono que la orden ya tiene en pantalla; sin él, wa.me sin número
// (el taller elige el contacto). No se guarda nada.
export function enlaceCompartirSeguimiento(telefono: unknown, nombreTaller: string, vehiculo: { marca?: string; modelo?: string; anio?: number }, enlace: string): string {
  const v = nombreVehiculo(vehiculo);
  const mensaje = `Hola, le escribimos de ${nombreTaller || 'su taller'}. Puede ver el avance de su ${v || 'vehículo'} aquí: ${enlace}`;
  return whatsappHref(telefono, mensaje) ?? `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
}

// Cliente -> taller (página pública). null si el taller no tiene un WhatsApp válido.
export function enlaceWhatsappAlTaller(s: Pick<SeguimientoPublico, 'tallerWhatsapp' | 'marca' | 'modelo' | 'anio'>): string | null {
  const v = nombreVehiculo(s);
  return whatsappHref(s.tallerWhatsapp, `Hola, pregunto por mi ${v || 'vehículo'}.`);
}
