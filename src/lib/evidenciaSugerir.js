// Evidencia de "Sugerir yonke": la autorización escrita del yonke que exigen los Términos (sección 6)
// y el Aviso de Privacidad (sección 7). Se conserva 30 días naturales desde el registro de la respuesta.
export const DIAS_EVIDENCIA = 30;
export const MAX_MENSAJE_EVIDENCIA = 2000;
export const MAX_MOTIVO_CONSERVACION = 500;

// Solo medios escritos: los textos legales piden conservar el mensaje recibido.
export const MEDIOS_AUTORIZACION = [
  { id: 'whatsapp', nombre: 'WhatsApp' },
  { id: 'sms', nombre: 'Mensaje de texto' },
  { id: 'correo', nombre: 'Correo electrónico' },
  { id: 'otro', nombre: 'Otro medio escrito' },
];

export const TEXTO_AUTORIZA_SUGERENCIA = 'Confirmo que el yonke me autorizó por escrito, antes de este registro, a registrar su respuesta y mostrarla en esta búsqueda.';

export const nombreMedio = (id) => MEDIOS_AUTORIZACION.find((m) => m.id === id)?.nombre || id;

export function calcularExpiraEvidencia(desde) {
  return new Date(desde.getTime() + DIAS_EVIDENCIA * 24 * 60 * 60 * 1000);
}

// Identifica la búsqueda aunque el pedido ya se haya borrado.
export function textoBusquedaEvidencia(pedido) {
  const v = pedido.vehiculo || {};
  const vehiculo = [v.marca, v.modelo, v.anio].filter(Boolean).join(' ');
  return [pedido.pieza, vehiculo].filter(Boolean).join(' · ').slice(0, 300);
}

// Devuelve la evidencia lista para guardar, o null si falta algo o la fecha es futura.
export function evidenciaCompleta({ medio, mensaje, recibido, autorizacionConfirmada }, ahora = new Date()) {
  const texto = (mensaje || '').trim();
  const recibidoAt = new Date(recibido || NaN);
  if (!MEDIOS_AUTORIZACION.some((m) => m.id === medio)) return null;
  if (texto === '' || texto.length > MAX_MENSAJE_EVIDENCIA) return null;
  if (Number.isNaN(recibidoAt.getTime()) || recibidoAt > ahora) return null;
  if (autorizacionConfirmada !== true) return null;
  return { medio, mensaje: texto, recibidoAt };
}
