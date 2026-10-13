// Lógica pura del inventario de vehículos completos que nace de las alertas de clientes
// (yonkes/{yonkeId}/vehiculosAlerta) y del límite diario de respuestas del plan Básico.
// Sin Firestore aquí: lo usan el navegador (panel del yonke, buscador avanzado), el servidor
// (/api/buscar) y las pruebas. Las reglas de Firestore repiten lo esencial (30 días, día de
// Tijuana, límite) en firestore.rules.
import { compactarModelo } from '../app/lib/modeloCompacto';

export const DIAS_INVENTARIO_VEHICULO = 30;
const DIA_MS = 24 * 60 * 60 * 1000;
// Mismo tope que la regla: listas de piezas de un vehículo.
export const MAX_PIEZAS_LISTA = 100;
export const ZONA_HORARIA_LIMITE = 'America/Tijuana';

export const MENSAJES_VEHICULO_ALERTA = {
  preguntaVehiculo: '¿Tienes el vehículo completo?',
  guardado: 'Listo. Este vehículo quedó en tu inventario 30 días: los clientes que busquen una pieza de él te verán disponible.',
  renovado: 'Listo. Renovamos este vehículo 30 días en tu inventario.',
  piezaDescontada: 'Ya tenías este vehículo en tu inventario: descontamos esta pieza.',
  guardarFallo: 'No se pudo guardar el vehículo. Revisa tu conexión e intenta de nuevo.',
  limiteAlcanzado: 'Llegaste a tu límite de hoy. Con el plan premium respondes sin límite.',
  funcionPremium: 'Esta función es del plan premium. Renueva todo tu inventario con un solo toque.',
  textoTarjetaComprador: 'Vehículo disponible, pregunta por la pieza',
} as const;

type FechaLike = Date | { toDate: () => Date } | null | undefined;

function aFecha(v: unknown): Date | null {
  if (v instanceof Date) return v;
  if (v && typeof (v as { toDate?: () => Date }).toDate === 'function') return (v as { toDate: () => Date }).toDate();
  return null;
}

export function calcularVenceEn(ahora: Date): Date {
  return new Date(ahora.getTime() + DIAS_INVENTARIO_VEHICULO * DIA_MS);
}

// Minúsculas, sin acentos, sin espacios de más. "Faro  Derecho" = "faro derecho"; "Batería" = "bateria".
export function normalizarPieza(texto: unknown): string {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Un solo documento por vehículo y yonke: "Honda Civic 2020" -> "honda_civic_2020" (mismo
// "compacto" que el buscador usa para comparar modelos: "CR-V" = "crv").
export function idVehiculoAlerta(marca: string, modelo: string, anio: number): string {
  return `${compactarModelo(marca)}_${compactarModelo(modelo)}_${anio}`;
}

export type VehiculoAlerta = {
  yonkeId?: string;
  marca?: string;
  modelo?: string;
  ano?: number;
  piezasAlerta?: string[];
  piezasVendidas?: string[];
  estado?: string;
  venceEn?: FechaLike;
};

// Vigente = estado activo y venceEn todavía en el futuro (se compara la fecha al consultar; no
// hace falta un proceso programado que lo marque vencido).
export function estaVigente(v: VehiculoAlerta | null | undefined, ahora: Date): boolean {
  if (!v || v.estado !== 'activo') return false;
  const vence = aFecha(v.venceEn);
  return vence !== null && vence.getTime() > ahora.getTime();
}

export function piezaVendida(v: VehiculoAlerta, pieza: string): boolean {
  const buscada = normalizarPieza(pieza);
  return buscada !== '' && (v.piezasVendidas || []).some((p) => normalizarPieza(p) === buscada);
}

// Lo que ve el comprador: vehículo vigente y esa pieza no vendida.
export function disponibleParaPieza(v: VehiculoAlerta, pieza: string, ahora: Date): boolean {
  return estaVigente(v, ahora) && !piezaVendida(v, pieza);
}

// Agrega una pieza a una lista sin repetirla (comparando normalizado). Devuelve la lista nueva.
export function agregarPieza(lista: string[] | undefined, pieza: string): string[] {
  const base = lista || [];
  const limpia = String(pieza ?? '').trim();
  if (limpia === '' || base.some((p) => normalizarPieza(p) === normalizarPieza(limpia))) return base;
  return [...base, limpia].slice(-MAX_PIEZAS_LISTA);
}

// Piezas con botón "Ya lo vendí" en el panel: las que llegaron por alertas y no se han vendido.
export function piezasDisponibles(v: VehiculoAlerta): string[] {
  return (v.piezasAlerta || []).filter((p) => !piezaVendida(v, p));
}

export function diasRestantes(v: VehiculoAlerta, ahora: Date): number {
  const vence = aFecha(v.venceEn);
  if (!vence) return 0;
  return Math.max(0, Math.ceil((vence.getTime() - ahora.getTime()) / DIA_MS));
}

// El yonke contestó "La tengo" a una alerta de este vehículo:
// - ya lo tiene vigente -> la pieza se descuenta sola, sin preguntar nada más;
// - no lo tiene, o venció -> se le pregunta si tiene el vehículo completo.
export function despuesDeLaTengo(existente: VehiculoAlerta | null | undefined, ahora: Date): 'descontarPieza' | 'preguntarVehiculo' {
  return estaVigente(existente, ahora) ? 'descontarPieza' : 'preguntarVehiculo';
}

// Contestó "Sí" a "¿Tienes el vehículo completo?": crear (no existía) o renovar (vencido o quitado
// antes). Si mientras tanto quedó vigente (otra pestaña), solo se descuenta la pieza.
export function accionVehiculoCompleto(existente: VehiculoAlerta | null | undefined, ahora: Date): 'crear' | 'renovar' | 'descontarPieza' {
  if (!existente) return 'crear';
  return estaVigente(existente, ahora) ? 'descontarPieza' : 'renovar';
}

// ---------- Límite diario de respuestas (plan Básico) ----------

// Día en Tijuana como número de texto AAAAMMDD (ej. "20261012"). Las reglas aceptan el día
// calculado con UTC-8 o UTC-7 (horario de invierno o verano), así que coincide todo el año.
export function diaTijuana(fecha: Date): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA_LIMITE, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(fecha);
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${parte('year')}${parte('month')}${parte('day')}`;
}

// config/pedidosClientes.limiteRespuestasDiarias: solo un entero de 1 en adelante activa el
// límite. Sin el campo (o con otra cosa) no hay límite, como hoy.
export function limiteRespuestasDiarias(config: { limiteRespuestasDiarias?: unknown } | null | undefined): number | null {
  const v = config?.limiteRespuestasDiarias;
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 ? v : null;
}

// ¿Este yonke ya no puede responder hoy? Premium nunca llega al límite.
export function llegoAlLimite(respuestasHoy: number, limite: number | null, premium: boolean): boolean {
  if (premium || limite === null) return false;
  return respuestasHoy >= limite;
}

// Interruptor del inventario de vehículos: config/pedidosClientes con habilitado e inventarioVehiculos en true.
export function inventarioVehiculosActivo(config: { habilitado?: unknown; inventarioVehiculos?: unknown } | null | undefined): boolean {
  return config?.habilitado === true && config?.inventarioVehiculos === true;
}
