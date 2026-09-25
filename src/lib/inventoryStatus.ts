// Semáforo de frescura de inventario — funciones puras, sin dependencia de Firestore ni de
// React, para poder probarlas con datos sintéticos y reusarlas donde haga falta.
//
// Auditoría del modelo real (2026-09-24): los vehículos de un yonke
// (yonkes/{yonkeId}/vehiculos) guardan su fecha de captura en el campo `fechaIngreso`
// (Timestamp de Firestore, escrito una sola vez con `new Date()` al crear el documento —
// nunca se toca al editar marca/modelo/año, ver panel/inventario/page.js). Los vehículos NO
// tienen hoy un campo "vendido"/"activo" propio — solo motores y piezasSueltas tienen un
// toggle `disponible` (ausente o true = disponible; false = dado de baja). getYonkeActivity()
// de abajo sigue ese mismo criterio (`disponible !== false`) para que, si el modelo de datos
// de vehículos llega a tener ese campo más adelante, esta función ya funcione correcto sin
// cambios — mientras tanto, todos los vehículos existentes cuentan como activos.

export const INVENTORY_THRESHOLDS = {
  greenMaxDays: 30,
  yellowMaxDays: 90,
} as const;

export type FreshnessStatus = 'green' | 'yellow' | 'red';

export interface VehicleFreshness {
  status: FreshnessStatus;
  days: number;
}

const MS_POR_DIA = 1000 * 60 * 60 * 24;

// Clasifica un número de días ya calculado contra los umbrales — compartido por
// getVehicleFreshness (días desde la captura) y getYonkeActivity (mediana de esos días).
// Límites INCLUSIVOS: día 30 todavía es 'green', día 90 todavía es 'yellow'.
function clasificarDias(dias: number): FreshnessStatus {
  if (dias <= INVENTORY_THRESHOLDS.greenMaxDays) return 'green';
  if (dias <= INVENTORY_THRESHOLDS.yellowMaxDays) return 'yellow';
  return 'red';
}

// FASE 1 — semáforo por vehículo individual, basado en su propia fecha de captura.
// `now` es inyectable a propósito (nunca `new Date()` interno sin parámetro) para que los
// tests sean deterministas sin necesidad de mockear el reloj del sistema.
export function getVehicleFreshness(capturedAt: Date, now: Date = new Date()): VehicleFreshness {
  const diffMs = now.getTime() - capturedAt.getTime();
  // Math.max(0, ...): una fecha de captura en el futuro (reloj mal puesto, dato corrupto)
  // nunca debe devolver días negativos — se trata como "capturado hoy" (0 días, 'green').
  const days = Math.max(0, Math.floor(diffMs / MS_POR_DIA));
  return { status: clasificarDias(days), days };
}

// FASE 2 (preparada, no conectada a UI todavía) — actividad del YONKE completo: mediana de
// antigüedad de sus vehículos activos. Un yonke con muchos vehículos viejos pero uno recién
// capturado no debe verse "reciente" por un solo dato atípico — por eso mediana, no promedio
// ni el más nuevo.
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
  return { status: clasificarDias(medianDays), medianDays };
}
