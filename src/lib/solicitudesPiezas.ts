// Lógica pura del pedido de piezas de un taller a los yonkes: validaciones y vigencia.
// Sin Firestore aquí — eso vive en las pantallas (src/app/panel/taller/pedir-pieza y
// src/app/panel/SolicitudesPiezasYonke.js). Mismo estilo que src/lib/cotizaciones.ts.

export const DIAS_VIGENCIA_SOLICITUD = 5;
export const TOLERANCIA_EXPIRA_MINUTOS = 5;
export const PRECIO_MAX = 1000000;
export const PIEZA_MAX = 100;
export const NOTA_MAX = 200;

export type Vehiculo = { marca: string; modelo: string; anio: number };
export type DatosSolicitud = { vehiculo: Vehiculo; pieza: string; nota: string };
export type DatosRespuesta = { tieneLaPieza: boolean; precio: number; nota: string };

export const MENSAJES_SOLICITUD = {
  vehiculo: 'Escribe la marca y el modelo del vehículo.',
  anio: 'Revisa el año del vehículo (entre 1950 y 2100).',
  pieza: `Escribe qué pieza buscas (máximo ${PIEZA_MAX} letras).`,
  nota: `La nota es muy larga (máximo ${NOTA_MAX} letras).`,
  guardarFallo: 'No pudimos enviar el pedido. Revisa tu conexión e intenta de nuevo. Lo que escribiste sigue en pantalla.',
} as const;

export const MENSAJES_RESPUESTA = {
  precio: `Escribe el precio: debe ser mayor a 0 y no mayor a ${PRECIO_MAX.toLocaleString('es-MX')} pesos.`,
  nota: `La nota es muy larga (máximo ${NOTA_MAX} letras).`,
  enviarFallo: 'No pudimos enviar tu respuesta. Revisa tu conexión e intenta de nuevo.',
} as const;

// Primer error del pedido, en el orden en que aparecen los campos. null si todo está bien.
export function validarSolicitud(d: DatosSolicitud): string | null {
  if (!d.vehiculo.marca.trim() || !d.vehiculo.modelo.trim()) return MENSAJES_SOLICITUD.vehiculo;
  if (!Number.isInteger(d.vehiculo.anio) || d.vehiculo.anio < 1950 || d.vehiculo.anio > 2100) return MENSAJES_SOLICITUD.anio;
  if (!d.pieza.trim() || d.pieza.trim().length > PIEZA_MAX) return MENSAJES_SOLICITUD.pieza;
  if (d.nota.length > NOTA_MAX) return MENSAJES_SOLICITUD.nota;
  return null;
}

// Primer error de la respuesta del yonke. null si todo está bien.
export function validarRespuesta(d: DatosRespuesta): string | null {
  if (d.tieneLaPieza && (!Number.isFinite(d.precio) || d.precio <= 0 || d.precio > PRECIO_MAX)) return MENSAJES_RESPUESTA.precio;
  if (d.nota.length > NOTA_MAX) return MENSAJES_RESPUESTA.nota;
  return null;
}

// Fecha de vencimiento de una solicitud creada en "desde": desde + 5 días.
export function calcularExpiraAtSolicitud(desde: Date): Date {
  return new Date(desde.getTime() + DIAS_VIGENCIA_SOLICITUD * 24 * 60 * 60 * 1000);
}
