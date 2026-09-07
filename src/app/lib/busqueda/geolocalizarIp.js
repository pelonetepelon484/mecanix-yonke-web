// Resuelve estado/ciudad (México) a partir de la IP del request, para el "Mapa de búsquedas"
// (spec: qué piezas se buscan y en dónde). Decisión de negocio: sin GPS del navegador — ver
// spec sección 2. Usa ip-api.com (gratis, HTTP-only en el plan free) con timeout corto y caché
// en memoria por instancia de servidor, mismo patrón que estadosServer.js (TTL en memoria, no
// hace falta más para este volumen).
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — el estado/ciudad de una IP no cambia en el corto plazo.
const TIMEOUT_MS = 1500; // no debe alargar de forma perceptible la respuesta de /api/buscar.

const cache = new Map(); // clave: IP truncada a /24 (ver claveCache) -> { valor, expiraEn }

function claveCache(ip) {
  const partes = ip.split('.');
  return partes.length === 4 ? `${partes[0]}.${partes[1]}.${partes[2]}` : ip;
}

function esIpPrivadaOInvalida(ip) {
  if (!ip || ip === 'unknown') return true;
  if (ip === '127.0.0.1' || ip === '::1') return true;
  if (/^10\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
  return false;
}

// ip-api.com devuelve `region` como el código ISO 3166-2:MX de 3 letras (ej. "YUC", "CMX",
// "NLE") — verificado en vivo contra rangos mexicanos reales. Ese es EXACTAMENTE el mismo
// esquema de ids que usa @svg-maps/mexico (agu, bcn, ..., zac, en minúsculas) para el mapa
// (ver admin/busquedas/mapa/page.js), así que no hace falta ningún diccionario de nombres:
// basta con pasar `region` a minúsculas.
const REGIONES_VALIDAS = new Set([
  'agu', 'bcn', 'bcs', 'cam', 'chp', 'chh', 'coa', 'col', 'cmx', 'dur',
  'gua', 'gro', 'hid', 'jal', 'mex', 'mic', 'mor', 'nay', 'nle', 'oax',
  'pue', 'que', 'roo', 'slp', 'sin', 'son', 'tab', 'tam', 'tla', 'ver', 'yuc', 'zac',
]);

// Nunca lanza — una falla de geolocalización no debe tumbar ni retrasar de más la búsqueda.
// Devuelve 'desconocido' si la IP es privada/inválida, el servicio falla, da timeout, o la
// IP no resuelve a un estado mexicano reconocido (el mapa es de México, ver spec sección 3).
export async function resolverGeoIp(ip) {
  if (esIpPrivadaOInvalida(ip)) return { estado: 'desconocido', ciudad: null };

  const clave = claveCache(ip);
  const ahora = Date.now();
  const enCache = cache.get(clave);
  if (enCache && enCache.expiraEn > ahora) return enCache.valor;

  let resultado = { estado: 'desconocido', ciudad: null };
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const resp = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode,region,city`,
      { signal: controller.signal },
    );
    clearTimeout(timeoutId);
    const data = await resp.json();
    const region = (data.region || '').toLowerCase();
    if (data.status === 'success' && data.countryCode === 'MX' && REGIONES_VALIDAS.has(region)) {
      resultado = { estado: region, ciudad: data.city || null };
    }
  } catch (error) {
    console.error('[geolocalizarIp] No se pudo resolver geolocalización por IP', {
      ip, message: error?.message,
    });
  }

  cache.set(clave, { valor: resultado, expiraEn: ahora + CACHE_TTL_MS });
  return resultado;
}
