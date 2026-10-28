// Cuenta de refaccionaria (etapa 1): validación del registro, slug, lectura de config/refaccionarias
// y textos. Lógica pura, sin Firebase (se prueba sin conexión).
import { normalizarWhatsapp } from './taller';

// ⚠️ TEXTOS PROVISIONALES: todavía no hay Términos ni Aviso de Privacidad de refaccionarias. Antes
// de encender config/refaccionarias.habilitado hay que reemplazarlos por los aprobados por el
// abogado (y apuntar URL_TERMINOS_REFACCIONARIAS / URL_PRIVACIDAD_REFACCIONARIAS a sus secciones).
export const TEXTOS_PROVISIONALES = {
  aceptacionRegistro: '[PROVISIONAL] He leído y acepto los Términos y Condiciones y el Aviso de Privacidad para refaccionarias.',
  resumenCambiosRespaldo: '[PROVISIONAL] Revisa los Términos y Condiciones y el Aviso de Privacidad para refaccionarias.',
  tituloAvisoVersion: '[PROVISIONAL] Cambiaron los Términos y el Aviso de Privacidad para refaccionarias',
  soloLectura: '[PROVISIONAL] Mientras no aceptes, solo puedes ver tu información.',
  proximamenteInventario: 'Próximamente: carga de inventario.',
  proximamenteInventarioDetalle: '[PROVISIONAL] Muy pronto podrás subir tu catálogo de piezas nuevas desde un archivo CSV o Excel y aparecer en el buscador de Mecanix.',
  registroCerrado: '[PROVISIONAL] Todavía no estamos recibiendo refaccionarias. Gracias por tu interés.',
} as const;
// Hasta que existan las secciones legales de refaccionarias, apuntan a los documentos generales.
export const URL_TERMINOS_REFACCIONARIAS = 'https://mecanixyonkevirtual.com/terminos';
export const URL_PRIVACIDAD_REFACCIONARIAS = 'https://mecanixyonkevirtual.com/privacidad';

export const MENSAJES_REFACCIONARIA = {
  camposVacios: 'Llena todos los campos obligatorios.',
  nombre: 'Escribe el nombre de tu refaccionaria (mínimo 2 letras).',
  estado: 'Elige el estado de tu refaccionaria.',
  ciudad: 'Escribe la ciudad de tu refaccionaria.',
  whatsapp: 'Escribe tu WhatsApp a 10 dígitos, por ejemplo 6641234567.',
  zonaEntrega: 'La zona de entrega admite hasta 300 caracteres y 30 municipios.',
  correo: 'Escribe un correo electrónico válido.',
  password: 'La contraseña debe tener al menos 8 caracteres.',
  passwordNoCoincide: 'Las contraseñas no coinciden.',
  correoExiste: 'Este correo ya tiene una cuenta. Registra la refaccionaria con otro correo.',
  errorGeneral: 'No pudimos crear tu cuenta de refaccionaria. Intenta de nuevo.',
  cuentaAMedias: 'Tu cuenta quedó a medias. Escríbenos para revisarla antes de volver a intentar: WhatsApp 661 103 4260 o contacto@mecanixyonkevirtual.com.',
  aceptacionLegal: 'Debes aceptar los Términos y Condiciones y el Aviso de Privacidad para registrarte.',
} as const;

export const MAX_MUNICIPIOS_ZONA = 30;
export const MAX_DESCRIPCION_ZONA = 300;

export type DatosRegistroRefaccionaria = {
  nombre: string; whatsapp: string; estado: string; ciudad: string;
  zonaDescripcion: string; zonaMunicipios: string;
  email: string; password: string; confirmarPassword: string;
};
export type ZonaEntrega = { descripcion: string; municipios: string[] };

const largoEntre = (v: string, min: number, max: number) => v.trim().length >= min && v.trim().length <= max;

// Municipios separados por coma o salto de línea, sin repetidos ni vacíos.
export function municipiosDeTexto(texto: string): string[] {
  const lista = String(texto ?? '').split(/[,\n]/).map((m) => m.trim()).filter(Boolean);
  return [...new Set(lista)];
}

// Zona de entrega local (opcional): sin descripción ni municipios, no se guarda.
export function zonaEntregaDe(descripcion: string, municipiosTexto: string): ZonaEntrega | null {
  const d = String(descripcion ?? '').trim();
  const municipios = municipiosDeTexto(municipiosTexto);
  if (!d && municipios.length === 0) return null;
  return { descripcion: d, municipios };
}

export function validarRegistroRefaccionaria(d: DatosRegistroRefaccionaria, idsEstados: string[]):
  | { ok: true; datos: { nombre: string; whatsapp: string; estado: string; ciudad: string; zonaEntrega: ZonaEntrega | null; email: string; password: string } }
  | { ok: false; mensaje: string } {
  if (!d.nombre.trim() || !d.whatsapp.trim() || !d.estado || !d.ciudad.trim() || !d.email.trim() || !d.password || !d.confirmarPassword) {
    return { ok: false, mensaje: MENSAJES_REFACCIONARIA.camposVacios };
  }
  if (!largoEntre(d.nombre, 2, 100)) return { ok: false, mensaje: MENSAJES_REFACCIONARIA.nombre };
  const whatsapp = normalizarWhatsapp(d.whatsapp);
  if (!/^[0-9]{10}$/.test(whatsapp)) return { ok: false, mensaje: MENSAJES_REFACCIONARIA.whatsapp };
  if (!idsEstados.includes(d.estado)) return { ok: false, mensaje: MENSAJES_REFACCIONARIA.estado };
  if (!largoEntre(d.ciudad, 2, 100)) return { ok: false, mensaje: MENSAJES_REFACCIONARIA.ciudad };
  const zonaEntrega = zonaEntregaDe(d.zonaDescripcion, d.zonaMunicipios);
  if (zonaEntrega && (zonaEntrega.descripcion.length > MAX_DESCRIPCION_ZONA || zonaEntrega.municipios.length > MAX_MUNICIPIOS_ZONA)) {
    return { ok: false, mensaje: MENSAJES_REFACCIONARIA.zonaEntrega };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) return { ok: false, mensaje: MENSAJES_REFACCIONARIA.correo };
  if (d.password.length < 8) return { ok: false, mensaje: MENSAJES_REFACCIONARIA.password };
  if (d.password !== d.confirmarPassword) return { ok: false, mensaje: MENSAJES_REFACCIONARIA.passwordNoCoincide };
  return {
    ok: true,
    datos: { nombre: d.nombre.trim(), whatsapp, estado: d.estado, ciudad: d.ciudad.trim(), zonaEntrega, email: d.email.trim(), password: d.password },
  };
}

// Slug de la página pública (etapa 3): nombre en minúsculas sin acentos + 6 caracteres del id, para
// que sea único sin consultar a nadie. Formato que exigen las reglas: ^[a-z0-9]+(-[a-z0-9]+)*$.
export function generarSlug(nombre: string, id: string): string {
  const base = String(nombre ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
  const sufijo = String(id ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6) || 'r';
  return base ? `${base}-${sufijo}` : `refaccionaria-${sufijo}`;
}

// config/refaccionarias: bandera, versión de los términos y sus cambios, y los topes y vigencias del
// inventario (se usan en las etapas siguientes). Nada fijo en el código: lo que falte queda en null.
export type TopesRefaccionarias = { basico: number | null; premium: number | null };
export type VigenciaRefaccionarias = { precioPorConfirmarDias: number | null; ocultarBuscadorDias: number | null; ocultarPaginaDias: number | null };
export type ConfigRefaccionarias = {
  habilitado: boolean; terminosVersion: string; resumenCambios: string;
  topes: TopesRefaccionarias; vigencia: VigenciaRefaccionarias;
};
const enteroPositivo = (v: unknown) => (Number.isInteger(v) && (v as number) > 0 ? (v as number) : null);
export function leerConfigRefaccionariasDe(datos: Record<string, unknown> | null | undefined): ConfigRefaccionarias {
  const c = datos ?? {};
  const topes = (c.topes ?? {}) as Record<string, unknown>;
  const vigencia = (c.vigencia ?? {}) as Record<string, unknown>;
  return {
    habilitado: c.habilitado === true,
    terminosVersion: typeof c.terminosVersion === 'string' ? c.terminosVersion : '',
    resumenCambios: typeof c.resumenCambios === 'string' ? c.resumenCambios : '',
    topes: { basico: enteroPositivo(topes.basico), premium: enteroPositivo(topes.premium) },
    vigencia: {
      precioPorConfirmarDias: enteroPositivo(vigencia.precioPorConfirmarDias),
      ocultarBuscadorDias: enteroPositivo(vigencia.ocultarBuscadorDias),
      ocultarPaginaDias: enteroPositivo(vigencia.ocultarPaginaDias),
    },
  };
}

// ¿Ya aceptó la versión vigente? Sin versión vigente en config, no se exige.
export function refaccionariaAceptoTerminos(refaccionaria: { aceptacionVersion?: unknown } | null | undefined, config: ConfigRefaccionarias): boolean {
  if (!config.terminosVersion) return true;
  return refaccionaria?.aceptacionVersion === config.terminosVersion;
}
