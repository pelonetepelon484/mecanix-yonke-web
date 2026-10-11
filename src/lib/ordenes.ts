// Lógica pura de las órdenes de servicio del taller. Mismo criterio que cotizaciones.ts:
// dinero en centavos, IVA calculado al mostrar (no se guarda) y validaciones en español.
// Datos del cliente (etapa 4): nombre, teléfono y placas, opcionales, SOLO cuando
// datosClienteDisponibles (avisoOrden.ts) lo permite. Nunca VIN ni fotos.
import { generarFolio, subtotalCentavos } from './cotizaciones';

export const MAX_TRABAJOS = 20;
export const MAX_PIEZAS = 20;
export const MAX_FALLA = 1000;
export const MAX_OBSERVACIONES = 1000;
export const MAX_ESTADO_RECEPCION = 500;
export const MAX_PERTENENCIAS = 500;
export const MAX_PRECIO_ITEM = 1000000;
export const MAX_GARANTIA_DIAS = 365;
// Borrado (política TTL de Firestore sobre expiraAt). Las reglas exigen estas mismas fórmulas.
// - Sin entregar: última modificación + 88 días (se recalcula en cada guardado).
// - Entregada: fecha de entrega + días de garantía + 8 días (el texto legal dirá 10; los 2 de
//   margen son por la demora del TTL de Firestore).
export const DIAS_RETENCION_ORDEN = 88;
export const DIAS_DESPUES_GARANTIA = 8;
const DIA_MS = 24 * 60 * 60 * 1000;

export const ESTADOS_ORDEN = ['recibido', 'diagnostico', 'esperandoPiezas', 'reparacion', 'listo', 'entregado'] as const;
export type EstadoOrden = (typeof ESTADOS_ORDEN)[number];
export const NOMBRE_ESTADO_ORDEN: Record<EstadoOrden, string> = {
  recibido: 'Recibido',
  diagnostico: 'En diagnóstico',
  esperandoPiezas: 'Esperando piezas',
  reparacion: 'En reparación',
  listo: 'Listo',
  entregado: 'Entregado',
};

// Advertencias visibles en los campos de texto libre.
export const ADVERTENCIA_VEHICULO = 'Solo información del vehículo. No escribas nombres, teléfonos ni datos personales.';
// Observaciones: la misma advertencia que ya tienen las observaciones de cotizaciones.
export const ADVERTENCIA_OBSERVACIONES = 'Solo observaciones del vehículo. No escribas nombres, teléfonos ni datos personales o sensibles.';
export const AVISO_COPIA = 'Descarga tu copia antes de esa fecha. Mecanix no conserva tus documentos después.';

export const MENSAJES_ORDEN = {
  vehiculo: 'Escribe la marca y el modelo del vehículo.',
  anio: 'Revisa el año del vehículo (entre 1950 y 2100).',
  kilometraje: 'El kilometraje debe ser un número entero entre 0 y 2,000,000.',
  falla: `La falla reportada es muy larga (máximo ${MAX_FALLA} letras).`,
  observaciones: `Las observaciones son muy largas (máximo ${MAX_OBSERVACIONES} letras).`,
  estadoRecepcion: `"Estado del vehículo al recibirlo" es muy largo (máximo ${MAX_ESTADO_RECEPCION} letras).`,
  pertenencias: `"Pertenencias dentro del vehículo" es muy largo (máximo ${MAX_PERTENENCIAS} letras).`,
  nombreCliente: 'El nombre del cliente es muy largo (máximo 100 letras).',
  telefono: 'El teléfono solo puede tener números, espacios, + y guiones (máximo 20 caracteres).',
  placas: 'Las placas son muy largas (máximo 12 caracteres).',
  demasiadosTrabajos: `Una orden puede tener hasta ${MAX_TRABAJOS} trabajos.`,
  demasiadasPiezas: `Una orden puede tener hasta ${MAX_PIEZAS} piezas.`,
  descripcion: 'Escribe la descripción de cada trabajo y pieza (máximo 200 letras).',
  cantidad: 'La cantidad debe ser un número entero de 1 a 999.',
  precio: 'El precio debe ser 0 o más, y no mayor a 1,000,000 pesos.',
  estado: 'Elige el estado de la orden.',
  garantia: `Para marcar la orden como entregada, escribe los días de garantía (de 0 a ${MAX_GARANTIA_DIAS}).`,
  tallerDesactivado: 'Tu taller está desactivado, por eso no puedes guardar cambios. Escríbenos para revisarlo.',
  guardarFallo: 'No pudimos guardar la orden. Revisa tu conexión e intenta de nuevo. Lo que escribiste sigue en pantalla.',
} as const;

export type ItemOrden = { descripcion: string; cantidad: number; precioUnitario: number };
export type DatosOrden = {
  cliente?: { nombre?: string; telefono?: string };
  vehiculo: { marca: string; modelo: string; anio: number; kilometraje?: number; placas?: string };
  fallaReportada: string;
  observaciones: string;
  estadoRecepcion: string;
  pertenencias: string;
  trabajos: ItemOrden[];
  piezas: ItemOrden[];
  estado: EstadoOrden;
  garantiaDias?: number;
};

// Folio: "O" + AAMMDD + "-" + 4 caracteres al azar (mismo alfabeto que cotizaciones). Ej.: O251011-7KQ4.
export function generarFolioOrden(fecha: Date, aleatorio: () => number = Math.random): string {
  return `O${generarFolio(fecha, aleatorio).slice(1)}`;
}

export function validarItem(i: ItemOrden): string | null {
  if (!i.descripcion || i.descripcion.trim().length < 1 || i.descripcion.trim().length > 200) return MENSAJES_ORDEN.descripcion;
  if (!Number.isInteger(i.cantidad) || i.cantidad < 1 || i.cantidad > 999) return MENSAJES_ORDEN.cantidad;
  if (!Number.isFinite(i.precioUnitario) || i.precioUnitario < 0 || i.precioUnitario > MAX_PRECIO_ITEM) return MENSAJES_ORDEN.precio;
  return null;
}

export function garantiaValida(dias: unknown): dias is number {
  return Number.isInteger(dias) && (dias as number) >= 0 && (dias as number) <= MAX_GARANTIA_DIAS;
}

// Primer error del formulario, en el orden en que aparecen los campos. null si todo está bien.
// Una orden recién recibida puede no tener todavía trabajos ni piezas.
export function validarOrden(d: DatosOrden): string | null {
  if ((d.cliente?.nombre ?? '').length > 100) return MENSAJES_ORDEN.nombreCliente;
  if (d.cliente?.telefono !== undefined && !/^[0-9 +()-]{0,20}$/.test(d.cliente.telefono)) return MENSAJES_ORDEN.telefono;
  if (!d.vehiculo.marca.trim() || !d.vehiculo.modelo.trim()) return MENSAJES_ORDEN.vehiculo;
  if (!Number.isInteger(d.vehiculo.anio) || d.vehiculo.anio < 1950 || d.vehiculo.anio > 2100) return MENSAJES_ORDEN.anio;
  if (d.vehiculo.placas !== undefined && d.vehiculo.placas.length > 12) return MENSAJES_ORDEN.placas;
  if (d.vehiculo.kilometraje !== undefined && (!Number.isInteger(d.vehiculo.kilometraje) || d.vehiculo.kilometraje < 0 || d.vehiculo.kilometraje > 2000000)) return MENSAJES_ORDEN.kilometraje;
  if (d.fallaReportada.length > MAX_FALLA) return MENSAJES_ORDEN.falla;
  if (d.estadoRecepcion.length > MAX_ESTADO_RECEPCION) return MENSAJES_ORDEN.estadoRecepcion;
  if (d.pertenencias.length > MAX_PERTENENCIAS) return MENSAJES_ORDEN.pertenencias;
  if (d.trabajos.length > MAX_TRABAJOS) return MENSAJES_ORDEN.demasiadosTrabajos;
  if (d.piezas.length > MAX_PIEZAS) return MENSAJES_ORDEN.demasiadasPiezas;
  for (const i of [...d.trabajos, ...d.piezas]) {
    const error = validarItem(i);
    if (error) return error;
  }
  if (d.observaciones.length > MAX_OBSERVACIONES) return MENSAJES_ORDEN.observaciones;
  if (!ESTADOS_ORDEN.includes(d.estado)) return MENSAJES_ORDEN.estado;
  if (d.estado === 'entregado' && !garantiaValida(d.garantiaDias)) return MENSAJES_ORDEN.garantia;
  return null;
}

// Subtotal de la orden en centavos, sin IVA (trabajos + piezas). El IVA se calcula al mostrar.
export function totalOrdenCentavos(d: Pick<DatosOrden, 'trabajos' | 'piezas'>): number {
  return [...d.trabajos, ...d.piezas].reduce((suma, i) => suma + subtotalCentavos(i), 0);
}

const aDate = (v: unknown): Date | null => {
  if (v instanceof Date) return v;
  if (v && typeof (v as { toDate?: () => Date }).toDate === 'function') return (v as { toDate: () => Date }).toDate();
  return null;
};

export function expiraSinEntregar(ahora: Date): Date {
  return new Date(ahora.getTime() + DIAS_RETENCION_ORDEN * DIA_MS);
}

export function expiraEntregada(fechaEntrega: Date, garantiaDias: number): Date {
  return new Date(fechaEntrega.getTime() + (garantiaDias + DIAS_DESPUES_GARANTIA) * DIA_MS);
}

type OrdenGuardada = { estado?: string; garantiaDias?: number; fechaEntrega?: unknown; expiraAt?: unknown } | null;

// Qué fecha de borrado y de entrega lleva un guardado, según el estado nuevo y el anterior.
// - fechaEntrega: 'servidor' = la pone Firestore (hora del servidor) porque la orden se entrega
//   AHORA; un valor = se conserva la anterior; null = no lleva (no está entregada).
// - expiraAt: la fecha que exigen las reglas.
export function planBorrado(
  original: OrdenGuardada, estado: EstadoOrden, garantiaDias: number | undefined, ahora: Date = new Date(),
): { fechaEntrega: unknown; expiraAt: unknown } {
  if (estado !== 'entregado') return { fechaEntrega: null, expiraAt: expiraSinEntregar(ahora) };
  const entregaAnterior = original?.estado === 'entregado' ? aDate(original.fechaEntrega) : null;
  if (!entregaAnterior) return { fechaEntrega: 'servidor', expiraAt: expiraEntregada(ahora, garantiaDias as number) };
  // Ya estaba entregada: la fecha de entrega no cambia. El borrado solo se mueve si cambió la garantía.
  if (original?.garantiaDias === garantiaDias) return { fechaEntrega: original?.fechaEntrega, expiraAt: original?.expiraAt };
  return { fechaEntrega: original?.fechaEntrega, expiraAt: expiraEntregada(entregaAnterior, garantiaDias as number) };
}

// Fecha que se mostrará como "se eliminará el ..." ANTES de guardar (para que el taller la vea).
export function fechaBorradoPrevista(original: OrdenGuardada, estado: EstadoOrden, garantiaDias: number | undefined, ahora: Date = new Date()): Date | null {
  if (estado === 'entregado' && !garantiaValida(garantiaDias)) return null;
  return aDate(planBorrado(original, estado, garantiaDias, ahora).expiraAt);
}

// Lectura tolerante: lo que venga de Firestore se convierte a texto plano y números, sin romper la
// pantalla aunque un renglón esté mal formado (las reglas no revisan cada renglón; ver firestore.rules).
// La pantalla y el PDF muestran estos valores SIEMPRE como texto (nunca como HTML).
export function textoPlano(v: unknown, max = 1000): string {
  if (typeof v !== 'string' && typeof v !== 'number') return '';
  return String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, max);
}

export function leerItems(lista: unknown, max = MAX_TRABAJOS): ItemOrden[] {
  if (!Array.isArray(lista)) return [];
  return lista.slice(0, max).map((x) => {
    const r = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    const cantidad = Number(r.cantidad);
    const precio = Number(r.precioUnitario);
    return {
      descripcion: textoPlano(r.descripcion, 200),
      cantidad: Number.isFinite(cantidad) ? cantidad : 1,
      precioUnitario: Number.isFinite(precio) ? precio : 0,
    };
  });
}

// ---------- Etapa 2: convertir una cotización en orden ----------
// La orden nace "recibido", con folio "O..." y borrado a 88 días (como una creada desde cero).
// Copia: marca, modelo, año, kilometraje y observaciones; piezas -> "piezas", mano de obra ->
// "trabajos". Nombre, teléfono y placas SOLO con copiarCliente (bandera de datos del cliente de
// órdenes encendida y aviso de órdenes listo). Nunca guarda un enlace a la cotización, que se
// borra en el mismo guardado.
export const MENSAJES_CONVERSION = {
  confirmar: 'Se creará una orden de servicio y esta cotización se eliminará. ¿Continuar?',
  datosCliente: 'Los datos del cliente (nombre, teléfono y placas) no pasan a la orden y se perderán al eliminar la cotización. Si los necesitas, anótalos antes.',
  demasiados: `Esta cotización tiene más de ${MAX_PIEZAS} piezas o más de ${MAX_TRABAJOS} trabajos y no se puede convertir. No se cambió nada.`,
  noExiste: 'La cotización ya no existe. No se cambió nada.',
  fallo: 'No pudimos convertir la cotización en orden. La cotización no se cambió. Revisa tu conexión e intenta de nuevo.',
} as const;

type RenglonCotizacion = { tipo?: unknown; descripcion?: unknown; cantidad?: unknown; precioUnitario?: unknown };
type CotizacionParaConvertir = {
  cliente?: { nombre?: unknown; telefono?: unknown } | null;
  vehiculo?: { marca?: unknown; modelo?: unknown; anio?: unknown; placas?: unknown; kilometraje?: unknown } | null;
  observaciones?: unknown;
  renglones?: RenglonCotizacion[] | null;
};

const hayTexto = (v: unknown) => typeof v === 'string' && v.trim() !== '';

export function cotizacionTieneDatosCliente(c: CotizacionParaConvertir): boolean {
  return hayTexto(c.cliente?.nombre) || hayTexto(c.cliente?.telefono) || hayTexto(c.vehiculo?.placas);
}

// Texto de la confirmación: la segunda línea solo si la cotización tiene datos del cliente y esos
// datos NO pasan a la orden (con copiarCliente sí pasan, y no se avisa de pérdida).
export function mensajeConfirmarConversion(c: CotizacionParaConvertir, { copiarCliente = false } = {}): string {
  return !copiarCliente && cotizacionTieneDatosCliente(c)
    ? `${MENSAJES_CONVERSION.confirmar}\n${MENSAJES_CONVERSION.datosCliente}`
    : MENSAJES_CONVERSION.confirmar;
}

const aItem = (r: RenglonCotizacion): ItemOrden => ({
  descripcion: typeof r.descripcion === 'string' ? r.descripcion.trim() : '',
  cantidad: Number(r.cantidad),
  precioUnitario: Number(r.precioUnitario),
});

export function ordenDesdeCotizacion(c: CotizacionParaConvertir, { copiarCliente = false } = {}): DatosOrden {
  const renglones = Array.isArray(c.renglones) ? c.renglones : [];
  const vehiculo: DatosOrden['vehiculo'] = {
    marca: typeof c.vehiculo?.marca === 'string' ? c.vehiculo.marca : '',
    modelo: typeof c.vehiculo?.modelo === 'string' ? c.vehiculo.modelo : '',
    anio: Number(c.vehiculo?.anio),
  };
  if (c.vehiculo?.kilometraje !== undefined && c.vehiculo?.kilometraje !== null) vehiculo.kilometraje = Number(c.vehiculo.kilometraje);
  const cliente: NonNullable<DatosOrden['cliente']> = {};
  if (copiarCliente) {
    if (hayTexto(c.cliente?.nombre)) cliente.nombre = (c.cliente?.nombre as string).trim();
    if (hayTexto(c.cliente?.telefono)) cliente.telefono = (c.cliente?.telefono as string).trim();
    if (hayTexto(c.vehiculo?.placas)) vehiculo.placas = (c.vehiculo?.placas as string).trim();
  }
  return {
    cliente,
    vehiculo,
    fallaReportada: '',
    observaciones: typeof c.observaciones === 'string' ? c.observaciones : '',
    estadoRecepcion: '',
    pertenencias: '',
    trabajos: renglones.filter((r) => r?.tipo === 'manoObra').map(aItem),
    piezas: renglones.filter((r) => r?.tipo === 'pieza').map(aItem),
    estado: 'recibido',
  };
}

// Primer problema para convertir (null = se puede). Más de 20 de un tipo no debería pasar (una
// cotización tiene máximo 20 renglones), pero si pasa, no se toca nada.
export function validarConversion(c: CotizacionParaConvertir, { copiarCliente = false } = {}): string | null {
  const datos = ordenDesdeCotizacion(c, { copiarCliente });
  if (datos.trabajos.length > MAX_TRABAJOS || datos.piezas.length > MAX_PIEZAS) return MENSAJES_CONVERSION.demasiados;
  return validarOrden(datos);
}

// ---------- Etapa 3: aviso de vencimiento (con las órdenes que la lista ya cargó) ----------
export const DIAS_AVISO_VENCIMIENTO = 15;

// Días que faltan para el borrado (redondeado hacia arriba). null si no hay fecha.
export function diasParaBorrado(expiraAt: unknown, ahora: number): number | null {
  const f = aDate(expiraAt);
  if (!f) return null;
  return Math.ceil((f.getTime() - ahora) / DIA_MS);
}

export function porVencer(expiraAt: unknown, ahora: number): boolean {
  const d = diasParaBorrado(expiraAt, ahora);
  return d !== null && d <= DIAS_AVISO_VENCIMIENTO;
}

export function textoSeEliminaEn(dias: number): string {
  if (dias <= 0) return 'Se elimina hoy';
  return dias === 1 ? 'Se elimina en 1 día' : `Se elimina en ${dias} días`;
}

// Aviso general: solo con al menos una orden por vencer. Nunca "no tienes órdenes por vencer" ni un cero.
export function textoAvisoVencimiento(cuantas: number): string | null {
  if (!(cuantas > 0)) return null;
  return cuantas === 1
    ? `Tienes 1 orden que se eliminará en ${DIAS_AVISO_VENCIMIENTO} días o menos. Descarga tu copia.`
    : `Tienes ${cuantas} órdenes que se eliminarán en ${DIAS_AVISO_VENCIMIENTO} días o menos. Descarga tu copia.`;
}
