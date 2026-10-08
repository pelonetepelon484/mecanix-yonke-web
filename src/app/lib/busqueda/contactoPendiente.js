// Contacto que deja un cliente en una búsqueda sin resultado útil (busquedas_pendientes + aviso
// al WhatsApp del admin). Antes vivía dentro de api/buscar/route.js; se movió aquí sin cambiar su
// comportamiento para poder probarlo. Con el pedido de piezas de clientes encendido
// (config/pedidosClientes), ese contacto ya no se guarda ni se avisa: el cliente usa "Avisar a
// los yonkes". Apagado, todo funciona exactamente igual que antes.

export const MENSAJE_SIN_INVENTARIO =
  'No tenemos esa pieza en inventario ahorita, pero te avisamos en cuanto algún yonke la registre.';
export const MENSAJE_VEHICULO_SIN_INVENTARIO =
  'No tenemos ese vehículo en inventario ahorita, pero te avisamos en cuanto algún yonke lo registre.';
// Con el pedido de clientes encendido ya no se promete avisar: debajo aparece "Avisar a los yonkes".
export const MENSAJE_SIN_INVENTARIO_PEDIDOS = 'No tenemos esa pieza en inventario ahorita.';
export const MENSAJE_VEHICULO_SIN_INVENTARIO_PEDIDOS = 'No tenemos ese vehículo en inventario ahorita.';

export function mensajeSinInventario({ vehiculo = false, pedidosClientesActivos = false } = {}) {
  if (vehiculo) return pedidosClientesActivos ? MENSAJE_VEHICULO_SIN_INVENTARIO_PEDIDOS : MENSAJE_VEHICULO_SIN_INVENTARIO;
  return pedidosClientesActivos ? MENSAJE_SIN_INVENTARIO_PEDIDOS : MENSAJE_SIN_INVENTARIO;
}

// Aviso al WhatsApp del admin cuando un cliente deja su contacto en una búsqueda que no dio
// nada útil — cierra el ciclo de busquedas_pendientes (antes solo se guardaba, nadie se
// enteraba). Solo se llama cuando contacto existe; notificarAdmin ya traga sus propios errores.
// Cae de vuelta al texto original si no se extrajo nada estructurado (ej. no_interpretada
// puro), para que el admin nunca reciba un aviso vacío sin poder saber qué buscaba el cliente.
export function mensajeContactoPendiente({ texto, pieza, marca, modelo, anio, estado, contacto }) {
  const vehiculo = [marca, modelo, anio].filter(Boolean).join(' ');
  const detalle = [pieza, vehiculo].filter(Boolean).join(' ') || texto || '(sin detalle)';
  return `🔔 Búsqueda pendiente en Mecanix\n\nBuscaban: ${detalle}\nEstado: ${estado}\nContacto del cliente: ${contacto}\n\nRevisa el panel para dar seguimiento.`;
}

// Único punto de escritura a busquedas_pendientes + aviso al admin. Se llama en TODO camino
// de retorno "sin resultado útil" que tenga contacto (sin_inventario, fuera_de_catalogo,
// no_interpretada, parseo_parcial, fuera_de_giro). No hace nada si no hay contacto (nunca
// escribe un doc vacío ni dispara un aviso de más), ni con el pedido de clientes encendido.
// guardar = guardarSinBloquear de route.js; notificar = notificarAdmin.
export function crearPersistirContacto({ guardar, notificar, pedidosClientesActivos, ahora = () => new Date() }) {
  return async function persistirContactoSiExiste(contacto, { texto, pieza = null, marca = null, modelo = null, anio = null, estado }) {
    if (!contacto) return;
    if (await pedidosClientesActivos()) return;
    await guardar('busquedas_pendientes', {
      pieza, marca, modelo, anio,
      textoOriginal: texto,
      estado,
      fecha: ahora(),
      contacto,
      atendido: false,
    });
    await notificar(mensajeContactoPendiente({ texto, pieza, marca, modelo, anio, estado, contacto }));
  };
}
