// Navegador. Pide al servidor la promoción de Premium gratis justo después del registro del
// taller. Cada intento espera hasta 10 segundos; si falla (red, tiempo o respuesta de error), se
// reintenta UNA vez. NUNCA lanza: si no hay promoción, el registro sigue normal como Básico.
// Devuelve { otorgada, motivo?, premiumHasta? }.
export const TIEMPO_POR_INTENTO_MS = 10_000;
const INTENTOS = 2;

export async function pedirPremiumGratis({ obtenerToken, fetchFn = fetch, tiempoMs = TIEMPO_POR_INTENTO_MS } = {}) {
  let ultimo = { otorgada: false, motivo: 'sinRespuesta' };
  for (let intento = 0; intento < INTENTOS; intento++) {
    try {
      const token = await obtenerToken();
      if (!token) return { otorgada: false, motivo: 'sinSesion' };
      const r = await fetchFn('/api/talleres/premium-gratis', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(tiempoMs),
      });
      const datos = await r.json().catch(() => null);
      if (r.ok && datos) return { otorgada: datos.otorgada === true, motivo: datos.motivo, premiumHasta: datos.premiumHasta };
      ultimo = { otorgada: false, motivo: datos?.motivo || `http${r.status}` };
    } catch (error) {
      ultimo = { otorgada: false, motivo: error?.name === 'TimeoutError' ? 'tiempo' : 'red' };
    }
  }
  return ultimo;
}
