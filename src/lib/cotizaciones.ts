// Lógica pura de cotizaciones del taller: montos en centavos, folio y validaciones en español.
// Los montos se calculan en centavos (enteros) para que 0.1 + 0.2 dé 0.30 y no 0.30000000000000004.

export const MAX_RENGLONES = 20;
export const MAX_VIGENCIA_DIAS = 60;
// Retención técnica: 88 días desde creadoAt (margen para el retraso del TTL). Tolerancia de la regla: ±5 min.
export const DIAS_RETENCION = 88;
export const TOLERANCIA_EXPIRA_MINUTOS = 5;
export const MAX_PRECIO_RENGLON = 1000000;
export const ESTADOS_COTIZACION = ['borrador', 'enviada', 'cerrada'] as const;

export type TipoRenglon = 'pieza' | 'manoObra';
export type Renglon = { tipo: TipoRenglon; descripcion: string; cantidad: number; precioUnitario: number };

export const MENSAJES_COTIZACION = {
  sinRenglones: 'Agrega al menos un renglón para guardar la cotización.',
  demasiadosRenglones: `Una cotización puede tener hasta ${MAX_RENGLONES} renglones.`,
  descripcion: 'Escribe la descripción del renglón (máximo 200 letras).',
  cantidad: 'La cantidad debe ser un número entero de 1 a 999.',
  precio: 'El precio debe ser 0 o más, y no mayor a 1,000,000 pesos.',
  anio: 'Revisa el año del vehículo (entre 1950 y 2100).',
  placas: 'Las placas son muy largas (máximo 12 caracteres).',
  kilometraje: 'El kilometraje debe ser un número entero entre 0 y 2,000,000.',
  vehiculo: 'Escribe la marca y el modelo del vehículo.',
  nombreCliente: 'El nombre del cliente es muy largo (máximo 100 letras).',
  telefono: 'El teléfono solo puede tener números, espacios, + y guiones (máximo 20 caracteres).',
  observaciones: 'Las observaciones son muy largas (máximo 1000 letras).',
  vigencia: 'La vigencia debe ser de 1 a 60 días.',
  tallerDesactivado: 'Tu taller está desactivado, por eso no puedes guardar cambios. Escríbenos para revisarlo.',
  guardarFallo: 'No pudimos guardar la cotización. Revisa tu conexión e intenta de nuevo. Lo que escribiste sigue en pantalla.',
  folioOcupado: 'No pudimos asignar un número a la cotización. Intenta de nuevo.',
} as const;

// Convierte un monto en pesos a centavos enteros, redondeando.
export function aCentavos(pesos: number): number {
  return Math.round(pesos * 100);
}

// Subtotal de un renglón en centavos.
export function subtotalCentavos(r: Pick<Renglon, 'cantidad' | 'precioUnitario'>): number {
  return aCentavos(r.precioUnitario) * r.cantidad;
}

// Total de la cotización en centavos (suma enteros, sin errores de punto flotante).
export function totalCentavos(renglones: Pick<Renglon, 'cantidad' | 'precioUnitario'>[]): number {
  return renglones.reduce((suma, r) => suma + subtotalCentavos(r), 0);
}

// IVA: los precios se capturan SIN IVA. Se calcula al mostrar (no se guarda) y se redondea una
// sola vez sobre el subtotal de toda la cotización, no renglón por renglón.
export const IVA_PORCENTAJE = 16;

// IVA en centavos de un subtotal en centavos. subtotal × 16 nunca termina en 50, así que no hay empates al redondear.
export function ivaCentavos(subtotal: number): number {
  return Math.round((subtotal * IVA_PORCENTAJE) / 100);
}

// Total con IVA en centavos (subtotal + IVA).
export function totalConIvaCentavos(subtotal: number): number {
  return subtotal + ivaCentavos(subtotal);
}

// Texto para mostrar: "$1,234.50".
export function formatearPesos(centavos: number): string {
  const pesos = Math.floor(Math.abs(centavos) / 100);
  const resto = String(Math.abs(centavos) % 100).padStart(2, '0');
  const conComas = pesos.toLocaleString('es-MX');
  return `${centavos < 0 ? '-' : ''}$${conComas}.${resto}`;
}

// Redondea un precio escrito a centavos antes de guardarlo.
export function redondearCentavos(pesos: number): number {
  return aCentavos(pesos) / 100;
}

const ALFABETO_FOLIO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin I, L, O, 0, 1 para no confundirlas

// Folio: "C" + AAMMDD + "-" + 4 caracteres al azar. Ej.: C251006-7KQ4.
export function generarFolio(fecha: Date, aleatorio: () => number = Math.random): string {
  const aa = String(fecha.getFullYear()).slice(-2);
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const dd = String(fecha.getDate()).padStart(2, '0');
  let sufijo = '';
  for (let i = 0; i < 4; i++) {
    sufijo += ALFABETO_FOLIO[Math.floor(aleatorio() * ALFABETO_FOLIO.length)];
  }
  return `C${aa}${mm}${dd}-${sufijo}`;
}

// Primer error del renglón, en español, o null si está bien.
export function validarRenglon(r: Renglon): string | null {
  if (!r.descripcion || r.descripcion.trim().length < 1 || r.descripcion.trim().length > 200) return MENSAJES_COTIZACION.descripcion;
  if (!Number.isInteger(r.cantidad) || r.cantidad < 1 || r.cantidad > 999) return MENSAJES_COTIZACION.cantidad;
  if (!Number.isFinite(r.precioUnitario) || r.precioUnitario < 0 || r.precioUnitario > MAX_PRECIO_RENGLON) return MENSAJES_COTIZACION.precio;
  return null;
}

export type DatosCotizacion = {
  cliente: { nombre?: string; telefono?: string };
  vehiculo: { marca: string; modelo: string; anio: number; placas?: string; kilometraje?: number };
  renglones: Renglon[];
  observaciones: string;
  vigenciaDias: number;
};

// Primer error del formulario, en el orden en que aparecen los campos. null si todo está bien.
export function validarCotizacion(d: DatosCotizacion): string | null {
  if (d.renglones.length === 0) return MENSAJES_COTIZACION.sinRenglones;
  if (d.renglones.length > MAX_RENGLONES) return MENSAJES_COTIZACION.demasiadosRenglones;
  for (const r of d.renglones) {
    const error = validarRenglon(r);
    if (error) return error;
  }
  if ((d.cliente.nombre ?? '').length > 100) return MENSAJES_COTIZACION.nombreCliente;
  if (d.cliente.telefono !== undefined && !/^[0-9 +()-]{0,20}$/.test(d.cliente.telefono)) return MENSAJES_COTIZACION.telefono;
  if (!d.vehiculo.marca.trim() || !d.vehiculo.modelo.trim()) return MENSAJES_COTIZACION.vehiculo;
  if (!Number.isInteger(d.vehiculo.anio) || d.vehiculo.anio < 1950 || d.vehiculo.anio > 2100) return MENSAJES_COTIZACION.anio;
  if (d.vehiculo.placas !== undefined && d.vehiculo.placas.length > 12) return MENSAJES_COTIZACION.placas;
  if (d.vehiculo.kilometraje !== undefined && (!Number.isInteger(d.vehiculo.kilometraje) || d.vehiculo.kilometraje < 0 || d.vehiculo.kilometraje > 2000000)) return MENSAJES_COTIZACION.kilometraje;
  if (d.observaciones.length > 1000) return MENSAJES_COTIZACION.observaciones;
  if (!Number.isInteger(d.vigenciaDias) || d.vigenciaDias < 1 || d.vigenciaDias > MAX_VIGENCIA_DIAS) return MENSAJES_COTIZACION.vigencia;
  return null;
}

// Quita nombre, teléfono y placas del cliente, sin tocar el resto de la cotización.
export function quitarDatosCliente<T extends { cliente: object; vehiculo: object }>(c: T): T {
  const { placas: _placas, ...vehiculoSinPlacas } = c.vehiculo as { placas?: string };
  return { ...c, cliente: {}, vehiculo: vehiculoSinPlacas };
}

// Fecha de eliminación de una cotización creada en "desde": desde + 88 días.
export function calcularExpiraAt(desde: Date): Date {
  return new Date(desde.getTime() + DIAS_RETENCION * 24 * 60 * 60 * 1000);
}

// Copia para duplicar: sin nombre, teléfono, placas ni kilometraje del cliente/vehículo.
export function copiaSinDatosCliente<T extends { cliente: object; vehiculo: object }>(c: T): T {
  const { placas: _placas, kilometraje: _km, ...vehiculo } = c.vehiculo as { placas?: string; kilometraje?: number };
  return { ...c, cliente: {}, vehiculo };
}
