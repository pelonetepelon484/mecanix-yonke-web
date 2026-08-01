import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { dbServer } from '../firebase-server';
import { getRatingParaYonke } from '../yonkesServerData';
import { buscarVehiculosPorAnio } from '../buscarVehiculosPorAnio';

function ordenarPorPlan(lista) {
  return lista.sort((a, b) => {
    if (a.plan === 'premium' && b.plan !== 'premium') return -1;
    if (a.plan !== 'premium' && b.plan === 'premium') return 1;
    return 0;
  });
}

function sinDuplicados(lista) {
  const vistos = new Set();
  return lista.filter((r) => {
    const clave = `${r.yonkeId}_${r.vehiculoId}`;
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}

function sinDuplicadosMotor(lista) {
  const vistos = new Set();
  return lista.filter((r) => {
    const clave = `${r.yonkeId}_${r.motorId}`;
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}

// Catálogo VIVO (config/catalogoVehiculos) = modelos con inventario alguna vez registrado.
// Distinto de CATALOGO_BASE, que es el diccionario amplio usado solo para reconocer texto.
// modelo=null (búsqueda solo por marca, ej. "nissan 2015"): basta con que la marca tenga
// algún modelo vivo registrado, sin exigir uno específico.
export async function existeEnCatalogoVivo(marca, modelo) {
  const snap = await getDoc(doc(dbServer, 'config', 'catalogoVehiculos'));
  if (!snap.exists()) return false;
  const catalogo = snap.data().catalogo || {};
  const modelos = catalogo[marca];
  if (!modelos || modelos.length === 0) return false;
  if (modelo == null) return true;
  return modelos.some((m) => m.toLowerCase() === modelo.toLowerCase());
}

function toResultado(yonkeDoc, vDoc, calificacion) {
  const yonkeData = yonkeDoc.data();
  // fechaIngreso es un Timestamp de Firestore — se omite para que la respuesta sea JSON limpio.
  const { fechaIngreso, ...vehiculo } = vDoc.data();
  return {
    yonkeId: yonkeDoc.id, yonkeNombre: yonkeData.nombre, logoUrl: yonkeData.logoUrl || null,
    direccion: yonkeData.direccion,
    telefono: yonkeData.telefono, whatsapp: yonkeData.whatsapp || '',
    metodosPago: yonkeData.metodosPago || [], plan: yonkeData.plan,
    ciudad: yonkeData.ciudad || '', horario: yonkeData.horario || null,
    vehiculoId: vDoc.id, vehiculo, calificacion,
  };
}

function toResultadoMotor(yonkeDoc, mDoc, calificacion) {
  const yonkeData = yonkeDoc.data();
  const { fechaIngreso, ...motor } = mDoc.data();
  return {
    yonkeId: yonkeDoc.id, yonkeNombre: yonkeData.nombre, logoUrl: yonkeData.logoUrl || null,
    direccion: yonkeData.direccion,
    telefono: yonkeData.telefono, whatsapp: yonkeData.whatsapp || '',
    metodosPago: yonkeData.metodosPago || [], plan: yonkeData.plan,
    ciudad: yonkeData.ciudad || '', horario: yonkeData.horario || null,
    motorId: mDoc.id, motor, calificacion,
  };
}

// Motores y transmisiones sueltos viven en yonkes/{id}/motores, distinguidos por el campo
// `tipo` ('Motor' | 'Transmisión'). Mismo matching de marca/modelo/año que los vehículos
// (lib/buscarVehiculosPorAnio.js, subcolección 'motores') para que casen igual. disponible=false
// se excluye por completo (un motor suelto no tiene sub-piezas — su propio flag ES su
// disponibilidad, mismo criterio que una pieza no disponible: no se muestra como resultado).
async function buscarMotores(yonkesDocs, marca, modelo, anio) {
  const pares = await buscarVehiculosPorAnio(dbServer, yonkesDocs, marca, modelo, anio, 'motores');
  const encontrados = [];
  for (const { yonkeDoc, vDoc: mDoc } of pares) {
    if (mDoc.data().disponible === false) continue;
    const calificacion = await getRatingParaYonke(yonkeDoc.id);
    encontrados.push(toResultadoMotor(yonkeDoc, mDoc, calificacion));
  }
  return encontrados;
}

function separarPorTipo(lista) {
  return {
    motores: lista.filter((r) => r.motor.tipo === 'Motor'),
    transmisiones: lista.filter((r) => r.motor.tipo === 'Transmisión'),
  };
}

// Mismo pipeline de niveles que consultarInventarioVehiculo (exacto -> cercano ±3 -> cualquier
// año), pero sobre la subcolección 'motores'. Se llama junto con la búsqueda de vehículos —
// un motor/transmisión suelto encontrado es un resultado tan válido como una pieza.
export async function consultarMotoresTransmisiones({ marca, modelo, anio }) {
  const yonkesSnap = await getDocs(collection(dbServer, 'yonkes'));
  const yonkesDocs = yonkesSnap.docs;

  if (anio == null) {
    const todos = sinDuplicadosMotor(await buscarMotores(yonkesDocs, marca, modelo, null));
    ordenarPorPlan(todos);
    return { ...separarPorTipo(todos), tipoResultadoMotor: 'cualquierAno' };
  }

  const exactos = sinDuplicadosMotor(await buscarMotores(yonkesDocs, marca, modelo, anio));
  if (exactos.length > 0) {
    ordenarPorPlan(exactos);
    return { ...separarPorTipo(exactos), tipoResultadoMotor: 'exacto' };
  }

  const anosRango = [];
  for (let d = 1; d <= 3; d++) { anosRango.push(anio - d); anosRango.push(anio + d); }
  const listasCercanas = await Promise.all(anosRango.map((a) => buscarMotores(yonkesDocs, marca, modelo, a)));
  const cercanos = sinDuplicadosMotor(listasCercanas.flat());
  if (cercanos.length > 0) {
    ordenarPorPlan(cercanos);
    return { ...separarPorTipo(cercanos), tipoResultadoMotor: 'cercano' };
  }

  const cualquierAno = sinDuplicadosMotor(await buscarMotores(yonkesDocs, marca, modelo, null));
  ordenarPorPlan(cualquierAno);
  return { ...separarPorTipo(cualquierAno), tipoResultadoMotor: 'cualquierAno' };
}

// modelo=null: cualquier modelo de esa marca (búsqueda solo por marca, ej. "nissan 2015").
// El matching en sí (marca/modelo/año contra las subcolecciones de vehiculos) vive en
// lib/buscarVehiculosPorAnio.js, compartido con el buscador manual (page.js) — si cambia
// cómo se compara marca/modelo, cambia para los dos. Aquí solo se agrega calificación y
// se da forma al resultado (con fechaIngreso removido, porque esto cruza a JSON en /api/buscar).
async function buscarVehiculos(yonkesDocs, marca, modelo, anio) {
  const pares = await buscarVehiculosPorAnio(dbServer, yonkesDocs, marca, modelo, anio);
  const encontrados = [];
  for (const { yonkeDoc, vDoc } of pares) {
    const calificacion = await getRatingParaYonke(yonkeDoc.id);
    encontrados.push(toResultado(yonkeDoc, vDoc, calificacion));
  }
  return encontrados;
}

function normalizarPalabras(texto) {
  return (texto || '').toLowerCase().split(/\s+/).filter(Boolean);
}

// Match por subconjunto de palabras, no igualdad exacta: así "Parachoques" (extraído sin
// lado especificado) encuentra tanto "Parachoques delantero" como "Parachoques trasero".
function piezaCoincide(piezaBuscada, nombreInventario) {
  const palabrasBuscada = normalizarPalabras(piezaBuscada);
  const palabrasInventario = new Set(normalizarPalabras(nombreInventario));
  return palabrasBuscada.length > 0 && palabrasBuscada.every((p) => palabrasInventario.has(p));
}

async function tienePiezaDisponible(yonkeId, vehiculoId, pieza) {
  const piezasRef = collection(dbServer, 'yonkes', yonkeId, 'vehiculos', vehiculoId, 'piezas');
  const snap = await getDocs(piezasRef);
  return snap.docs.some((pDoc) => {
    const data = pDoc.data();
    return data.disponible && piezaCoincide(pieza, data.nombre);
  });
}

// Busca vehículos para marca/modelo/año (o cualquier año si anio es null) y separa
// los que confirman la pieza disponible de los que solo confirman el vehículo.
async function buscarConSplitDePieza(yonkesDocs, marca, modelo, anio, pieza) {
  const encontrados = await buscarVehiculos(yonkesDocs, marca, modelo, anio);
  const conPieza = [];
  const soloVehiculo = [];
  for (const r of encontrados) {
    const tiene = await tienePiezaDisponible(r.yonkeId, r.vehiculoId, pieza);
    if (tiene) conPieza.push(r); else soloVehiculo.push(r);
  }
  ordenarPorPlan(conPieza);
  ordenarPorPlan(soloVehiculo);
  return { conPieza, soloVehiculo };
}

// Paso 3: mismo pipeline de niveles que buscarPiezas/buscarEnAnos/buscarCualquierAno en
// page.js, pero server-side con dbServer. Devuelve { resultados, tipoResultado, piezaNoEncontrada }.
export async function consultarInventario({ marca, modelo, anio, pieza }) {
  const yonkesSnap = await getDocs(collection(dbServer, 'yonkes'));
  const yonkesDocs = yonkesSnap.docs;

  // Sin año extraído del texto: buscamos en cualquier año directamente (mejor UX que
  // rechazar la búsqueda solo por faltar el dato), igual separando por disponibilidad de pieza.
  if (anio == null) {
    const { conPieza, soloVehiculo } = await buscarConSplitDePieza(yonkesDocs, marca, modelo, null, pieza);
    if (conPieza.length > 0) {
      return { resultados: conPieza, tipoResultado: 'cualquierAno', piezaNoEncontrada: false };
    }
    if (soloVehiculo.length > 0) {
      return { resultados: soloVehiculo, tipoResultado: 'cualquierAno', piezaNoEncontrada: true };
    }
    return { resultados: [], tipoResultado: 'cualquierAno', piezaNoEncontrada: false };
  }

  // Nivel 1: año exacto.
  const { conPieza, soloVehiculo } = await buscarConSplitDePieza(yonkesDocs, marca, modelo, anio, pieza);
  if (conPieza.length > 0) {
    return { resultados: conPieza, tipoResultado: 'exacto', piezaNoEncontrada: false };
  }
  if (soloVehiculo.length > 0) {
    return { resultados: soloVehiculo, tipoResultado: 'exacto', piezaNoEncontrada: true };
  }

  // Nivel 2: años cercanos ±3, mismo marca/modelo (sin filtrar por pieza específica).
  // Los 6 años se consultan EN PARALELO (Promise.all), no uno por uno — page.js hace lo
  // mismo para su nivel "cercano" (vía buscarVehiculosEnAniosParalelo en
  // lib/buscarVehiculosPorAnio.js). Si se cambia esta paralelización aquí, replicarlo allá.
  const anosRango = [];
  for (let d = 1; d <= 3; d++) { anosRango.push(anio - d); anosRango.push(anio + d); }
  const listasCercanas = await Promise.all(
    anosRango.map((a) => buscarVehiculos(yonkesDocs, marca, modelo, a))
  );
  const cercanos = sinDuplicados(listasCercanas.flat());
  if (cercanos.length > 0) {
    ordenarPorPlan(cercanos);
    return { resultados: cercanos, tipoResultado: 'cercano', piezaNoEncontrada: false };
  }

  // Nivel 3: cualquier año, mismo marca/modelo.
  const cualquierAno = sinDuplicados(await buscarVehiculos(yonkesDocs, marca, modelo, null));
  ordenarPorPlan(cualquierAno);
  return { resultados: cualquierAno, tipoResultado: 'cualquierAno', piezaNoEncontrada: false };
}

// Búsqueda de solo vehículo (sin pieza): el usuario quiere ver todo el inventario
// disponible para esa marca/modelo/año, no una pieza en particular. Mismo pipeline de
// niveles (exacto -> cercano ±3 -> cualquier año), pero sin separar por disponibilidad
// de pieza — regresa directamente los vehículos encontrados en el primer nivel con resultados.
export async function consultarInventarioVehiculo({ marca, modelo, anio }) {
  const yonkesSnap = await getDocs(collection(dbServer, 'yonkes'));
  const yonkesDocs = yonkesSnap.docs;

  if (anio == null) {
    const resultados = sinDuplicados(await buscarVehiculos(yonkesDocs, marca, modelo, null));
    ordenarPorPlan(resultados);
    return { resultados, tipoResultado: 'cualquierAno' };
  }

  // Nivel 1: año exacto.
  const exactos = sinDuplicados(await buscarVehiculos(yonkesDocs, marca, modelo, anio));
  if (exactos.length > 0) {
    ordenarPorPlan(exactos);
    return { resultados: exactos, tipoResultado: 'exacto' };
  }

  // Nivel 2: años cercanos ±3. En paralelo (Promise.all), no uno por uno — ver nota
  // equivalente en consultarInventario() sobre buscarVehiculosEnAniosParalelo en page.js.
  const anosRango = [];
  for (let d = 1; d <= 3; d++) { anosRango.push(anio - d); anosRango.push(anio + d); }
  const listasCercanas = await Promise.all(anosRango.map((a) => buscarVehiculos(yonkesDocs, marca, modelo, a)));
  const cercanos = sinDuplicados(listasCercanas.flat());
  if (cercanos.length > 0) {
    ordenarPorPlan(cercanos);
    return { resultados: cercanos, tipoResultado: 'cercano' };
  }

  // Nivel 3: cualquier año.
  const cualquierAno = sinDuplicados(await buscarVehiculos(yonkesDocs, marca, modelo, null));
  ordenarPorPlan(cualquierAno);
  return { resultados: cualquierAno, tipoResultado: 'cualquierAno' };
}
