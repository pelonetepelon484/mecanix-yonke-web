// ventasPublicas/{numeroPedido}: copia MÍNIMA y NO personal de una venta, para que la página
// pública /calificar (sin login) pueda encontrar el pedido por su folio sin necesitar leer
// `ventas`, que contiene datos personales (nombreCliente, telefono, monto…) y pasa a ser privada
// del yonke dueño y el admin. Nunca copiar aquí nombreCliente, telefonoCliente ni monto.

export interface VentaPublica {
  ventaId: string; // id real del documento en `ventas` (calificaciones.ventaId apunta a este)
  yonkeId: string;
  piezaVendida: string | null;
  vehiculo: { marca: string | null; modelo: string | null; ano: number | string | null } | null;
}

// El folio es el ID del documento. Se normaliza igual que lo hace /calificar al buscar
// (trim + mayúsculas). null si no hay folio usable (sin folio no se puede publicar la venta).
export function idVentaPublica(numeroPedido: unknown): string | null {
  if (typeof numeroPedido !== 'string') return null;
  const id = numeroPedido.trim().toUpperCase().replace(/\//g, '-');
  return id || null;
}

export function datosVentaPublica(ventaId: string, venta: Record<string, unknown>): VentaPublica | null {
  if (!ventaId || typeof venta.yonkeId !== 'string' || !venta.yonkeId) return null;
  const v = venta.vehiculo as { marca?: unknown; modelo?: unknown; ano?: unknown } | null | undefined;
  return {
    ventaId,
    yonkeId: venta.yonkeId,
    piezaVendida: typeof venta.piezaVendida === 'string' ? venta.piezaVendida : null,
    vehiculo: v && typeof v === 'object'
      ? {
          marca: typeof v.marca === 'string' ? v.marca : null,
          modelo: typeof v.modelo === 'string' ? v.modelo : null,
          ano: typeof v.ano === 'number' || typeof v.ano === 'string' ? v.ano : null,
        }
      : null,
  };
}
