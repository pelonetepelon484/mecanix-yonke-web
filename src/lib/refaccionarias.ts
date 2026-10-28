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
  // Página pública (etapa 3)
  avisoPrecios: '[PROVISIONAL] Precios y existencias sujetos a confirmación con la refaccionaria. Mecanix no vende piezas: el trato es directo con el negocio.',
  noDisponible: '[PROVISIONAL] Esta refaccionaria no está disponible por ahora en Mecanix.',
  // Buscador "Piezas nuevas" (etapa 4)
  introPiezasNuevas: '[PROVISIONAL] Busca piezas nuevas por número de parte o descripción entre las refaccionarias de Mecanix y contacta directo a la refaccionaria.',
  ordenResultados: '[PROVISIONAL] Orden: primero las piezas que mejor coinciden con tu búsqueda (número de parte exacto, luego que empieza o que contiene lo que escribiste) y, si coinciden igual, el precio más bajo.',
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
  // habilitado abre el registro; paginaPublica muestra /refaccionarias/[slug]; buscador muestra
  // "Piezas nuevas" en la portada (banderas aparte).
  habilitado: boolean; paginaPublica: boolean; buscador: boolean; terminosVersion: string; resumenCambios: string;
  topes: TopesRefaccionarias; vigencia: VigenciaRefaccionarias;
};
const enteroPositivo = (v: unknown) => (Number.isInteger(v) && (v as number) > 0 ? (v as number) : null);
export function leerConfigRefaccionariasDe(datos: Record<string, unknown> | null | undefined): ConfigRefaccionarias {
  const c = datos ?? {};
  const topes = (c.topes ?? {}) as Record<string, unknown>;
  const vigencia = (c.vigencia ?? {}) as Record<string, unknown>;
  return {
    habilitado: c.habilitado === true,
    paginaPublica: c.paginaPublica === true,
    // El buscador enlaza a la página pública: sin ella no se enciende.
    buscador: c.buscador === true && c.paginaPublica === true,
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

// ---------- Página pública (etapa 3) ----------

// Solo se muestra activa y con prueba o pago vigente; vencida, inactiva o sin activar: "no disponible".
export function refaccionariaVisible(r: { activo?: unknown; pruebaHasta?: unknown; premiumHasta?: unknown } | null | undefined, ahora: Date = new Date()): boolean {
  if (!r || r.activo !== true) return false;
  const { estado } = estadoCuentaRefaccionaria(r, ahora);
  return estado === 'prueba-vigente' || estado === 'pago-vigente';
}

// Inventario por bloques: refaccionarias/{id}/bloques/{n} con hasta PIEZAS_POR_BLOQUE piezas en
// `piezas`, numerados desde 0 y llenos salvo el último (la carga de la etapa 2 los arma así). Como
// PIEZAS_POR_PAGINA divide exacto a PIEZAS_POR_BLOQUE, cada página sale de UN solo bloque: 1 lectura.
export const PIEZAS_POR_BLOQUE = 1000;
export const PIEZAS_POR_PAGINA = 50;

export function totalPaginas(totalPiezas: unknown): number {
  const n = Number.isInteger(totalPiezas) && (totalPiezas as number) > 0 ? (totalPiezas as number) : 0;
  return Math.ceil(n / PIEZAS_POR_PAGINA);
}
// "?pagina=" de la dirección → número de página (1 si falta o no es un entero positivo).
export function paginaDeParametro(valor: unknown): number {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  const n = Number(texto);
  return /^[0-9]{1,6}$/.test(String(texto ?? '')) && n >= 1 ? n : 1;
}
// Qué bloque leer y qué tramo de su lista corresponde a la página (desde 1).
export function ubicacionPagina(pagina: number): { bloque: number; desde: number; hasta: number } {
  const inicio = (pagina - 1) * PIEZAS_POR_PAGINA;
  const desde = inicio % PIEZAS_POR_BLOQUE;
  return { bloque: Math.floor(inicio / PIEZAS_POR_BLOQUE), desde, hasta: desde + PIEZAS_POR_PAGINA };
}

export type PiezaRefaccionaria = {
  numeroParte: string; descripcion: string; marca: string; tipo: 'generica' | 'marca'; precio: number; incluyeIva: boolean;
};
// Una pieza del bloque, limpia para mostrarse; sin número de parte o sin precio válido no se muestra.
export function piezaPublica(p: unknown): PiezaRefaccionaria | null {
  if (!p || typeof p !== 'object') return null;
  const o = p as Record<string, unknown>;
  const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const numeroParte = texto(o.numeroParte, 60);
  const precio = typeof o.precio === 'number' && Number.isFinite(o.precio) && o.precio > 0 ? o.precio : null;
  if (!numeroParte || precio === null) return null;
  return {
    numeroParte, descripcion: texto(o.descripcion, 200), marca: texto(o.marca, 60),
    tipo: o.tipo === 'marca' ? 'marca' : 'generica', precio, incluyeIva: o.incluyeIva === true,
  };
}
export function piezasDePagina(bloque: { piezas?: unknown } | null | undefined, pagina: number): PiezaRefaccionaria[] {
  const lista = Array.isArray(bloque?.piezas) ? bloque.piezas : [];
  const { desde, hasta } = ubicacionPagina(pagina);
  return lista.slice(desde, hasta).map(piezaPublica).filter((p): p is PiezaRefaccionaria => p !== null);
}
export const formatoPrecio = (precio: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(precio);

// ---------- Horario (mismo formato que el de los yonkes: lib/horario.js) ----------
export const DIAS_HORARIO = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;
export type DiaHorario = { abierto: boolean; apertura: string; cierre: string };
export type Horario = Record<(typeof DIAS_HORARIO)[number], DiaHorario>;
export const HORARIO_INICIAL: Horario = {
  lunes: { abierto: true, apertura: '09:00', cierre: '18:00' },
  martes: { abierto: true, apertura: '09:00', cierre: '18:00' },
  miercoles: { abierto: true, apertura: '09:00', cierre: '18:00' },
  jueves: { abierto: true, apertura: '09:00', cierre: '18:00' },
  viernes: { abierto: true, apertura: '09:00', cierre: '18:00' },
  sabado: { abierto: true, apertura: '09:00', cierre: '14:00' },
  domingo: { abierto: false, apertura: '09:00', cierre: '14:00' },
};
const HORA = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
// Horario completo de los 7 días; cada día abierto con apertura < cierre (formato HH:MM, 24 h).
export function validarHorario(h: unknown): { ok: true; horario: Horario } | { ok: false; mensaje: string } {
  if (!h || typeof h !== 'object') return { ok: false, mensaje: 'Falta el horario.' };
  const horario = {} as Horario;
  for (const dia of DIAS_HORARIO) {
    const d = (h as Record<string, Partial<DiaHorario>>)[dia];
    if (!d || typeof d.abierto !== 'boolean' || typeof d.apertura !== 'string' || typeof d.cierre !== 'string') {
      return { ok: false, mensaje: 'Falta el horario de algún día.' };
    }
    if (!HORA.test(d.apertura) || !HORA.test(d.cierre)) return { ok: false, mensaje: 'Escribe las horas como 09:00 o 18:30.' };
    if (d.abierto && d.apertura >= d.cierre) return { ok: false, mensaje: 'La hora de cierre debe ser después de la de apertura.' };
    horario[dia] = { abierto: d.abierto, apertura: d.apertura, cierre: d.cierre };
  }
  return { ok: true, horario };
}
