// Validaciones y textos del registro de taller. Cuenta y registro separados de los yonkes:
// este módulo no sabe nada de yonkes.

export const MENSAJES_TALLER = {
  camposVacios: 'Llena todos los campos obligatorios.',
  nombre: 'Escribe el nombre de tu taller (mínimo 2 letras).',
  ciudad: 'Escribe la ciudad de tu taller.',
  whatsapp: 'Escribe tu WhatsApp a 10 dígitos, por ejemplo 6641234567.',
  correo: 'Escribe un correo electrónico válido.',
  password: 'La contraseña debe tener al menos 8 caracteres.',
  passwordNoCoincide: 'Las contraseñas no coinciden.',
  correoExiste: 'Este correo ya tiene una cuenta. Si tienes un yonke y quieres usar las herramientas de taller, registra el taller con otro correo.',
  errorGeneral: 'No pudimos crear tu cuenta de taller. Intenta de nuevo.',
  cuentaAMedias: 'Tu cuenta quedó a medias. Escríbenos para revisarla antes de volver a intentar: WhatsApp 661 103 4260 o contacto@mecanixyonkevirtual.com.',
  sinAccesoTaller: 'Esta cuenta no tiene acceso al panel de taller.',
  aceptacionLegal: 'Debes aceptar los Términos y Condiciones y el Aviso de Privacidad para registrarte.',
} as const;

// Quita espacios y guiones antes de validar (el formulario lo hace al guardar).
export function normalizarWhatsapp(valor: string): string {
  return valor.replace(/[\s-]/g, '');
}

export function validarWhatsappTaller(valor: string): { ok: true; valor: string } | { ok: false; mensaje: string } {
  const limpio = normalizarWhatsapp(valor);
  return /^[0-9]{10}$/.test(limpio) ? { ok: true, valor: limpio } : { ok: false, mensaje: MENSAJES_TALLER.whatsapp };
}

function largoEntre(texto: string, min: number, max: number): boolean {
  const n = texto.trim().length;
  return n >= min && n <= max;
}

export type DatosRegistroTaller = {
  nombre: string;
  whatsapp: string;
  ciudad: string;
  email: string;
  password: string;
  confirmarPassword: string;
};

// Devuelve el primer error en español, en el orden en que aparecen los campos del formulario.
export function validarRegistroTaller(d: DatosRegistroTaller):
  | { ok: true; datos: { nombre: string; whatsapp: string; ciudad: string; email: string; password: string } }
  | { ok: false; mensaje: string } {
  if (!d.nombre.trim() || !d.whatsapp.trim() || !d.ciudad.trim() || !d.email.trim() || !d.password || !d.confirmarPassword) {
    return { ok: false, mensaje: MENSAJES_TALLER.camposVacios };
  }
  if (!largoEntre(d.nombre, 2, 100)) return { ok: false, mensaje: MENSAJES_TALLER.nombre };
  const wa = validarWhatsappTaller(d.whatsapp);
  if (!wa.ok) return wa;
  if (!largoEntre(d.ciudad, 2, 100)) return { ok: false, mensaje: MENSAJES_TALLER.ciudad };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) return { ok: false, mensaje: MENSAJES_TALLER.correo };
  if (d.password.length < 8) return { ok: false, mensaje: MENSAJES_TALLER.password };
  if (d.password !== d.confirmarPassword) return { ok: false, mensaje: MENSAJES_TALLER.passwordNoCoincide };
  return {
    ok: true,
    datos: {
      nombre: d.nombre.trim(),
      whatsapp: wa.valor,
      ciudad: d.ciudad.trim(),
      email: d.email.trim(),
      password: d.password,
    },
  };
}
