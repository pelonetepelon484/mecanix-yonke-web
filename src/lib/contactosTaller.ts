// Libreta de contactos del taller (lógica pura, sin Firestore).
// Un documento por contacto en talleres/{tallerId}/contactosClientes/{contactoId}.
// Plan Básico: hasta 25 contactos. Plan Premium: sin límite.
//
// Cómo se cuida el tope de 25 sin contar documentos (las reglas de Firestore no pueden contar):
// en Básico cada contacto ocupa uno de 25 "lugares" con ID fijo (c01 ... c25). Un ID que no sea
// de esos solo se puede crear con Premium vigente (ID automático de 20 letras y números). Borrar
// un contacto, o que se borre solo por no usarse, libera su lugar. Si un taller baja de Premium
// con más de 25, no pierde nada: puede ver, editar, usar y borrar todos; solo no agrega nuevos
// mientras sus 25 lugares estén ocupados. Las reglas (firestore.rules) exigen lo mismo.
import { whatsappHref } from './whatsapp';

export const LIMITE_CONTACTOS_BASICO = 25;
export const RANURAS_BASICO: string[] = Array.from({ length: LIMITE_CONTACTOS_BASICO }, (_, i) => `c${String(i + 1).padStart(2, '0')}`);
export const MAX_NOMBRE_CONTACTO = 100;
export const MAX_NOTA_CONTACTO = 200;
export const MAX_VEHICULOS_CONTACTO = 3;
export const MAX_PLACAS = 12;
// 18 meses sin cambios ni uso: lo borra la política TTL de Firestore (expiraAt), como el historial.
export const DIAS_RETENCION_CONTACTO = 548;
const DIA_MS = 24 * 60 * 60 * 1000;

export const ADVERTENCIA_NOTA_CONTACTO = 'Solo datos útiles para atender al cliente. No escribas datos sensibles (salud, religión, datos bancarios, contraseñas).';
export const TEXTO_RETENCION_CONTACTO = 'Cada contacto se borra solo si pasan 18 meses sin editarlo ni escribirle por WhatsApp.';

export const MENSAJES_CONTACTO = {
  nombre: `Escribe el nombre del contacto (máximo ${MAX_NOMBRE_CONTACTO} letras).`,
  telefono: 'Escribe el WhatsApp a 10 dígitos, por ejemplo 6641234567, o déjalo vacío.',
  nota: `La nota es muy larga (máximo ${MAX_NOTA_CONTACTO} letras).`,
  vehiculo: 'Escribe la marca y el modelo de cada vehículo (o deja el renglón vacío).',
  anio: 'Revisa el año del vehículo (entre 1950 y 2100) o déjalo vacío.',
  placas: `Las placas solo pueden tener letras, números y guiones (máximo ${MAX_PLACAS}).`,
  demasiadosVehiculos: `Un contacto puede tener hasta ${MAX_VEHICULOS_CONTACTO} vehículos.`,
  lleno: `Llegaste a ${LIMITE_CONTACTOS_BASICO} contactos del plan Básico. Con Premium no tienes límite. También puedes borrar uno que ya no uses.`,
  guardarFallo: 'No pudimos guardar el contacto. Revisa tu conexión e intenta de nuevo. Lo que escribiste sigue en pantalla.',
  borrarFallo: 'No pudimos borrar el contacto. Intenta de nuevo.',
} as const;

export type VehiculoContacto = { marca: string; modelo: string; anio?: number; placas?: string };
export type DatosContacto = { nombre: string; telefono: string; nota: string; vehiculos: VehiculoContacto[] };
export type VehiculoEscrito = { marca?: string; modelo?: string; anio?: string | number; placas?: string };
export type ContactoEscrito = { nombre?: string; telefono?: string; nota?: string; vehiculos?: VehiculoEscrito[] };

// WhatsApp a 10 dígitos: quita espacios, guiones, paréntesis y el +52 del inicio. '' si viene vacío.
// null si no queda en 10 dígitos.
export function normalizarTelefonoContacto(valor: unknown): string | null {
  if (typeof valor !== 'string') return '';
  const digitos = valor.replace(/\D/g, '');
  if (digitos === '') return '';
  if (digitos.length === 10) return digitos;
  if (digitos.length === 12 && digitos.startsWith('52')) return digitos.slice(2);
  if (digitos.length === 13 && digitos.startsWith('521')) return digitos.slice(3);
  return null;
}

// Mayúsculas y sin espacios. '' si viene vacía; null si trae otros caracteres o es muy larga.
export function normalizarPlacasContacto(valor: unknown): string | null {
  if (typeof valor !== 'string') return '';
  const p = valor.toUpperCase().replace(/\s+/g, '');
  if (p === '') return '';
  return /^[A-Z0-9-]{1,12}$/.test(p) ? p : null;
}

// Para buscar por nombre sin importar mayúsculas ni acentos ("José" -> "jose").
export function textoBusqueda(valor: unknown): string {
  if (typeof valor !== 'string') return '';
  return valor.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const vacio = (v: unknown) => v === undefined || v === null || String(v).trim() === '';

// Revisa lo escrito en el formulario y lo deja listo para guardar. Los renglones de vehículo
// completamente vacíos se ignoran. Devuelve el primer error en español.
export function validarContacto(c: ContactoEscrito): { ok: true; datos: DatosContacto } | { ok: false; mensaje: string } {
  const nombre = (c.nombre ?? '').trim().replace(/\s+/g, ' ');
  if (nombre.length < 1 || nombre.length > MAX_NOMBRE_CONTACTO) return { ok: false, mensaje: MENSAJES_CONTACTO.nombre };
  const telefono = normalizarTelefonoContacto(c.telefono ?? '');
  if (telefono === null) return { ok: false, mensaje: MENSAJES_CONTACTO.telefono };
  const nota = (c.nota ?? '').trim();
  if (nota.length > MAX_NOTA_CONTACTO) return { ok: false, mensaje: MENSAJES_CONTACTO.nota };
  const escritos = (c.vehiculos ?? []).filter((v) => !(vacio(v.marca) && vacio(v.modelo) && vacio(v.anio) && vacio(v.placas)));
  if (escritos.length > MAX_VEHICULOS_CONTACTO) return { ok: false, mensaje: MENSAJES_CONTACTO.demasiadosVehiculos };
  const vehiculos: VehiculoContacto[] = [];
  for (const v of escritos) {
    const marca = String(v.marca ?? '').trim();
    const modelo = String(v.modelo ?? '').trim();
    if (marca.length < 1 || marca.length > 60 || modelo.length < 1 || modelo.length > 60) return { ok: false, mensaje: MENSAJES_CONTACTO.vehiculo };
    const vehiculo: VehiculoContacto = { marca, modelo };
    if (!vacio(v.anio)) {
      const anio = Number(v.anio);
      if (!Number.isInteger(anio) || anio < 1950 || anio > 2100) return { ok: false, mensaje: MENSAJES_CONTACTO.anio };
      vehiculo.anio = anio;
    }
    const placas = normalizarPlacasContacto(v.placas ?? '');
    if (placas === null) return { ok: false, mensaje: MENSAJES_CONTACTO.placas };
    if (placas) vehiculo.placas = placas;
    vehiculos.push(vehiculo);
  }
  return { ok: true, datos: { nombre, telefono, nota, vehiculos } };
}

export function expiraContacto(ahora: number = Date.now()): Date {
  return new Date(ahora + DIAS_RETENCION_CONTACTO * DIA_MS);
}

// Campos que se guardan (además de creadoAt, actualizadoAt y expiraAt, que pone datos.js).
// nombreBusqueda y placasLista sirven para buscar con los índices automáticos de Firestore.
export function camposContacto(d: DatosContacto) {
  return {
    nombre: d.nombre,
    nombreBusqueda: textoBusqueda(d.nombre).slice(0, MAX_NOMBRE_CONTACTO),
    telefono: d.telefono,
    nota: d.nota,
    vehiculos: d.vehiculos,
    placasLista: d.vehiculos.map((v) => v.placas).filter((p): p is string => Boolean(p)),
  };
}

// Primer lugar libre del plan Básico (c01 ... c25), o null si están los 25 ocupados.
export function primeraRanuraLibre(ocupadas: Iterable<string>): string | null {
  const set = new Set(ocupadas);
  return RANURAS_BASICO.find((r) => !set.has(r)) ?? null;
}

export const esRanuraBasico = (id: unknown) => typeof id === 'string' && RANURAS_BASICO.includes(id);

// Qué ID usar para un contacto NUEVO: primero un lugar libre (en cualquier plan, así un taller
// Premium que deja de pagar conserva sus lugares ocupados); sin lugar libre, con Premium un ID
// automático y sin Premium ninguno (lleno).
export function idParaNuevoContacto(ocupadas: Iterable<string>, premium: boolean, idAutomatico: () => string): { id: string } | { lleno: true } {
  const libre = primeraRanuraLibre(ocupadas);
  if (libre) return { id: libre };
  return premium ? { id: idAutomatico() } : { lleno: true };
}

// Qué buscar en Firestore cuando la lista no está completa en pantalla.
export function tipoBusqueda(texto: string):
  | { campo: 'telefono'; valor: string } | { campo: 'placasLista'; valor: string } | { campo: 'nombreBusqueda'; valor: string } | null {
  const t = texto.trim();
  if (!t) return null;
  const tel = normalizarTelefonoContacto(t);
  if (tel && /^[\d\s()+-]+$/.test(t)) return { campo: 'telefono', valor: tel };
  const placas = normalizarPlacasContacto(t);
  if (placas && /\d/.test(placas) && /[A-Z]/.test(placas)) return { campo: 'placasLista', valor: placas };
  return { campo: 'nombreBusqueda', valor: textoBusqueda(t) };
}

type ContactoGuardado = { nombre?: string; telefono?: string; vehiculos?: VehiculoContacto[] };

// Filtro en pantalla (cuando ya están todos cargados): nombre (sin acentos), teléfono o placas.
export function coincide(c: ContactoGuardado, texto: string): boolean {
  const t = textoBusqueda(texto);
  if (!t) return true;
  if (textoBusqueda(c.nombre).includes(t)) return true;
  const digitos = texto.replace(/\D/g, '');
  if (digitos.length >= 3 && (c.telefono ?? '').includes(digitos)) return true;
  const placas = texto.toUpperCase().replace(/\s+/g, '');
  return (c.vehiculos ?? []).some((v) => (v.placas ?? '').includes(placas) && placas.length >= 2);
}

export const nombreVehiculoContacto = (v: VehiculoContacto) =>
  [v.marca, v.modelo, v.anio].filter((x) => x !== undefined && x !== null && x !== '').join(' ') + (v.placas ? ` · ${v.placas}` : '');

export function mensajeWhatsappContacto(nombreTaller: string, nombreContacto: string): string {
  const primerNombre = (nombreContacto || '').trim().split(' ')[0];
  return `Hola${primerNombre ? ` ${primerNombre}` : ''}, le escribimos de ${nombreTaller || 'su taller'}.`;
}

// null si el contacto no tiene un WhatsApp válido (entonces no se muestra el botón).
export function enlaceWhatsappContacto(telefono: unknown, nombreTaller: string, nombreContacto: string): string | null {
  return whatsappHref(telefono, mensajeWhatsappContacto(nombreTaller, nombreContacto));
}

// "12 de 25 lugares" para el plan Básico.
export function textoLugares(ocupados: number): string {
  return `Usas ${Math.min(ocupados, LIMITE_CONTACTOS_BASICO)} de ${LIMITE_CONTACTOS_BASICO} lugares del plan Básico.`;
}
