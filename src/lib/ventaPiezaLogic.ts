// Lógica pura del flujo "vender una pieza del inventario" — sin Firestore, sin React, para
// poder probarla con datos sintéticos. Quien la usa (venta-manual/page.js) es responsable de
// leer/escribir Firestore (idealmente dentro de un runTransaction) y de mostrar los mensajes de
// error que aquí se devuelven.
//
// Auditoría 2026-09-24: yonkes/{id}/vehiculos/{id}/piezas hoy solo tiene { nombre, disponible }
// — NINGÚN documento real tiene `cantidad`. Se soporta ese campo de todas formas (opcional) para
// no tener que volver a tocar esta lógica si se agrega después; mientras no exista, vender una
// pieza es simplemente disponible:false (cantidad implícita de 1).

export const PIEZA_CUSTOM_MAX_LEN = 100;

export type PartSource = 'inventory' | 'custom';

export interface PiezaInventario {
  nombre: string;
  disponible?: boolean;
  cantidad?: number;
}

export interface PiezaInventarioConId extends PiezaInventario {
  id: string;
}

// Piezas que deben ofrecerse en el selector — excluye ya vendidas (disponible===false) y, si el
// documento maneja cantidad, las que ya llegaron a 0 (aunque `disponible` todavía no se haya
// marcado false por algún motivo).
export function piezasDisponibles(piezas: PiezaInventarioConId[]): PiezaInventarioConId[] {
  return piezas.filter((p) => {
    if (p.disponible === false) return false;
    if (typeof p.cantidad === 'number' && p.cantidad <= 0) return false;
    return true;
  });
}

export interface VentaPiezaExito {
  ok: true;
  // Campos a escribir en el doc de la pieza dentro de la transacción (update parcial).
  piezaUpdate: Partial<Pick<PiezaInventario, 'disponible' | 'cantidad'>>;
  // Campos a agregar al documento de venta.
  ventaExtra: { partSource: PartSource; piezaId?: string; piezaVendida: string };
}

export interface VentaPiezaError {
  ok: false;
  // Mensaje claro para mostrar al usuario y abortar la transacción (throw new Error(error)).
  error: string;
}

export type VentaPiezaResultado = VentaPiezaExito | VentaPiezaError;

// Se llama DENTRO de la transacción, con la pieza tal como se releyó en ese instante (no con el
// estado que el formulario tenía cargado antes) — así detecta si alguien más la vendió mientras
// el usuario llenaba el formulario.
export function resolverVentaDeInventario(
  pieza: PiezaInventario | null,
  piezaId: string,
): VentaPiezaResultado {
  if (!pieza) {
    return { ok: false, error: 'Esta pieza ya no existe en el inventario del vehículo — puede que se haya eliminado. Elige otra.' };
  }
  if (pieza.disponible === false) {
    return { ok: false, error: `"${pieza.nombre}" ya se vendió — alguien más registró esa venta primero. Elige otra pieza.` };
  }
  if (typeof pieza.cantidad === 'number') {
    if (pieza.cantidad <= 0) {
      return { ok: false, error: `"${pieza.nombre}" ya no tiene existencias disponibles. Elige otra pieza.` };
    }
    const restante = pieza.cantidad - 1;
    return {
      ok: true,
      piezaUpdate: restante <= 0 ? { cantidad: 0, disponible: false } : { cantidad: restante },
      ventaExtra: { partSource: 'inventory', piezaId, piezaVendida: pieza.nombre },
    };
  }
  // Sin campo cantidad (caso real hoy): una sola unidad, se desactiva directo.
  return {
    ok: true,
    piezaUpdate: { disponible: false },
    ventaExtra: { partSource: 'inventory', piezaId, piezaVendida: pieza.nombre },
  };
}

// "Otra..." — texto libre, nunca toca el inventario.
export function resolverVentaCustom(textoLibre: string): VentaPiezaResultado {
  const nombre = (textoLibre || '').trim().slice(0, PIEZA_CUSTOM_MAX_LEN);
  if (!nombre) {
    return { ok: false, error: 'Escribe el nombre de la pieza que vendiste' };
  }
  return { ok: true, piezaUpdate: {}, ventaExtra: { partSource: 'custom', piezaVendida: nombre } };
}
