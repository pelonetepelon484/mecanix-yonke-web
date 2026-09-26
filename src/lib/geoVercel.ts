// Estado/ciudad (México) del visitante a partir de los headers de geolocalización que Vercel
// inyecta en cada request del edge (x-vercel-ip-country, x-vercel-ip-country-region,
// x-vercel-ip-city). Reemplaza a la consulta HTTP a ip-api.com: la IP del visitante ya no sale de
// nuestra infraestructura hacia ningún tercero. Funciones puras, sin acceso a Request ni a red.
//
// Los ids devueltos son el mismo esquema de 3 letras minúsculas (ISO 3166-2:MX) que ya usa
// estadoGeografico y el mapa de búsquedas (@svg-maps/mexico), así que los datos nuevos son
// compatibles con los históricos.

const REGIONES_VALIDAS = new Set([
  'agu', 'bcn', 'bcs', 'cam', 'chp', 'chh', 'coa', 'col', 'cmx', 'dur',
  'gua', 'gro', 'hid', 'jal', 'mex', 'mic', 'mor', 'nay', 'nle', 'oax',
  'pue', 'que', 'roo', 'slp', 'sin', 'son', 'tab', 'tam', 'tla', 'ver', 'yuc', 'zac',
]);

// Código antiguo de la Ciudad de México en algunas bases de geolocalización.
const ALIAS_REGION: Record<string, string> = { dif: 'cmx' };

export interface GeoVisitante {
  estado: string; // id de estado (ej. 'bcn') o 'desconocido'
  ciudad: string | null;
  pais: string | null; // ISO 3166-1 alpha-2 en mayúsculas, o null si no llegó el header
}

export interface HeadersGeoVercel {
  country?: string | null;
  region?: string | null;
  city?: string | null;
}

// Vercel manda la ciudad codificada como URL (ej. "Ciudad%20de%20M%C3%A9xico").
function decodificarCiudad(city: string | null | undefined): string | null {
  if (!city) return null;
  try {
    const decodificada = decodeURIComponent(city).trim();
    return decodificada ? decodificada.slice(0, 100) : null;
  } catch {
    return null;
  }
}

// Nunca lanza. Solo resuelve estado/ciudad si el país es MX y la región es reconocida; en
// cualquier otro caso estado='desconocido' (mismo contrato que tenía resolverGeoIp). En local
// (npm run dev) los headers no existen y todo cae a desconocido/null.
export function geoDesdeHeadersVercel({ country, region, city }: HeadersGeoVercel): GeoVisitante {
  const pais = country ? country.trim().toUpperCase() || null : null;
  const regionNorm = (region ?? '').trim().toLowerCase();
  const regionId = ALIAS_REGION[regionNorm] ?? regionNorm;
  if (pais === 'MX' && REGIONES_VALIDAS.has(regionId)) {
    return { estado: regionId, ciudad: decodificarCiudad(city), pais };
  }
  return { estado: 'desconocido', ciudad: null, pais };
}
