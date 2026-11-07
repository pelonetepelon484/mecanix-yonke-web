// Registro de proveedores de asistencia vial (bandera config/portada.asistenciaVialRegistro).
// No guarda nada: el formulario arma un mensaje de WhatsApp al número de Red Mecanix y el admin
// da de alta al proveedor a mano en /admin/asistencia-vial. El permiso queda escrito en el chat.
// El texto del permiso NO es un texto legal oficial (pendiente con el abogado).
import { whatsappHref } from './whatsapp';
import { TIPOS_SERVICIO, CIUDADES_ASISTENCIA, etiquetaCiudad, etiquetaServicio } from './asistenciaVial';

export const TELEFONO_RED_MECANIX = '6611034260';
export const TELEFONO_RED_MECANIX_TEXTO = '661 103 4260';

export const TEXTO_BOTON_REGISTRO = '¿Tienes grúa, llantera o servicio en carretera? Regístrate';
export const TEXTO_PERMISO = 'Doy permiso para que Red Mecanix muestre estos datos en su directorio de asistencia vial, y mi ubicación solo cuando yo la marque con el botón "Estoy aquí".';

export const MENSAJES_REGISTRO = {
  nombre: 'Escribe el nombre de tu negocio.',
  servicios: 'Escoge al menos un servicio.',
  ciudades: 'Escoge al menos una ciudad.',
  telefono: 'Escribe un teléfono de 10 dígitos.',
  horario: 'Escribe tu horario o marca "Atiendo 24 horas".',
  permiso: 'Para registrarte, marca la casilla del permiso.',
};

const LARGO_MAX = 80;
const limpio = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, LARGO_MAX) : '');
const digitos = (v) => (typeof v === 'string' ? v.replace(/\D/g, '') : '');
const claves = (lista, validas) => (Array.isArray(lista) ? validas.map((v) => v.key).filter((k) => lista.includes(k)) : []);

// Devuelve { ok: true, datos } o { ok: false, mensaje } (el primer problema que encuentre).
export function validarRegistro(f = {}) {
  const datos = {
    nombre: limpio(f.nombre),
    servicios: claves(f.servicios, TIPOS_SERVICIO),
    ciudades: claves(f.ciudades, CIUDADES_ASISTENCIA),
    telefono: digitos(f.telefono),
    atiende24h: f.atiende24h === true,
    horario: f.atiende24h === true ? '' : limpio(f.horario),
  };
  if (datos.nombre.length < 2) return { ok: false, mensaje: MENSAJES_REGISTRO.nombre };
  if (datos.servicios.length === 0) return { ok: false, mensaje: MENSAJES_REGISTRO.servicios };
  if (datos.ciudades.length === 0) return { ok: false, mensaje: MENSAJES_REGISTRO.ciudades };
  if (datos.telefono.length !== 10) return { ok: false, mensaje: MENSAJES_REGISTRO.telefono };
  if (!datos.atiende24h && datos.horario.length < 2) return { ok: false, mensaje: MENSAJES_REGISTRO.horario };
  if (f.permiso !== true) return { ok: false, mensaje: MENSAJES_REGISTRO.permiso };
  return { ok: true, datos };
}

const telefonoBonito = (d) => `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;

export function mensajeRegistro(d) {
  return [
    'Hola, quiero registrar mi servicio de asistencia vial en Red Mecanix.',
    `Negocio: ${d.nombre}`,
    `Servicios: ${d.servicios.map(etiquetaServicio).join(', ')}`,
    `Ciudades: ${d.ciudades.map(etiquetaCiudad).join(', ')}`,
    `Teléfono: ${telefonoBonito(d.telefono)}`,
    `Horario: ${d.atiende24h ? '24 horas' : d.horario}`,
    '',
    TEXTO_PERMISO,
  ].join('\n');
}

export const enlaceRegistro = (d) => whatsappHref(TELEFONO_RED_MECANIX, mensajeRegistro(d));
export const enlaceLlamarRedMecanix = `tel:+52${TELEFONO_RED_MECANIX}`;
