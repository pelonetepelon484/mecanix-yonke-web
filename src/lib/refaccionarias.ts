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
// Sin plan Básico: un solo tope de piezas para todas (prueba y pago).
export type TopesRefaccionarias = { piezas: number | null };
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
    topes: { piezas: enteroPositivo(topes.piezas) },
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

// Estado de la cuenta (sin plan Básico): el admin inicia la prueba (pruebaHasta) al activarla y,
// al terminar, asigna el pago (premiumHasta). Vencida = prueba o pago ya terminados; sus datos se
// conservan DIAS_CONSERVAR_VENCIDA días y después queda marcada "para borrado" (solo la marca).
export const MESES_PRUEBA = 3;
export const DIAS_CONSERVAR_VENCIDA = 90;
export type EstadoCuentaRefaccionaria = 'prueba-vigente' | 'pago-vigente' | 'vencida' | 'sin-activar';
export type ResumenCuentaRefaccionaria = {
  estado: EstadoCuentaRefaccionaria;
  // Vigente: días hasta que termine. Vencida: días que faltan para la marca "para borrado" (0 si ya).
  diasRestantes: number | null;
  venceEl: Date | null; // fin de la prueba o del pago (en vencida, el más reciente)
  paraBorrado: boolean;
};

const DIA_MS = 24 * 60 * 60 * 1000;
function fechaDe(valor: unknown): Date | null {
  const v = valor as { toDate?: () => Date } | Date | string | number | null | undefined;
  const fecha = v && typeof v === 'object' && 'toDate' in v && typeof v.toDate === 'function' ? v.toDate() : v ? new Date(v as Date) : null;
  return fecha && !Number.isNaN(fecha.getTime()) ? fecha : null;
}
const diasHasta = (fin: Date, ahora: Date) => Math.ceil((fin.getTime() - ahora.getTime()) / DIA_MS);

export function estadoCuentaRefaccionaria(
  r: { pruebaHasta?: unknown; premiumHasta?: unknown } | null | undefined,
  ahora: Date = new Date(),
): ResumenCuentaRefaccionaria {
  const pago = fechaDe(r?.premiumHasta);
  const prueba = fechaDe(r?.pruebaHasta);
  if (pago && pago > ahora) return { estado: 'pago-vigente', diasRestantes: diasHasta(pago, ahora), venceEl: pago, paraBorrado: false };
  if (prueba && prueba > ahora) return { estado: 'prueba-vigente', diasRestantes: diasHasta(prueba, ahora), venceEl: prueba, paraBorrado: false };
  const fin = [pago, prueba].filter((f): f is Date => f !== null).sort((a, b) => b.getTime() - a.getTime())[0];
  if (!fin) return { estado: 'sin-activar', diasRestantes: null, venceEl: null, paraBorrado: false };
  const diasParaBorrado = Math.max(0, diasHasta(new Date(fin.getTime() + DIAS_CONSERVAR_VENCIDA * DIA_MS), ahora));
  return { estado: 'vencida', diasRestantes: diasParaBorrado, venceEl: fin, paraBorrado: diasParaBorrado === 0 };
}

// Fin de la prueba si el admin la inicia hoy: MESES_PRUEBA meses después (como "AAAA-MM-DD").
export function finPruebaDesde(ahora: Date = new Date()): string {
  const fin = new Date(ahora.getFullYear(), ahora.getMonth() + MESES_PRUEBA, ahora.getDate());
  // Si el mes de destino es más corto (31 de noviembre → 1 de diciembre), queda en su último día.
  if (fin.getDate() !== ahora.getDate()) fin.setDate(0);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${fin.getFullYear()}-${p(fin.getMonth() + 1)}-${p(fin.getDate())}`;
}

// Texto corto para la pantalla del admin.
export function textoEstadoCuenta(e: ResumenCuentaRefaccionaria): string {
  const dias = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`;
  if (e.estado === 'prueba-vigente') return `🧪 Prueba vigente · quedan ${dias(e.diasRestantes ?? 0)}`;
  if (e.estado === 'pago-vigente') return `⭐ Pago vigente · quedan ${dias(e.diasRestantes ?? 0)}`;
  if (e.estado === 'sin-activar') return '⏸️ Sin activar';
  if (e.paraBorrado) return `🗑️ Vencida · para borrado (más de ${DIAS_CONSERVAR_VENCIDA} días)`;
  return `⚠️ Vencida · se conservan sus datos ${dias(e.diasRestantes ?? 0)} más`;
}
