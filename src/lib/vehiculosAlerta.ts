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
  otroIgualSumado: 'Listo. Sumamos otra unidad igual, renovamos 30 días y descontamos esta pieza.',
  noBajarUnidades: 'Ya marcaste ventas de esa pieza. Primero deshaz una venta.',
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

// unidades: cuántos vehículos iguales tiene el yonke (sin el campo = 1, registros de antes).
// ventasPiezas: { "<pieza normalizada>": cuántas vendidas }. Sin el campo (registros de antes),
// cada pieza de piezasVendidas cuenta como vendida 1 vez. piezasVendidas se sigue guardando con
// las piezas vendidas en TODAS las unidades, para que la versión anterior de la app las oculte bien.
export type VehiculoAlerta = {
  yonkeId?: string;
  marca?: string;
  modelo?: string;
  ano?: number;
  unidades?: number;
  ventasPiezas?: Record<string, number>;
  piezasAlerta?: string[];
  piezasVendidas?: string[];
  estado?: string;
  venceEn?: FechaLike;
};
export const MAX_UNIDADES = 100;

// Vigente = estado activo y venceEn todavía en el futuro (se compara la fecha al consultar; no
// hace falta un proceso programado que lo marque vencido).
export function estaVigente(v: VehiculoAlerta | null | undefined, ahora: Date): boolean {
  if (!v || v.estado !== 'activo') return false;
  const vence = aFecha(v.venceEn);
  return vence !== null && vence.getTime() > ahora.getTime();
}

export function unidadesDe(v: VehiculoAlerta): number {
  const u = v.unidades;
  return typeof u === 'number' && Number.isInteger(u) && u >= 1 ? u : 1;
}

// Conteo de ventas por pieza normalizada, leyendo también los registros de antes.
export function ventasDe(v: VehiculoAlerta): Record<string, number> {
  const ventas: Record<string, number> = {};
  if (v.ventasPiezas && typeof v.ventasPiezas === 'object') {
    for (const [clave, n] of Object.entries(v.ventasPiezas)) {
      const k = normalizarPieza(clave);
      if (k !== '' && typeof n === 'number' && n > 0) ventas[k] = (ventas[k] || 0) + Math.floor(n);
    }
    return ventas;
  }
  for (const p of v.piezasVendidas || []) {
    const k = normalizarPieza(p);
    if (k !== '') ventas[k] = 1;
  }
  return ventas;
}

export function vendidasDe(v: VehiculoAlerta, pieza: string): number {
  return ventasDe(v)[normalizarPieza(pieza)] || 0;
}

// Vendida = vendida en TODAS las unidades (3 de 3). Con 1 de 3 sigue disponible.
export function piezaVendida(v: VehiculoAlerta, pieza: string): boolean {
  const buscada = normalizarPieza(pieza);
  return buscada !== '' && vendidasDe(v, buscada) >= unidadesDe(v);
}

// Mayor número de ventas de cualquier pieza: "−1" no puede bajar las unidades de ahí.
export function maxVentas(v: VehiculoAlerta): number {
  return Math.max(0, ...Object.values(ventasDe(v)));
}

// Nombre para mostrar de una pieza normalizada (el que escribió el cliente o el yonke).
function nombrePieza(v: VehiculoAlerta, clave: string): string {
  return [...(v.piezasAlerta || []), ...(v.piezasVendidas || [])].find((p) => normalizarPieza(p) === clave) || clave;
}

// Piezas del vehículo para el panel: las de las alertas y las vendidas, con su conteo.
export function piezasDelVehiculo(v: VehiculoAlerta): { nombre: string; vendidas: number; unidades: number }[] {
  const ventas = ventasDe(v);
  const unidades = unidadesDe(v);
  const claves: string[] = [];
  for (const p of [...(v.piezasAlerta || []), ...Object.keys(ventas)]) {
    const k = normalizarPieza(p);
    if (k !== '' && !claves.includes(k)) claves.push(k);
  }
  return claves.map((k) => ({ nombre: nombrePieza(v, k), vendidas: Math.min(ventas[k] || 0, unidades), unidades }));
}

// Lo que se guarda tras cambiar ventas o unidades: el conteo, la lista de piezas conocidas y
// piezasVendidas (solo las vendidas en todas las unidades, para la versión anterior de la app).
function camposDeVentas(v: VehiculoAlerta, ventas: Record<string, number>, unidades: number, piezasAlerta: string[]) {
  return {
    ventasPiezas: ventas,
    piezasAlerta,
    piezasVendidas: Object.keys(ventas).filter((k) => ventas[k] >= unidades).map((k) => nombrePieza({ ...v, piezasAlerta }, k)),
  };
}

// "Ya lo vendí" (delta +1) o "Deshacer" (delta −1). null si no se puede: ya vendida en todas
// las unidades, o no hay venta que deshacer.
export function cambiosVenta(v: VehiculoAlerta, pieza: string, delta: 1 | -1) {
  const clave = normalizarPieza(pieza);
  if (clave === '') return null;
  const unidades = unidadesDe(v);
  const ventas = ventasDe(v);
  const nuevo = (ventas[clave] || 0) + delta;
  if (nuevo < 0 || nuevo > unidades) return null;
  if (nuevo === 0) delete ventas[clave];
  else ventas[clave] = nuevo;
  return camposDeVentas(v, ventas, unidades, agregarPieza(v.piezasAlerta, String(pieza).trim()));
}

// "+1 / Tengo otro igual" (delta +1) o "−1". null si no se puede: tope de unidades, bajar de 1, o
// bajar de las ventas ya marcadas. El "+1" además renueva 30 días (eso lo agrega quien guarda).
export function cambiosUnidades(v: VehiculoAlerta, delta: 1 | -1) {
  const unidades = unidadesDe(v) + delta;
  if (unidades < 1 || unidades > MAX_UNIDADES || unidades < maxVentas(v)) return null;
  return { unidades, ...camposDeVentas(v, ventasDe(v), unidades, v.piezasAlerta || []) };
}

// Lo que ve el comprador: vehículo vigente y esa pieza no vendida en todas las unidades.
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


export function diasRestantes(v: VehiculoAlerta, ahora: Date): number {
  const vence = aFecha(v.venceEn);
  if (!vence) return 0;
  return Math.max(0, Math.ceil((vence.getTime() - ahora.getTime()) / DIA_MS));
}

// El yonke contestó "La tengo" a una alerta de este vehículo:
// - ya lo tiene vigente -> la pieza se descuenta sola, sin preguntar nada más (si ya estaba
//   vendida en todas las unidades, quien guarda pregunta "¿Tienes otro igual?");
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
