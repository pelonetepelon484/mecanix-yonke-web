// Respuestas de yonkes a pedidos de piezas (de talleres y de clientes): textos y formato del precio,
// en un solo lugar para todas las pantallas (admin, /mi-pedido y la del taller).
// "Sugerir yonke": el admin registra la respuesta de un yonke que le confirmó por fuera que tiene la
// pieza. Mecanix nunca publica un precio en esas respuestas: siempre "precio a tratar"
// (el campo precioATratar: true, sin precio; lo exigen las reglas de Firestore; en pantalla se lee
// "Precio no informado").

// Textos visibles, redactados con el abogado (rev5 de Términos y Aviso): cambiarlos solo aquí.
export const TEXTO_PRECIO_NO_INFORMADO = 'Precio no informado';
export const TEXTO_EXPLICA_PRECIO = 'Solicita directamente al yonke el precio final de la pieza, incluyendo los costos de envío y cualquier cargo adicional, antes de realizar el pago.';
export const TEXTO_CONFIRMACION_REGISTRADA = 'Confirmación del yonke registrada por Mecanix';
export const TEXTO_EXPLICA_CONFIRMACION = 'Mecanix registró la confirmación que el yonke comunicó para esta búsqueda. Mecanix no inspeccionó físicamente la pieza ni garantiza su disponibilidad posterior, condición o compatibilidad.';
// Advertencia de pago: arriba de las respuestas en /mi-pedido y, en una sola frase, en /bienvenida.
export const AVISO_PAGO_TITULO = 'Antes de pagar, confirma directamente con el yonke:';
export const AVISO_PAGO_PUNTOS = [
  'Que la pieza siga disponible.',
  'Su estado y compatibilidad.',
  'El precio total y el costo de envío.',
  'Las condiciones de garantía y entrega.',
];
export const AVISO_PAGO_ADELANTADO = 'Evita realizar pagos por adelantado si no has verificado al vendedor.';
export const AVISO_PAGO_MECANIX = 'Mecanix facilita el contacto entre clientes y yonkes. No es el vendedor, no recibe ni procesa los pagos y no inspecciona físicamente las piezas.';
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

// Lo que se muestra como precio de una respuesta que tiene la pieza: el precio, o "Precio no informado"
// si es sugerida por el admin o si llegó sin un precio válido por cualquier motivo (nunca "$0" ni
// "$NaN"). '' si no la tiene.
export function textoPrecioRespuesta(r) {
  if (r?.tieneLaPieza !== true) return '';
  return precioValido(r.precio) ? formatoPesos(r.precio) : TEXTO_PRECIO_NO_INFORMADO;
}
