import FreshnessBadge from './FreshnessBadge';
import { getVehicleFreshness } from '../../lib/inventoryStatus';

// Envuelve FreshnessBadge + el cálculo desde `fechaIngreso` (Timestamp de Firestore, o Date en
// documentos ya convertidos) en un solo lugar — vive en src/app/lib/ (no en panel/ ni en admin/)
// justo porque panel/inventario/page.js y admin/yonke/[id]/inventario/page.js (mismo panel, dos
// vistas) ya comparten sus selectores desde aquí, y el semáforo se había desincronizado una vez
// entre los dos por vivir solo en uno. Vehículos sin fechaIngreso (documentos muy viejos) no
// muestran nada.
export default function VehicleFreshnessBadge({ vehiculo }) {
  const fechaIngreso = vehiculo?.fechaIngreso;
  if (!fechaIngreso) return null;
  const capturedAt = fechaIngreso.toDate ? fechaIngreso.toDate() : new Date(fechaIngreso);
  const { status, days } = getVehicleFreshness(capturedAt);
  return <FreshnessBadge status={status} days={days} />;
}
