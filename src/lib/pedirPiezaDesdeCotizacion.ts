// "Pedir a los yonkes" desde un renglón de pieza de una cotización (versión 1: no se guarda ningún
// vínculo). La cotización abre /panel/taller/pedir-pieza/nueva con el vehículo y la pieza en la
// URL, y esa pantalla los usa SOLO para prellenar el formulario (todo editable).
//
// PRIVACIDAD: por la URL viajan únicamente marca, modelo, año y la descripción de la pieza. Nunca
// el nombre ni el teléfono del cliente, las placas, las observaciones ni los precios: el enlace se
// arma con una lista cerrada de campos, y la pantalla que lo recibe ignora cualquier otro.
import { PIEZA_MAX, validarSolicitud } from './solicitudesPiezas';

export const RUTA_NUEVA_SOLICITUD = '/panel/taller/pedir-pieza/nueva';
export const PARAMETROS_PERMITIDOS = ['marca', 'modelo', 'anio', 'pieza'] as const;
const MAX_MARCA_MODELO = 60;

type Vehiculo = { marca?: unknown; modelo?: unknown; anio?: unknown };

// Texto plano de una línea: sin caracteres de control, espacios juntos, recortado al máximo.
// (React siempre lo muestra como texto; nada de esto se interpreta como código.)
export function limpiarTexto(valor: unknown, max: number): string {
  if (typeof valor !== 'string' && typeof valor !== 'number') return '';
  return String(valor).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

// Lado de la cotización. Recibe SOLO el vehículo y la descripción del renglón.
export function enlacePedirPieza({ vehiculo, descripcion }: { vehiculo: Vehiculo; descripcion: unknown }): string {
  const params = new URLSearchParams();
  const poner = (clave: (typeof PARAMETROS_PERMITIDOS)[number], valor: string) => { if (valor) params.set(clave, valor); };
  poner('marca', limpiarTexto(vehiculo?.marca, MAX_MARCA_MODELO));
  poner('modelo', limpiarTexto(vehiculo?.modelo, MAX_MARCA_MODELO));
  poner('anio', limpiarTexto(vehiculo?.anio, 12)); // sin recortar: lo valida quien lo recibe
  poner('pieza', limpiarTexto(descripcion, PIEZA_MAX));
  const qs = params.toString();
  return qs ? `${RUTA_NUEVA_SOLICITUD}?${qs}` : RUTA_NUEVA_SOLICITUD;
}

const sinAcentos = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// Las MISMAS validaciones del formulario (validarSolicitud), campo por campo: los demás campos se
// rellenan con un valor válido de prueba para que el único error posible sea el del campo revisado.
function anioValido(anio: number): boolean {
  return validarSolicitud({ vehiculo: { marca: 'x', modelo: 'x', anio }, pieza: 'x', nota: '' }) === null;
}
function piezaValida(pieza: string): boolean {
  return validarSolicitud({ vehiculo: { marca: 'x', modelo: 'x', anio: 2000 }, pieza, nota: '' }) === null;
}

export type Prefill = { marca: string; modelo: string; anio: string; pieza: string };

// Lado del pedido de piezas: lee la URL y devuelve lo que se puede prellenar. Marca y modelo se
// buscan en el catálogo sin importar mayúsculas ni acentos ("nissan" -> "Nissan"); si no hay
// coincidencia clara, el campo queda vacío (el taller lo elige) en lugar de adivinar.
export function prefillDesdeParametros(
  params: { get(clave: string): string | null } | null | undefined,
  catalogo: Record<string, string[]>,
): Prefill {
  const leer = (clave: string, max: number) => limpiarTexto(params?.get(clave) ?? '', max);

  const marcaTexto = leer('marca', MAX_MARCA_MODELO);
  const marca = marcaTexto ? (Object.keys(catalogo).find((m) => sinAcentos(m) === sinAcentos(marcaTexto)) ?? '') : '';

  const modeloTexto = leer('modelo', MAX_MARCA_MODELO);
  const modelo = marca && modeloTexto
    ? ((catalogo[marca] || []).find((mo) => sinAcentos(mo) === sinAcentos(modeloTexto)) ?? '')
    : '';

  // Se lee más largo de 4 a propósito: "2010.5" no debe recortarse a "2010" y pasar como válido.
  const anioTexto = leer('anio', 12);
  const anio = /^[0-9]{4}$/.test(anioTexto) && anioValido(Number(anioTexto)) ? anioTexto : '';

  const piezaTexto = leer('pieza', PIEZA_MAX);
  const pieza = piezaTexto && piezaValida(piezaTexto) ? piezaTexto : '';

  return { marca, modelo, anio, pieza };
}
