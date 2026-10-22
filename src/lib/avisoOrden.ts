// Aviso de privacidad y constancia de recepción de las ÓRDENES de servicio (etapa 4).
// El texto vive en textosLegalesTalleres.json -> avisosOrden: [{ version, aviso[], constancia[] }, ...]
// (una entrada por versión, igual que avisosTaller en las cotizaciones) y lo redacta el abogado.
// Cada orden usa SIEMPRE el texto de la versión con la que se creó (la que se le entregó al
// cliente); la última de la lista es la más reciente. Mientras algún párrafo diga "[TEXTO LEGAL PENDIENTE]" (o falte), todo FALLA
// CERRADO: el formulario no muestra nombre, teléfono ni placas, "Convertir en orden" no copia datos
// del cliente y el PDF no imprime la hoja de aviso (y no se genera si la orden trae datos del cliente).
//
// Formato de cada lista (igual que avisoTaller): el PRIMER párrafo es el título de la hoja; los demás
// son el cuerpo. Marcadores que se llenan con los datos del taller y de la orden:
//   [Nombre del taller] / [nombre del taller], [ciudad], [WhatsApp del taller],
//   [medio de contacto del taller], [folio], [fecha de recepción]
// Lo que falte se deja como línea en blanco para llenar a mano.
import textos from './textosLegalesTalleres.json';

export const MARCADOR_PENDIENTE = '[TEXTO LEGAL PENDIENTE]';
export const EN_BLANCO = '______________________';

type Parrafo = { tipo?: string; texto?: string };
type AvisoOrden = { version?: string; aviso?: Parrafo[]; constancia?: Parrafo[]; seguimiento?: boolean };
const AVISOS: AvisoOrden[] = (textos as unknown as { avisosOrden?: AvisoOrden[] }).avisosOrden ?? [];

// La versión más reciente del archivo.
export const VERSION_AVISO_ORDEN: string = AVISOS.at(-1)?.version ?? '';
export const VERSIONES_AVISO_ORDEN: string[] = AVISOS.map((a) => a.version ?? '');

// Versiones del aviso que informan al cliente del enlace de seguimiento ("seguimiento": true en el
// JSON). Solo las órdenes creadas con una de ellas pueden tener enlace. Debe coincidir con
// avisosConSeguimiento() de firestore.rules (lo revisa una prueba).
export const VERSIONES_CON_SEGUIMIENTO: string[] = AVISOS.filter((a) => a.seguimiento === true).map((a) => a.version ?? '');

export function ordenConSeguimiento(version: unknown, versiones: string[] = VERSIONES_CON_SEGUIMIENTO): boolean {
  return typeof version === 'string' && versiones.includes(version);
}

// El texto de esa versión ({} si no existe); sin versión, el más reciente.
export function avisoOrdenDeVersion(version?: unknown): AvisoOrden {
  if (version === undefined) return AVISOS.at(-1) ?? {};
  return AVISOS.find((a) => a.version === version) ?? {};
}

const listaLista = (l: unknown): l is Parrafo[] => Array.isArray(l) && l.length > 0
  && l.every((p) => typeof p?.texto === 'string' && p.texto.trim() !== '' && !p.texto.includes(MARCADOR_PENDIENTE));

// ¿Ya está el texto final del abogado? Si se pasa una versión (la de config/ordenes o la de la
// orden), debe existir en el archivo y ser EXACTAMENTE la de ese texto.
export function avisoOrdenListo(version?: unknown, aviso: AvisoOrden = avisoOrdenDeVersion(version)): boolean {
  if (!aviso.version || !listaLista(aviso.aviso) || !listaLista(aviso.constancia)) return false;
  return version === undefined || version === aviso.version;
}

// Datos del cliente (nombre, teléfono y placas), solo con la bandera encendida y:
// - orden NUEVA (sin versión): el texto de la versión de config/ordenes listo en el archivo;
// - orden que ya existe: el texto de SU versión listo en el archivo (una orden creada con
//   aviso-orden-1 lo conserva aunque config ya diga aviso-orden-2). Las órdenes sin aviso (p. ej.
//   aviso-orden-0) nunca. Las reglas de Firestore exigen lo mismo.
export function datosClienteDisponibles(
  config: { datosClienteHabilitados?: unknown; avisoOrdenVersion?: unknown } | null | undefined,
  versionOrden?: unknown,
  aviso?: AvisoOrden,
): boolean {
  if (config?.datosClienteHabilitados !== true) return false;
  if (versionOrden === undefined) return avisoOrdenListo(config.avisoOrdenVersion, aviso ?? avisoOrdenDeVersion(config.avisoOrdenVersion));
  return avisoOrdenListo(versionOrden, aviso ?? avisoOrdenDeVersion(versionOrden));
}

function formatearWhatsapp(w: unknown): string {
  const t = String(w ?? '').trim();
  const d = t.replace(/\D/g, '');
  return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : t;
}

type Taller = { nombre?: unknown; ciudad?: unknown; whatsapp?: unknown } | null | undefined;
type Orden = { folio?: unknown; creadoAt?: unknown } | null | undefined;

const aFecha = (v: unknown): Date | null => {
  if (v instanceof Date) return v;
  if (v && typeof (v as { toDate?: () => Date }).toDate === 'function') return (v as { toDate: () => Date }).toDate();
  return null;
};

// Arma las dos hojas con los datos del taller y de la orden, con el texto de la versión de la
// orden. null si esa versión no está en el archivo o no está lista (nunca se imprime un aviso que
// no corresponde).
export function armarAvisoOrden(taller: Taller, orden: Orden, version?: unknown, aviso: AvisoOrden = avisoOrdenDeVersion(version)) {
  if (!avisoOrdenListo(version, aviso)) return null;
  const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const nombre = texto(taller?.nombre) || EN_BLANCO;
  const ciudad = texto(taller?.ciudad) || EN_BLANCO;
  const whatsapp = formatearWhatsapp(taller?.whatsapp) || EN_BLANCO;
  const contacto = whatsapp === EN_BLANCO ? EN_BLANCO : `WhatsApp ${whatsapp}`;
  const recibida = aFecha(orden?.creadoAt);
  const reemplazos: [RegExp, string][] = [
    [/\[nombre del taller\]/gi, nombre],
    [/\[ciudad\]/gi, ciudad],
    [/\[whatsapp del taller\]/gi, whatsapp],
    [/\[medio de contacto del taller\]/gi, contacto],
    [/\[folio\]/gi, texto(orden?.folio) || EN_BLANCO],
    [/\[fecha de recepción\]/gi, recibida ? recibida.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : EN_BLANCO],
  ];
  // El renglón "Versión del aviso: ..." del texto no se repite en el cuerpo: el PDF ya imprime la
  // versión al pie de cada hoja (igual que el aviso de la cotización).
  const llenar = (l: Parrafo[]) => l
    .filter((p) => !(p.texto as string).startsWith('Versión del aviso:'))
    .map((p) => reemplazos.reduce((t, [marca, valor]) => t.replace(marca, valor), p.texto as string));
  const hoja = (l: Parrafo[]) => {
    const [titulo, ...parrafos] = llenar(l);
    return { titulo, parrafos };
  };
  return { version: aviso.version as string, aviso: hoja(aviso.aviso as Parrafo[]), constancia: hoja(aviso.constancia as Parrafo[]) };
}
