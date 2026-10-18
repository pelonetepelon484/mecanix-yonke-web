// "Origen por país" del panel de búsquedas. Las tres tarjetas se cuentan sobre la MISMA base: todas
// las búsquedas guardadas, sin el corte de datos confiables. México y Fuera de México se cuentan
// con pais == 'MX' / pais != 'MX', que no pueden llevar el corte sin índices nuevos (pais + fecha).
// Desconocido = las que no tienen país (sobre todo las de antes de capturarlo). El porcentaje de
// cada una es sobre la suma de las tres, así que ninguna pasa de 100%.
// Antes el denominador era el "Total de búsquedas" CON el corte (otra base): con más búsquedas de
// México que búsquedas desde el corte, salía más de 100% y Desconocido quedaba en 0 por la resta.
export function origenPorPais({ totalHistorico, totalMx, totalFueraDeMexico }) {
  const mx = Math.max(0, totalMx || 0);
  const fuera = Math.max(0, totalFueraDeMexico || 0);
  const desconocido = Math.max(0, (totalHistorico || 0) - mx - fuera);
  const base = mx + fuera + desconocido;
  const pct = (n) => (base > 0 ? Math.round((n / base) * 100) : 0);
  return {
    base,
    mexico: { valor: mx, pct: pct(mx) },
    fuera: { valor: fuera, pct: pct(fuera) },
    desconocido: { valor: desconocido, pct: pct(desconocido) },
  };
}
