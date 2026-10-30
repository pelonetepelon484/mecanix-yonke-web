// Respuestas de yonkes a pedidos de piezas (de talleres y de clientes): textos y formato del precio,
// en un solo lugar para todas las pantallas (admin, /mi-pedido y la del taller).
// "Sugerir yonke": el admin registra la respuesta de un yonke que le confirmó por fuera que tiene la
// pieza. Mecanix nunca publica un precio en esas respuestas: siempre "precio a tratar"
// (precioATratar: true, sin precio; lo exigen las reglas de Firestore).

// Textos visibles. Pendientes de revisión del abogado: cambiarlos solo aquí.
export const TEXTO_PRECIO_A_TRATAR = 'Precio a tratar';
export const TEXTO_CONFIRMADO_POR_MECANIX = 'Confirmado por Mecanix';
// Solo en el panel del admin.
export const TEXTO_SUGERIDA_POR_ADMIN = '🤝 Sugerida por admin';

// Precio que se puede mostrar: número finito mayor que 0. Cualquier otra cosa (sin precio, 0, null,
// texto, NaN) nunca se muestra como precio.
export function precioValido(precio) {
  return typeof precio === 'number' && Number.isFinite(precio) && precio > 0;
}

export function formatoPesos(precio) {
  return `$${precio.toLocaleString('es-MX', { maximumFractionDigits: 2 })}`;
}

// Lo que se muestra como precio de una respuesta que tiene la pieza: el precio, o "Precio a tratar"
// si es sugerida por el admin o si llegó sin un precio válido por cualquier motivo (nunca "$0" ni
// "$NaN"). '' si no la tiene.
export function textoPrecioRespuesta(r) {
  if (r?.tieneLaPieza !== true) return '';
  return precioValido(r.precio) ? formatoPesos(r.precio) : TEXTO_PRECIO_A_TRATAR;
}
