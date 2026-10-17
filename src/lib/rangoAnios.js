// Rango de años del buscador (config/buscador). Solo true exacto en `rangoAniosCorto` enciende
// el rango corto; sin el documento o con otro valor, todo como siempre: año exacto, años cercanos
// ±4 y, si no hay nada, "cualquier año". Encendido:
//   1. año exacto;
//   2. años cercanos ±rangoAnios (2 si no existe el campo; de 1 a 4), del más cercano al más lejano
//      y, en empate, primero el año anterior (2016 -> 2015, 2017, 2014, 2018); dentro del mismo
//      año, Premium primero;
//   3. NADA fuera del rango (sin "cualquier año"): si no queda nada, es "sin resultados".
// Sin año escrito (solo "crv") se sigue buscando en todos los años. Lógica pura, sin Firestore:
// la usan el buscador con IA (servidor) y la búsqueda avanzada (navegador).

export const RANGO_ANIOS_POR_OMISION = 2;
export const RANGO_ANIOS_MAXIMO = 4;
// El rango de siempre (bandera apagada).
export const RANGO_ANIOS_ANTERIOR = 4;

export function normalizarRango(valor) {
  return Number.isInteger(valor) && valor >= 1 && valor <= RANGO_ANIOS_MAXIMO ? valor : RANGO_ANIOS_POR_OMISION;
}

// Rango a usar, o null si la bandera está apagada (comportamiento de siempre).
export function rangoDeConfig(config) {
  return config?.rangoAniosCorto === true ? normalizarRango(config?.rangoAnios) : null;
}

// Años cercanos (sin el exacto), del más cercano al más lejano; en empate, el anterior primero.
export function aniosCercanos(anio, rango) {
  const anios = [];
  for (let d = 1; d <= rango; d++) anios.push(anio - d, anio + d);
  return anios;
}

// Los mismos años que se usaban con la bandera apagada (±4, en el orden de siempre).
export function aniosCercanosAnteriores(anio) {
  return aniosCercanos(anio, RANGO_ANIOS_ANTERIOR);
}

// Año de un resultado: vehículo o pieza suelta (r.vehiculo.ano) o motor/transmisión (r.motor.ano).
export function anioDeResultado(r) {
  const a = r?.vehiculo?.ano ?? r?.motor?.ano;
  const n = typeof a === 'number' ? a : parseInt(a, 10);
  return Number.isNaN(n) ? null : n;
}

// Orden de los años cercanos: distancia al año buscado, en empate el año anterior primero y,
// dentro del mismo año, Premium primero (la cercanía va antes que el plan). No cambia la lista.
export function ordenarPorCercania(lista, anio, esPremium = (r) => r?.plan === 'premium') {
  const clave = (r) => {
    const a = anioDeResultado(r);
    return a === null ? [Infinity, 1] : [Math.abs(a - anio), a < anio ? 0 : 1];
  };
  return [...lista].sort((x, y) => {
    const [dx, lx] = clave(x);
    const [dy, ly] = clave(y);
    if (dx !== dy) return dx - dy;
    if (lx !== ly) return lx - ly;
    return Number(esPremium(y)) - Number(esPremium(x));
  });
}
