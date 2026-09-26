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
// fija), para no romper ningún import existente.
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

// FASE 2 — ACTIVIDAD del yonke (no del inventario): qué tan reciente fue la última vez que el
// DUEÑO usó la plataforma. Reemplaza al enfoque anterior de mediana de antigüedad de vehículos
// (getYonkeActivity, eliminado). Vive en yonkes/{id}.ultimaActividadAt (Timestamp): se escribe
// cuando el dueño abre el panel (máx. una vez cada YONKE_ACTIVIDAD_REFRESCO_HORAS) y al registrar
// una venta; nunca desde admin. Es independiente de fechaIngreso y de los semáforos por ítem.
export const YONKE_ACTIVIDAD_THRESHOLDS = { greenMaxDays: 30, yellowMaxDays: 90 };
export const YONKE_ACTIVIDAD_REFRESCO_HORAS = 12;

// Convierte a milisegundos cualquier representación razonable de una fecha: Timestamp de
// Firestore (toMillis/toDate), Date, número (ms) o {seconds} ya serializado. null si no hay fecha
// o es inválida. Los Timestamp no cruzan de servidor a componentes cliente: se serializan a ms.
export function toMillis(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;
  let ms: number;
  if (typeof valor === 'number') {
    ms = valor;
  } else if (valor instanceof Date) {
    ms = valor.getTime();
  } else if (typeof valor === 'object') {
    const v = valor as { toMillis?: () => number; toDate?: () => Date; seconds?: number; nanoseconds?: number };
    if (typeof v.toMillis === 'function') ms = v.toMillis();
    else if (typeof v.toDate === 'function') ms = v.toDate().getTime();
    else if (typeof v.seconds === 'number') ms = v.seconds * 1000 + Math.floor((v.nanoseconds ?? 0) / 1e6);
    else return null;
  } else {
    return null;
  }
  return Number.isFinite(ms) ? ms : null;
}

// null si no hay fecha o es inválida. Fecha futura (reloj desfasado, dato corrupto) = 'green'.
// Límites INCLUSIVOS sobre días completos transcurridos (mismo criterio que getItemFreshness):
// día 30 todavía 'green', día 90 todavía 'yellow'.
export function getYonkeActividad(
  ultimaActividadAt: Date | number | null | undefined,
  now: Date | number = new Date(),
): FreshnessStatus | null {
  const actividad = toMillis(ultimaActividadAt);
  const ahora = toMillis(now);
  if (actividad === null || ahora === null) return null;
  const dias = Math.max(0, Math.floor((ahora - actividad) / MS_POR_DIA));
  if (dias <= YONKE_ACTIVIDAD_THRESHOLDS.greenMaxDays) return 'green';
  if (dias <= YONKE_ACTIVIDAD_THRESHOLDS.yellowMaxDays) return 'yellow';
  return 'red';
}

// ¿Toca escribir ultimaActividadAt al abrir el panel? Sí si nunca se escribió (o es inválido), o
// si pasaron MÁS de YONKE_ACTIVIDAD_REFRESCO_HORAS desde el valor actual. Una fecha futura (dato
// corrupto) no dispara escritura. Evita una escritura por cada apertura del panel.
export function debeRegistrarActividad(ultimaActividadAt: unknown, now: Date | number = new Date()): boolean {
  const actual = toMillis(ultimaActividadAt);
  const ahora = toMillis(now);
  if (ahora === null) return false;
  if (actual === null) return true;
  return ahora - actual > YONKE_ACTIVIDAD_REFRESCO_HORAS * 60 * 60 * 1000;
}
