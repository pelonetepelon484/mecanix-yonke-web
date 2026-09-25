import FreshnessBadge from './FreshnessBadge';
import { getItemFreshnessOrNull } from '../../lib/inventoryStatus';

// Semáforo de frescura genérico para cualquier categoría de inventario (vehiculos, motores,
// transmisiones, piezasSueltas) — todas guardan fecha de captura en `fechaIngreso` y
// disponibilidad en `disponible` con el mismo criterio (auditoría 2026-09-24, ver comentario en
// src/lib/inventoryStatus.ts), así que un solo componente les sirve a las 4 sin duplicar nada.
// Reemplaza a VehicleFreshnessBadge.js (que solo cubría vehículos) — usar este en su lugar.
//
// No muestra nada si el ítem no tiene fecha de captura, o si disponible === false (ambos casos
// resueltos en getItemFreshnessOrNull, no aquí, para que la regla viva en un solo lugar puro y
// testeable).
export default function ItemFreshnessBadge({ item, categoria }) {
  const fechaIngreso = item?.fechaIngreso;
  const capturedAt = fechaIngreso ? (fechaIngreso.toDate ? fechaIngreso.toDate() : new Date(fechaIngreso)) : null;
  const resultado = getItemFreshnessOrNull(categoria, capturedAt, item?.disponible);
  if (!resultado) return null;
  return <FreshnessBadge status={resultado.status} days={resultado.days} />;
}
