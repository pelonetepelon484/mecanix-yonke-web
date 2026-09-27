// Normalización del número de WhatsApp de un yonke (campo `whatsapp` del documento del yonke, con
// `telefono` como respaldo al registrarse) a formato internacional de México para wa.me:
// "52" + 10 dígitos. Es el mismo resultado que ya producía el código existente
// (`https://wa.me/52${numero.replace(/\D/g, '')}`) para números de 10 dígitos, pero además
// evita duplicar el 52 y devuelve null en vez de un enlace roto cuando el número no es válido.
export function normalizarWhatsapp(numero: unknown): string | null {
  if (typeof numero !== 'string') return null;
  const digitos = numero.replace(/\D/g, '');
  if (digitos.length === 10) return `52${digitos}`;
  if (digitos.length === 12 && digitos.startsWith('52')) return digitos;
  if (digitos.length === 13 && digitos.startsWith('521')) return `52${digitos.slice(3)}`; // formato móvil antiguo
  return null;
}

// null si el número no es válido (la interfaz muestra entonces la imagen sin enlace).
export function whatsappHref(numero: unknown, mensaje: string): string | null {
  const normalizado = normalizarWhatsapp(numero);
  return normalizado ? `https://wa.me/${normalizado}?text=${encodeURIComponent(mensaje)}` : null;
}
