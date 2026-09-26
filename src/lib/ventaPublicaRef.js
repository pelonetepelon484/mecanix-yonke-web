import { doc } from 'firebase/firestore';
import { datosVentaPublica, idVentaPublica } from './ventasPublicas';

// Referencia + datos de ventasPublicas/{folio} para escribirlos en el MISMO batch/transacción que
// la venta en `ventas` (así nunca queda una venta calificable sin su copia pública, ni al revés).
// null si la venta no tiene folio o yonkeId usables (entonces solo se guarda en `ventas`).
export function ventaPublicaParaEscribir(db, ventaId, venta) {
  const id = idVentaPublica(venta?.numeroPedido);
  const datos = datosVentaPublica(ventaId, venta || {});
  if (!id || !datos) return null;
  return { ref: doc(db, 'ventasPublicas', id), datos };
}
