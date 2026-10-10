// Lógica pura del pedido de pieza de clientes sin cuenta (colección pedidosClientes).
// Reutiliza las validaciones del pedido de piezas de talleres (solicitudesPiezas.ts) sin
// modificarlas: mismo vehículo, misma pieza y misma vigencia de 5 días; el pedido del cliente
// no lleva nota libre. Sin Firestore ni node:crypto aquí: lo usan el navegador y el servidor.
import { DIAS_VIGENCIA_SOLICITUD, MENSAJES_SOLICITUD, calcularExpiraAtSolicitud, validarSolicitud, type Vehiculo } from './solicitudesPiezas';

export const DIAS_VIGENCIA_PEDIDO = DIAS_VIGENCIA_SOLICITUD;
export const calcularExpiraAtPedido = calcularExpiraAtSolicitud;

// Límites (los aplica el servidor con contadores en pedidosClientesLimite).
export const MAX_PEDIDOS_POR_WHATSAPP_DIA = 3;
export const MAX_PEDIDOS_POR_IP_HORA = 5;
export const MAX_CONSULTAS_POR_IP_MINUTO = 30;
export const MAX_AVISOS_ADMIN_HORA = 10;
export const MAX_PEDIDOS_ABIERTOS_LISTA = 30;
export const MAX_MARCA_MODELO = 60;
// La página /mi-pedido se actualiza sola cada 15 s mientras está a la vista, hasta 30 min.
export const INTERVALO_RECARGA_MS = 15000;
export const DURACION_RECARGA_MS = 30 * 60 * 1000;

export const MENSAJES_PEDIDO = {
  ...MENSAJES_SOLICITUD,
  estado: 'Elige el estado donde buscas la pieza.',
  whatsapp: 'Escribe tu WhatsApp a 10 dígitos (ej. 664 123 4567).',
  limiteWhatsapp: `Ya enviaste ${MAX_PEDIDOS_POR_WHATSAPP_DIA} alertas hoy con este WhatsApp. Intenta mañana.`,
  limiteIp: 'Enviaste muchas alertas seguidas. Espera un rato y vuelve a intentar.',
  limiteConsultas: 'Demasiadas consultas seguidas. Espera un momento.',
  noDisponible: 'Esta función no está disponible por ahora.',
  noEncontrado: 'No encontramos este pedido. Revisa que el enlace esté completo.',
  guardarFallo: 'No pudimos enviar tu alerta. Revisa tu conexión e intenta de nuevo.',
  solicitudInvalida: 'Solicitud inválida.',
} as const;

// WhatsApp de México a 10 dígitos. Acepta espacios, guiones, +52 o 52 al inicio (y el 1 viejo
// de celulares, +521). Devuelve null si no son 10 dígitos al final.
export function normalizarWhatsapp(texto: unknown): string | null {
  if (typeof texto !== 'string') return null;
  let d = texto.replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('521')) d = d.slice(3);
  else if (d.length === 12 && d.startsWith('52')) d = d.slice(2);
  return /^[0-9]{10}$/.test(d) ? d : null;
}

export type DatosPedidoCliente = { vehiculo: Vehiculo; pieza: string; estado: string; whatsapp: string };

// Primer error del pedido, en el orden del formulario. null si todo está bien.
// idsEstados: ids válidos de estado (los mismos de yonkes/{id}.estado, ver estadoDeYonke).
export function validarPedidoCliente(d: DatosPedidoCliente, idsEstados: string[]): string | null {
  const base = validarSolicitud({ vehiculo: d.vehiculo, pieza: d.pieza, nota: '' });
  if (base) return base;
  // Mismo tope que la regla (60): validarSolicitud no revisa el largo de marca/modelo.
  if (d.vehiculo.marca.trim().length > MAX_MARCA_MODELO || d.vehiculo.modelo.trim().length > MAX_MARCA_MODELO) return MENSAJES_PEDIDO.vehiculo;
  if (typeof d.estado !== 'string' || !idsEstados.includes(d.estado)) return MENSAJES_PEDIDO.estado;
  if (!normalizarWhatsapp(d.whatsapp)) return MENSAJES_PEDIDO.whatsapp;
  return null;
}

// IDs de documento automáticos de Firestore (20 caracteres) y código del enlace (32 bytes en base64url = 43).
export function esIdPedido(id: unknown): id is string {
  return typeof id === 'string' && /^[A-Za-z0-9]{20}$/.test(id);
}
export function esCodigo(c: unknown): c is string {
  return typeof c === 'string' && /^[A-Za-z0-9_-]{43}$/.test(c);
}

function aFecha(v: unknown): Date | null {
  if (v instanceof Date) return v;
  if (v && typeof (v as { toDate?: () => Date }).toDate === 'function') return (v as { toDate: () => Date }).toDate();
  return null;
}

export function estaVencido(expiraAt: unknown, ahora: Date): boolean {
  const f = aFecha(expiraAt);
  return !f || f.getTime() <= ahora.getTime();
}

type PedidoDoc = { vehiculo: Vehiculo; pieza: string; estado: string; estadoPedido?: string; creadoAt?: unknown; expiraAt?: unknown };

// Lo único que sale del pedido hacia afuera (página pública, enlace del cliente): sin WhatsApp ni código.
export function pedidoPublico(id: string, d: PedidoDoc) {
  return {
    id,
    vehiculo: { marca: d.vehiculo.marca, modelo: d.vehiculo.modelo, anio: d.vehiculo.anio },
    pieza: d.pieza,
    estado: d.estado,
    creadoAt: aFecha(d.creadoAt)?.toISOString() ?? null,
  };
}

type RespuestaDoc = { yonkeId: string; yonkeNombre: string; tieneLaPieza: boolean; precio?: number; nota?: string; whatsapp?: string; creadoAt?: unknown };

// Respuesta tal como la ve el cliente. "verificado" se toma del yonke en vivo (lo pone el admin).
export function respuestaParaCliente(r: RespuestaDoc, yonke: { verificado?: unknown } | null | undefined) {
  return {
    yonkeNombre: r.yonkeNombre,
    tieneLaPieza: r.tieneLaPieza === true,
    precio: r.tieneLaPieza === true && typeof r.precio === 'number' ? r.precio : null,
    nota: typeof r.nota === 'string' ? r.nota : '',
    whatsapp: typeof r.whatsapp === 'string' ? r.whatsapp : '',
    verificado: yonke?.verificado === true,
    creadoAt: aFecha(r.creadoAt)?.toISOString() ?? null,
  };
}

// Primero los que la tienen (más barato primero), luego los que no.
export function ordenarRespuestas<T extends { tieneLaPieza: boolean; precio: number | null }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => {
    if (a.tieneLaPieza !== b.tieneLaPieza) return a.tieneLaPieza ? -1 : 1;
    return (a.precio ?? 0) - (b.precio ?? 0);
  });
}

export function enlaceMiPedido(origen: string, id: string, codigo: string): string {
  return `${origen.replace(/\/$/, '')}/mi-pedido/${id}?c=${codigo}`;
}

// wa.me hacia el propio número del cliente, con su enlace ya escrito (para guardarlo).
export function enlaceGuardarPorWhatsapp(whatsapp: string, enlace: string): string {
  const numero = normalizarWhatsapp(whatsapp) ?? '';
  const texto = `Mi alerta de búsqueda en Mecanix (guárdalo para ver las respuestas de los yonkes): ${enlace}`;
  return `https://wa.me/52${numero}?text=${encodeURIComponent(texto)}`;
}

// ---------- Panel admin "Pedidos de piezas" ----------
export const ESTADOS_PEDIDO = ['abierta', 'cerrada', 'cancelada'] as const;

// Contadores de arriba. conteos: { [pedidoId]: número de respuestas } (solo de los abiertos).
// "Cerrados en los últimos 7 días" usa cerradoAt (lo pone el admin al cerrar).
export function resumenPedidos(
  pedidos: { id: string; estadoPedido?: string; expiraAt?: unknown; cerradoAt?: unknown }[],
  conteos: Record<string, number>,
  ahora: Date,
) {
  const abiertos = pedidos.filter((p) => p.estadoPedido === 'abierta' && !estaVencido(p.expiraAt, ahora));
  const hace7Dias = ahora.getTime() - 7 * 24 * 60 * 60 * 1000;
  return {
    abiertos: abiertos.length,
    conRespuesta: abiertos.filter((p) => (conteos[p.id] ?? 0) > 0).length,
    sinRespuesta: abiertos.filter((p) => (conteos[p.id] ?? 0) === 0).length,
    cerrados7Dias: pedidos.filter((p) => p.estadoPedido === 'cerrada' && (aFecha(p.cerradoAt)?.getTime() ?? 0) >= hace7Dias).length,
  };
}

// Lo que se muestra en la lista: un pedido "abierta" ya vencido (el TTL aún no lo borra) se ve como "vencido".
export function estadoVisible(p: { estadoPedido?: string; expiraAt?: unknown }, ahora: Date): string {
  if (p.estadoPedido === 'abierta' && estaVencido(p.expiraAt, ahora)) return 'vencido';
  return p.estadoPedido || '';
}

// Aviso al WhatsApp del admin. A propósito SIN el WhatsApp del cliente (vive en privado/contacto).
export function mensajeAvisoAdmin(d: { vehiculo: Vehiculo; pieza: string }, estadoNombre: string): string {
  return `🙋 Nuevo pedido de pieza de un cliente en Mecanix!\n\nPieza: ${d.pieza}\nVehículo: ${d.vehiculo.marca} ${d.vehiculo.modelo} ${d.vehiculo.anio}\nEstado: ${estadoNombre}\n\nLos yonkes activos de ese estado ya lo ven en su panel. El WhatsApp del cliente está en Firebase (privado/contacto).`;
}
