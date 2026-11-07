// Solo servidor. NHTSA vPIC (servicio público y gratuito de EE. UU.), DecodeVinValues. Se manda la
// clave del VIN SIN número de serie (ver claveVin en lib/comparadorPiezas.js), con 8 segundos de
// espera como máximo.
// Devuelve { estado: 'ok', fila } | { estado: 'sin_datos' } | { estado: 'fallo' } (red, tiempo o
// respuesta rara: no se guarda en caché y la consulta se le devuelve al usuario).
import { claveVinValida } from '../../../lib/comparadorPiezas';

const BASE = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/';
const TIEMPO_MAXIMO_MS = 8000;

export async function decodificarVpic(clave, fetchFn = fetch) {
  if (!claveVinValida(clave)) return { estado: 'sin_datos' };
  try {
    const r = await fetchFn(`${BASE}${clave}?format=json`, { signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS), cache: 'no-store' });
    if (!r.ok) return { estado: 'fallo' };
    const json = await r.json();
    const fila = Array.isArray(json?.Results) ? json.Results[0] : null;
    if (!fila || typeof fila !== 'object') return { estado: 'fallo' };
    return { estado: 'ok', fila };
  } catch (error) {
    console.warn('[comparador] vPIC no respondió', error?.name || error?.message);
    return { estado: 'fallo' };
  }
}
