// Semáforo de frescura de inventario — funciones puras, sin dependencia de Firestore ni de
// React, para poder probarlas con datos sintéticos y reusarlas donde haga falta.
//
// Auditoría 2026-09-24 (extensión a motores/transmisiones/piezas sueltas): confirmado en
// panel/inventario/page.js y su espejo admin/yonke/[id]/inventario/page.js que las 4 categorías
// ya seguían el MISMO patrón de campos desde antes de este cambio — no hizo falta ninguna
// migración ni backfill:
//   - vehiculos           (yonkes/{id}/vehiculos)
//   - motores             (yonkes/{id}/motores, campo tipo:'Motor')
//   - transmisiones       (misma colección yonkes/{id}/motores, campo tipo:'Transmisión' — NO es
//                          una colección aparte)
//   - piezasSueltas       (yonkes/{id}/piezasSueltas)
// Las 4 guardan su fecha de captura en `fechaIngreso` (Timestamp de Firestore, escrito una sola
// vez al crear — la edición nunca la toca en ninguna de las 4) y su disponibilidad en
// `disponible` (ausente o true = disponible/activo; false = dado de baja).

export type ItemCategory = 'vehiculos' | 'motores' | 'transmisiones' | 'piezasSueltas';

export const INVENTORY_THRESHOLDS: Record<ItemCategory, { greenMaxDays: number; yellowMaxDays: number }> = {
  vehiculos: { greenMaxDays: 30, yellowMaxDays: 90 },
  motores: { greenMaxDays: 30, yellowMaxDays: 90 },
  transmisiones: { greenMaxDays: 30, yellowMaxDays: 90 },
  // Piezas sueltas se mueven más rápido que un vehículo completo — umbrales más cortos a
  // propósito (pedido explícito, no un descuido de copiar/pegar los mismos números).
  piezasSueltas: { greenMaxDays: 15, yellowMaxDays: 45 },
};

export type FreshnessStatus = 'green' | 'yellow' | 'red';

export interface ItemFreshness {
  status: FreshnessStatus;
  days: number;
}

// Alias de tipo para no romper código existente que ya importe "VehicleFreshness" por nombre.
export type VehicleFreshness = ItemFreshness;

const MS_POR_DIA = 1000 * 60 * 60 * 24;

// Límites INCLUSIVOS por categoría: el día greenMaxDays todavía es 'green', el día yellowMaxDays
// todavía es 'yellow'.
function clasificarDias(categoria: ItemCategory, dias: number): FreshnessStatus {
  const umbrales = INVENTORY_THRESHOLDS[categoria];
  if (dias <= umbrales.greenMaxDays) return 'green';
  if (dias <= umbrales.yellowMaxDays) return 'yellow';
  return 'red';
}

// Núcleo genérico por categoría — asume capturedAt válido (siempre un Date real). El caso "no
// hay fecha" se resuelve ANTES de llegar aquí (ver getItemFreshnessOrNull más abajo), para que
// esta función se quede simple, pura y siempre determinista.
export function getItemFreshness(categoria: ItemCategory, capturedAt: Date, now: Date = new Date()): ItemFreshness {
  const diffMs = now.getTime() - capturedAt.getTime();
  // Math.max(0, ...): una fecha de captura en el futuro (reloj mal puesto, dato corrupto) nunca
  // debe devolver días negativos — se trata como "capturado hoy" (0 días, 'green').
  const days = Math.max(0, Math.floor(diffMs / MS_POR_DIA));
  return { status: clasificarDias(categoria, days), days };
}

// FASE 1 original — misma firma y mismo comportamiento exacto de antes (categoría 'vehiculos'
// fija), para no romper nada de lo que ya la usa (getYonkeActivity, cualquier import existente).
export function getVehicleFreshness(capturedAt: Date, now: Date = new Date()): ItemFreshness {
  return getItemFreshness('vehiculos', capturedAt, now);
}

// Usado por <ItemFreshnessBadge/> — centraliza las dos razones por las que un ítem NO debe
// mostrar semáforo (sin fecha de captura, o disponible === false) en un solo lugar puro y
// testeable, en vez de repetir ese `if` en cada componente/página que lo use.
export function getItemFreshnessOrNull(
  categoria: ItemCategory,
  capturedAt: Date | null | undefined,
  disponible: boolean | undefined,
  now: Date = new Date(),
): ItemFreshness | null {
  if (!capturedAt) return null;
  if (disponible === false) return null;
  return getItemFreshness(categoria, capturedAt, now);
}

// FASE 2 (preparada, no conectada a UI todavía) — actividad del YONKE completo: mediana de
// antigüedad de sus vehículos activos. Un yonke con muchos vehículos viejos pero uno recién
// capturado no debe verse "reciente" por un solo dato atípico — por eso mediana, no promedio
// ni el más nuevo. Se queda específica de vehículos a propósito (no se generalizó a otras
// categorías, no se pidió).
export type YonkeActivityStatus = FreshnessStatus | 'none';

export interface YonkeVehicleInput {
  capturedAt: Date;
  // Ausente o true = activo (mismo criterio que `disponible` en motores/piezasSueltas de este
  // proyecto). false = vendido/dado de baja — se excluye del cálculo.
  disponible?: boolean;
}

export interface YonkeActivity {
  status: YonkeActivityStatus;
  medianDays: number | null;
}

function mediana(diasOrdenados: number[]): number {
  const n = diasOrdenados.length;
  const mitad = Math.floor(n / 2);
  return n % 2 !== 0
    ? diasOrdenados[mitad]
    : (diasOrdenados[mitad - 1] + diasOrdenados[mitad]) / 2;
}

export function getYonkeActivity(vehicles: YonkeVehicleInput[], now: Date = new Date()): YonkeActivity {
  const activos = vehicles.filter((v) => v.disponible !== false);
  if (activos.length === 0) {
    return { status: 'none', medianDays: null };
  }
  const dias = activos
    .map((v) => getVehicleFreshness(v.capturedAt, now).days)
    .sort((a, b) => a - b);
  const medianDays = mediana(dias);
  return { status: clasificarDias('vehiculos', medianDays), medianDays };
}
