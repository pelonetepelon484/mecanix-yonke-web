import { estadoDeCodigoGeo } from '../../../lib/estadoGeoMapping';

// "Todos los estados" con el estado aproximado por IP (config/buscador.otrosEstadosPorIp, solo
// true exacto). La búsqueda ya trae resultados de todo el país: aquí NO se busca nada más (cero
// lecturas), solo se decide si ninguno es del estado del visitante para que la pantalla muestre
// primero la alerta y debajo esos resultados con su estado. Lógica pura, sin Firestore.
// - Estado por IP desconocido (local, extranjero, región sin traducción): no aplica.
// - Algún resultado del estado del visitante (exacto, cercano, motor...): no aplica.
// - Ninguno: agrupados por estado, sin tope, con los que NO hacen envíos nacionales al final de
//   su grupo (no se ocultan: la pantalla les pone un aviso distinto).

// Las listas de una respuesta con resultados que traen tarjetas de yonke (toResultado*).
export const LISTAS_RESULTADOS = [
  'resultados', 'resultadosCercanos',
  'resultadosMotores', 'resultadosMotoresCercanos',
  'resultadosTransmisiones', 'resultadosTransmisionesCercanos',
];

// Id de estado del visitante (esquema de yonkes: 'baja-california') o null si no se sabe.
export function estadoDelVisitante(geo) {
  if (!geo?.estado || geo.estado === 'desconocido') return null;
  return estadoDeCodigoGeo(geo.estado) || null;
}

const claveResultado = (r) => `${r.yonkeId}_${r.motorId ?? r.vehiculoId}`;

// null si no aplica; si aplica, { sinResultadosEnTuEstado, resultadosOtrosEstados }.
// respuesta: el objeto con las listas de LISTAS_RESULTADOS (cada tarjeta con estadoYonke).
export function repartoPorIp(respuesta, estadoVisitante, estados) {
  if (!estadoVisitante) return null;
  const todos = LISTAS_RESULTADOS.flatMap((l) => respuesta[l] || []);
  if (todos.length === 0 || todos.some((r) => r.estadoYonke === estadoVisitante)) return null;

  const vistos = new Set();
  const grupos = new Map();
  for (const r of todos) {
    const clave = claveResultado(r);
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    if (!grupos.has(r.estadoYonke)) {
      grupos.set(r.estadoYonke, {
        estado: r.estadoYonke,
        estadoNombre: estados.find((e) => e.id === r.estadoYonke)?.nombre || r.estadoYonke,
        resultados: [],
      });
    }
    grupos.get(r.estadoYonke).resultados.push(r);
  }
  // Con envíos nacionales primero; entre iguales, el orden de siempre (sort estable).
  for (const g of grupos.values()) {
    g.resultados.sort((a, b) => Number(b.enviosNacionales === true) - Number(a.enviosNacionales === true));
  }
  return {
    sinResultadosEnTuEstado: {
      estado: estadoVisitante,
      estadoNombre: estados.find((e) => e.id === estadoVisitante)?.nombre || estadoVisitante,
    },
    resultadosOtrosEstados: [...grupos.values()],
  };
}

// Cuando no aplica, las tarjetas salen sin estadoYonke: la respuesta queda idéntica a la de siempre.
export function sinEstadoYonke(respuesta) {
  const limpia = { ...respuesta };
  for (const l of LISTAS_RESULTADOS) {
    if (Array.isArray(limpia[l])) limpia[l] = limpia[l].map(({ estadoYonke, ...r }) => r);
  }
  return limpia;
}
