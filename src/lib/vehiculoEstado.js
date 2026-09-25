import { doc, updateDoc, deleteDoc, deleteField, serverTimestamp } from 'firebase/firestore';

// Compartido por panel/inventario/page.js (el yonke) y admin/yonke/[id]/inventario/page.js
// (el mismo panel para el admin) — un solo lugar para no duplicar esta lógica entre los dos.
//
// Reemplaza el borrado directo por venta: antes, vender algo borraba el documento del vehículo
// por completo (yonkes/{yonkeId}/vehiculos/{vehiculoId}). Ahora se marca `disponible: false` +
// `vendidoAt` (nunca se toca `fechaIngreso`, lo usa el semáforo de frescura en
// src/lib/inventoryStatus.ts) y el documento se conserva para poder reactivarlo. El borrado real
// (`eliminarVehiculoPorError`) queda como acción secundaria, solo para errores de captura —
// quien llama a esto es responsable de pedir confirmación antes (ver confirm() en cada página).
export const MOTIVOS_BAJA = [
  { value: 'vendido', label: 'Vendido' },
  { value: 'desarmado', label: 'Desarmado' },
  { value: 'otro', label: 'Otro' },
];

// "Sacar del inventario" — botón principal para retirar un vehículo sin borrarlo. motivoBaja es
// opcional (el selector en la UI lo pide, pero la función no lo exige por si se llama desde otro
// lado sin ese contexto).
export async function sacarDelInventario(db, yonkeId, vehiculoId, motivoBaja = null) {
  const ref = doc(db, 'yonkes', yonkeId, 'vehiculos', vehiculoId);
  await updateDoc(ref, {
    disponible: false,
    vendidoAt: serverTimestamp(),
    motivoBaja: motivoBaja || null,
  });
}

// Reactivar: limpia vendidoAt/motivoBaja (deleteField) — si no se limpiaran, un vehículo
// reactivado y vuelto a sacar del inventario después arrastraría una fecha/motivo viejo confuso.
export async function reactivarVehiculo(db, yonkeId, vehiculoId) {
  const ref = doc(db, 'yonkes', yonkeId, 'vehiculos', vehiculoId);
  await updateDoc(ref, {
    disponible: true,
    vendidoAt: deleteField(),
    motivoBaja: deleteField(),
  });
}

// Borrado real y permanente — solo para errores de captura (vehículo duplicado, datos mal
// cargados). El caller debe confirmar con el usuario ANTES de invocar esto.
export async function eliminarVehiculoPorError(db, yonkeId, vehiculoId) {
  const ref = doc(db, 'yonkes', yonkeId, 'vehiculos', vehiculoId);
  await deleteDoc(ref);
}
