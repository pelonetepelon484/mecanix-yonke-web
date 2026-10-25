import { collection, getDocs } from 'firebase/firestore';
import { dbServer } from '../firebase-server';
import { estadoDeYonke, obtenerEstadosCombinado } from './estadosServer';
import { esPremiumVigente } from '../../../lib/planes';
import { otrosEstadosSinResultadosServer, scrollOtrosEstadosServer } from './configBuscadorServer';
import {
  consultarInventarioEnYonkes, consultarInventarioVehiculoEnYonkes, consultarMotoresTransmisionesEnYonkes,
} from './consultarInventario';

// Resultados de OTROS estados cuando no hay nada en el del cliente (config/buscador.
// otrosEstadosSinResultados, solo true exacto). Solo cuando el cliente eligió un estado: con
// "Todos los estados" la búsqueda ya cubre todo el país y esto no aplica. Yonkes activos y
// Verificados de un estado distinto al del cliente, con o sin Envíos nacionales: los que envían
// van primero y los que no, al final de su estado (la pantalla les pone "no anuncia envíos").
// Misma búsqueda y mismo rango de años que el buscador. Se revisan TODOS esos yonkes (antes, 8:
// dejaba fuera a yonkes con el vehículo, ej. el motor de Yaris de El Patos); lecturas como una
// búsqueda con "Todos los estados", solo cuando en el estado del cliente no hubo nada.
// Límites: 12 resultados; si tarda más de 6 s o falla, se omite (null) sin bloquear la
// respuesta. Sin índices ni reglas nuevas (todo es público).

export const MAX_YONKES_OTROS_ESTADOS = Infinity;
export const MAX_RESULTADOS_OTROS_ESTADOS = 12;
export const TIEMPO_LIMITE_OTROS_ESTADOS_MS = 6000;
// Yonkes que se revisan a la vez (de uno en uno tardaba ~10 s con ~30 yonkes). Pocos a la vez a
// propósito: con cientos de lecturas simultáneas el SDK en el servidor llegó a regresar vacío
// (ver firebase-server.js).
export const YONKES_EN_PARALELO = 5;

// Corre buscar() por grupos de `n` yonkes a la vez y junta las listas en el orden de los yonkes.
async function buscarPorGrupos(yonkesDocs, consulta, buscar, n = YONKES_EN_PARALELO) {
  const listas = [];
  for (let i = 0; i < yonkesDocs.length; i += n) {
    const grupo = yonkesDocs.slice(i, i + n);
    listas.push(...await Promise.all(grupo.map((d) => buscar([d], consulta))));
  }
  return listas.flat();
}

// Año de una tarjeta (vehículo o motor) para ordenar: el año buscado primero, luego los cercanos.
const distanciaAnio = (r, anio) => {
  const a = Number(r?.vehiculo?.ano ?? r?.motor?.ano);
  return anio == null || Number.isNaN(a) ? 0 : Math.abs(a - anio);
};

// Yonkes de otros estados que pueden entrar: activos, Verificados y de un estado distinto al del
// cliente (sin estado = Baja California, igual que en todo el sistema), con o sin envíos.
export function yonkesElegiblesOtrosEstados(yonkesDocs, estadoCliente, max = MAX_YONKES_OTROS_ESTADOS) {
  return yonkesDocs
    .filter((d) => {
      const y = d.data();
      return y.activo === true && y.verificado === true && estadoDeYonke(y) !== estadoCliente;
    })
    // Con Envíos nacionales primero, luego Premium vigente; entre iguales, el orden de siempre.
    .map((d, i) => ({ d, i, envios: d.data().enviosNacionales === true, premium: esPremiumVigente(d.data()) }))
    .sort((a, b) => Number(b.envios) - Number(a.envios) || Number(b.premium) - Number(a.premium) || a.i - b.i)
    .slice(0, max)
    .map(({ d }) => d);
}

const claveResultado = (r) => `${r.yonkeId}_${r.motorId ?? r.vehiculoId}`;

// Lista plana sin repetidos y con el tope, agrupada por estado en el orden en que aparecen.
// estadoPorYonke: Map yonkeId -> id de estado; estados: [{ id, nombre }].
export function agruparPorEstado(lista, estadoPorYonke, estados, max = MAX_RESULTADOS_OTROS_ESTADOS) {
  const vistos = new Set();
  const unicos = [];
  // Los que envían primero (orden estable): los que no, solo llenan lo que sobre del tope y quedan
  // al final de su estado.
  const ordenada = [...lista].sort((a, b) => Number(b.enviosNacionales === true) - Number(a.enviosNacionales === true));
  for (const r of ordenada) {
    const clave = claveResultado(r);
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    unicos.push(r);
    if (unicos.length >= max) break;
  }
  const grupos = new Map();
  for (const r of unicos) {
    const estado = estadoPorYonke.get(r.yonkeId);
    if (!grupos.has(estado)) {
      grupos.set(estado, { estado, estadoNombre: estados.find((e) => e.id === estado)?.nombre || estado, resultados: [] });
    }
    grupos.get(estado).resultados.push(r);
  }
  return {
    grupos: [...grupos.values()],
    yonkeIds: [...new Set(unicos.map((r) => r.yonkeId))],
    mostrados: unicos.length,
  };
}

// Corre la misma búsqueda que el buscador sobre los yonkes elegibles. Con pieza: solo piezas
// confirmadas (no "vehículo completo sin la pieza registrada": para un envío hay que saber que la
// pieza está) más motores/transmisiones; sin pieza: los vehículos. Exactos antes que cercanos.
async function buscarEnYonkes(yonkesDocs, { marca, modelo, anio, pieza, cilindrada = null, rango = null }) {
  const esMotorPorCilindrada = cilindrada != null && (pieza === 'Motor' || pieza === 'Transmisión');
  const [inventario, motores] = await Promise.all([
    esMotorPorCilindrada ? null
      : pieza ? consultarInventarioEnYonkes(yonkesDocs, { marca, modelo, anio, pieza, cilindrada, rango })
        : consultarInventarioVehiculoEnYonkes(yonkesDocs, { marca, modelo, anio, rango }),
    consultarMotoresTransmisionesEnYonkes(yonkesDocs, { marca, modelo, anio, cilindrada, rango }),
  ]);
  const deInventario = inventario && !(pieza && inventario.piezaNoEncontrada)
    ? [...inventario.resultados, ...inventario.resultadosCercanos] : [];
  return [
    ...deInventario,
    ...motores.motores, ...motores.transmisiones, ...motores.motoresCercanos, ...motores.transmisionesCercanos,
  ];
}

// null si se pasó del tiempo o falló; si no, { grupos, yonkeIds, mostrados } (mostrados puede ser 0).
export async function buscarEnOtrosEstados(consulta, {
  leerYonkes = async () => (await getDocs(collection(dbServer, 'yonkes'))).docs,
  leerEstados = obtenerEstadosCombinado,
  buscar = buscarEnYonkes,
  tiempoLimiteMs = TIEMPO_LIMITE_OTROS_ESTADOS_MS,
} = {}) {
  const trabajo = (async () => {
    const elegibles = yonkesElegiblesOtrosEstados(await leerYonkes(), consulta.estadoCliente);
    if (elegibles.length === 0) return { grupos: [], yonkeIds: [], mostrados: 0 };
    const [porYonke, estados] = await Promise.all([buscarPorGrupos(elegibles, consulta, buscar), leerEstados()]);
    const lista = [...porYonke].sort((a, b) => distanciaAnio(a, consulta.anio) - distanciaAnio(b, consulta.anio));
    const estadoPorYonke = new Map(elegibles.map((d) => [d.id, estadoDeYonke(d.data())]));
    return agruparPorEstado(lista, estadoPorYonke, estados);
  })();
  let reloj;
  const limite = new Promise((resolve) => { reloj = setTimeout(() => resolve(null), tiempoLimiteMs); });
  try {
    const r = await Promise.race([trabajo, limite]);
    if (r === null) console.warn('[buscar] Otros estados: se pasó del tiempo, se omite');
    return r;
  } catch (error) {
    console.error('[buscar] Otros estados: falló, se omite', { code: error?.code, message: error?.message });
    return null;
  } finally {
    clearTimeout(reloj);
    trabajo.catch(() => {}); // si ganó el tiempo límite, que un error tardío no quede suelto
  }
}

// Para /api/buscar: null si NO aplica (bandera apagada o "Todos los estados"), y entonces la
// respuesta y el registro quedan idénticos a los de siempre. Si aplica, siempre devuelve
// { grupos, yonkeIds, mostrados } (vacío si no hubo nada) y, si tardó o falló, omitido: true.
export async function otrosEstadosSiAplica(estadoFiltro, consulta, deps = {}) {
  if (!estadoFiltro || estadoFiltro === 'todos') return null;
  const activa = await (deps.banderaActiva ?? otrosEstadosSinResultadosServer)();
  if (!activa) return null;
  return (await buscarEnOtrosEstados({ ...consulta, estadoCliente: estadoFiltro }, deps))
    ?? { grupos: [], yonkeIds: [], mostrados: 0, omitido: true };
}

// Lo que se agrega a la respuesta: resultadosOtrosEstados solo si hay algo que mostrar, y
// otrosEstadosRevisados cuando la búsqueda en otros estados sí se hizo (aunque no encontrara nada):
// la pantalla ya no ofrece el botón "Buscar en todos los estados". Si se cortó por tiempo o falló,
// no se marca y el botón sigue. Sin la bandera, nada (respuesta de siempre).
// scroll: con config/buscador.scrollOtrosEstados (ver hayScrollOtrosEstados), y solo si hay tarjetas
// de otros estados, la portada se desplaza una vez hacia esa sección (scrollOtrosEstados: true).
export function camposRespuestaOtrosEstados(otros, { scroll = false } = {}) {
  if (!otros) return {};
  return {
    ...(otros.omitido ? {} : { otrosEstadosRevisados: true }),
    ...(otros.mostrados > 0 ? { resultadosOtrosEstados: otros.grupos } : {}),
    ...(otros.mostrados > 0 && scroll === true ? { scrollOtrosEstados: true } : {}),
  };
}

// ¿Pedir el scroll? Solo lee la bandera (con caché de 1 minuto) cuando hay tarjetas de otros estados.
// Sin el campo, con otro valor o si la lectura falla: false.
export async function hayScrollOtrosEstados(otros, { bandera = scrollOtrosEstadosServer } = {}) {
  if (!(otros?.mostrados > 0)) return false;
  try {
    return (await bandera()) === true;
  } catch {
    return false;
  }
}

// Lo que se agrega a registrarBusqueda: solo si la función aplicó (aunque no hubiera nada).
export function camposRegistroOtrosEstados(otros) {
  return otros ? { otrosEstados: { mostrados: otros.mostrados, yonkeIds: otros.yonkeIds } } : {};
}
