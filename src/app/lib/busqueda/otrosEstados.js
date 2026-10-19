import { collection, getDocs } from 'firebase/firestore';
import { dbServer } from '../firebase-server';
import { estadoDeYonke, obtenerEstadosCombinado } from './estadosServer';
import { puedeVerOtrosEstados } from '../../../lib/pedidosClientes';
import { esPremiumVigente } from '../../../lib/planes';
import { otrosEstadosSinResultadosServer } from './configBuscadorServer';
import {
  consultarInventarioEnYonkes, consultarInventarioVehiculoEnYonkes, consultarMotoresTransmisionesEnYonkes,
} from './consultarInventario';

// Resultados de OTROS estados cuando no hay nada en el del cliente (config/buscador.
// otrosEstadosSinResultados, solo true exacto). Solo cuando el cliente eligió un estado: con
// "Todos los estados" la búsqueda ya cubre todo el país y esto no aplica. Solo yonkes activos,
// Verificados y con Envíos nacionales (el mismo criterio de las alertas a otros estados) de un
// estado distinto al del cliente; misma búsqueda y mismo rango de años que el buscador.
// Límites: 8 yonkes revisados (Premium primero) y 6 resultados; si tarda más de 3 s o falla, se
// omite (null) sin bloquear la respuesta. Lecturas extra: la lista de yonkes (1 por yonke) más las
// consultas por año de esos 8 yonkes como máximo. Sin índices ni reglas nuevas (todo es público).

export const MAX_YONKES_OTROS_ESTADOS = 8;
export const MAX_RESULTADOS_OTROS_ESTADOS = 6;
export const TIEMPO_LIMITE_OTROS_ESTADOS_MS = 3000;

// Yonkes de otros estados que pueden entrar: activos, Verificados, con Envíos nacionales y de un
// estado distinto al del cliente (sin estado = Baja California, igual que en todo el sistema).
export function yonkesElegiblesOtrosEstados(yonkesDocs, estadoCliente, max = MAX_YONKES_OTROS_ESTADOS) {
  return yonkesDocs
    .filter((d) => {
      const y = d.data();
      return puedeVerOtrosEstados({ habilitado: true, otrosEstados: true }, y) && estadoDeYonke(y) !== estadoCliente;
    })
    // Premium vigente primero; entre iguales, el orden de siempre.
    .map((d, i) => ({ d, i, premium: esPremiumVigente(d.data()) }))
    .sort((a, b) => Number(b.premium) - Number(a.premium) || a.i - b.i)
    .slice(0, max)
    .map(({ d }) => d);
}

const claveResultado = (r) => `${r.yonkeId}_${r.motorId ?? r.vehiculoId}`;

// Lista plana sin repetidos y con el tope, agrupada por estado en el orden en que aparecen.
// estadoPorYonke: Map yonkeId -> id de estado; estados: [{ id, nombre }].
export function agruparPorEstado(lista, estadoPorYonke, estados, max = MAX_RESULTADOS_OTROS_ESTADOS) {
  const vistos = new Set();
  const unicos = [];
  for (const r of lista) {
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
    const [lista, estados] = await Promise.all([buscar(elegibles, consulta), leerEstados()]);
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
// { grupos, yonkeIds, mostrados } (vacío si no hubo nada, si tardó o si falló).
export async function otrosEstadosSiAplica(estadoFiltro, consulta, deps = {}) {
  if (!estadoFiltro || estadoFiltro === 'todos') return null;
  const activa = await (deps.banderaActiva ?? otrosEstadosSinResultadosServer)();
  if (!activa) return null;
  return (await buscarEnOtrosEstados({ ...consulta, estadoCliente: estadoFiltro }, deps))
    ?? { grupos: [], yonkeIds: [], mostrados: 0 };
}

// Lo que se agrega a la respuesta: solo si hay algo que mostrar.
export function camposRespuestaOtrosEstados(otros) {
  return otros && otros.mostrados > 0 ? { resultadosOtrosEstados: otros.grupos } : {};
}

// Lo que se agrega a registrarBusqueda: solo si la función aplicó (aunque no hubiera nada).
export function camposRegistroOtrosEstados(otros) {
  return otros ? { otrosEstados: { mostrados: otros.mostrados, yonkeIds: otros.yonkeIds } } : {};
}
