import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { dbServer } from '../firebase-server';
import { getRatingParaYonke } from '../yonkesServerData';
import { buscarVehiculosPorAnio } from '../buscarVehiculosPorAnio';
import { estadoDeYonke } from './estadosServer';
import { cilindradaCoincide } from './cilindrada';

// Filtro de estado, opcional y aditivo: sin `estado` (o 'todos') se devuelven TODOS los yonkes,
// idéntico al comportamiento de siempre — ningún llamador existente cambia de resultado. Con un
// estado específico, se filtra por estadoDeYonke() (ausente = Baja California, ver lib/estados.js)
// y se marca `sinYonkesEnEstado` cuando ese estado no tiene NINGÚN yonke — distinto de "tiene
// yonkes pero ninguno con esta pieza/vehículo", que sigue el pipeline normal de niveles.
function filtrarPorEstado(yonkesDocsTodos, estado) {
  if (!estado || estado === 'todos') {
    return { yonkesDocs: yonkesDocsTodos, sinYonkesEnEstado: false };
  }
  const yonkesDocs = yonkesDocsTodos.filter((d) => estadoDeYonke(d.data()) === estado);
  return { yonkesDocs, sinYonkesEnEstado: yonkesDocs.length === 0 };
}

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

// Años cercanos ±4 al año buscado — el rango nunca incluye el año exacto (d va de 1 a 4), así
// que no hace falta excluirlo aparte para no duplicar. Los 8 años se consultan EN PARALELO
// (Promise.all), no uno por uno. Compartido por vehículos y motores/transmisiones para no
// arreglar el mismo bug de "cercanos excluyentes" en dos lugares que luego se desincronizan.
async function buscarAniosCercanos(buscarUnAnio, anio, dedupe) {
  const anosRango = [];
  for (let d = 1; d <= 4; d++) { anosRango.push(anio - d); anosRango.push(anio + d); }
  const listas = await Promise.all(anosRango.map((a) => buscarUnAnio(a)));
  const cercanos = dedupe(listas.flat());
  ordenarPorPlan(cercanos);
  return cercanos;
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
    verificado: yonkeData.verificado === true,
    entregaInmediata: yonkeData.entregaInmediata === true,
    direccion: yonkeData.direccion,
    telefono: yonkeData.telefono, whatsapp: yonkeData.whatsapp || '',
    metodosPago: yonkeData.metodosPago || [], plan: yonkeData.plan,
    ciudad: yonkeData.ciudad || '', horario: yonkeData.horario || null,
    vehiculoId: vDoc.id, vehiculo, calificacion,
  };
}

// Pieza suelta (yonkes/{id}/piezasSueltas): igual que un motor suelto, pero para cualquier otra
// pieza (cofre, alternador, faro...) sin registrar el vehículo completo. El shape de salida es
// IDÉNTICO al de toResultado() (pieza dentro de un vehículo real) — mismo r.vehiculo.{marca,
// modelo,ano}, mismo r.vehiculoId — a propósito, para que el cliente nunca note la diferencia:
// renderTarjetaVehiculo, el botón de WhatsApp, "Reservar" y "Pedir entrega" en HomeClient.js
// funcionan sin ningún cambio, porque solo leen esos mismos campos genéricos.
function toResultadoPiezaSuelta(yonkeDoc, pDoc, calificacion) {
  const yonkeData = yonkeDoc.data();
  const { marca, modelo, ano } = pDoc.data();
  return {
    yonkeId: yonkeDoc.id, yonkeNombre: yonkeData.nombre, logoUrl: yonkeData.logoUrl || null,
    verificado: yonkeData.verificado === true,
    entregaInmediata: yonkeData.entregaInmediata === true,
    direccion: yonkeData.direccion,
    telefono: yonkeData.telefono, whatsapp: yonkeData.whatsapp || '',
    metodosPago: yonkeData.metodosPago || [], plan: yonkeData.plan,
    ciudad: yonkeData.ciudad || '', horario: yonkeData.horario || null,
    vehiculoId: pDoc.id, vehiculo: { marca, modelo, ano }, calificacion,
  };
}

function toResultadoMotor(yonkeDoc, mDoc, calificacion) {
  const yonkeData = yonkeDoc.data();
  const { fechaIngreso, ...motor } = mDoc.data();
  return {
    yonkeId: yonkeDoc.id, yonkeNombre: yonkeData.nombre, logoUrl: yonkeData.logoUrl || null,
    verificado: yonkeData.verificado === true,
    entregaInmediata: yonkeData.entregaInmediata === true,
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
// cilindrada (opcional): filtro adicional client-side sobre los docs ya traídos por
// marca/modelo/año — no agrega lecturas a Firestore. marca puede ser null aquí (a diferencia
// de la búsqueda de vehículos) para soportar "motor 3.6" sin marca, ver buscarVehiculosPorAnio.
async function buscarMotores(yonkesDocs, marca, modelo, anio, cilindrada) {
  const pares = await buscarVehiculosPorAnio(dbServer, yonkesDocs, marca, modelo, anio, 'motores');
  const encontrados = [];
  for (const { yonkeDoc, vDoc: mDoc } of pares) {
    const data = mDoc.data();
    if (data.disponible === false) continue;
    if (cilindrada != null && !cilindradaCoincide(data.cilindrada, cilindrada)) continue;
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

// Mismo pipeline que consultarInventarioVehiculo (exacto + cercano ±4, ACUMULATIVOS — ver nota
// ahí sobre el bug corregido), pero sobre la subcolección 'motores'. Se llama junto con la
// búsqueda de vehículos — un motor/transmisión suelto encontrado es un resultado tan válido
// como una pieza. `motoresCercanos`/`transmisionesCercanos` solo vienen poblados cuando SÍ hay
// exacto (si no hay exacto, los cercanos ya van en `motores`/`transmisiones` como hasta hoy).
export async function consultarMotoresTransmisiones({ marca, modelo, anio, cilindrada = null, estado }) {
  const yonkesSnap = await getDocs(collection(dbServer, 'yonkes'));
  const { yonkesDocs, sinYonkesEnEstado } = filtrarPorEstado(yonkesSnap.docs, estado);
  if (sinYonkesEnEstado) {
    return { motores: [], transmisiones: [], motoresCercanos: [], transmisionesCercanos: [], tipoResultadoMotor: 'cualquierAno', sinYonkesEnEstado: true };
  }

  if (anio == null) {
    const todos = sinDuplicadosMotor(await buscarMotores(yonkesDocs, marca, modelo, null, cilindrada));
    ordenarPorPlan(todos);
    return { ...separarPorTipo(todos), motoresCercanos: [], transmisionesCercanos: [], tipoResultadoMotor: 'cualquierAno' };
  }

  const exactos = sinDuplicadosMotor(await buscarMotores(yonkesDocs, marca, modelo, anio, cilindrada));
  ordenarPorPlan(exactos);
  const cercanos = await buscarAniosCercanos((a) => buscarMotores(yonkesDocs, marca, modelo, a, cilindrada), anio, sinDuplicadosMotor);

  if (exactos.length > 0) {
    const { motores, transmisiones } = separarPorTipo(exactos);
    const { motores: motoresCercanos, transmisiones: transmisionesCercanos } = separarPorTipo(cercanos);
    return { motores, transmisiones, motoresCercanos, transmisionesCercanos, tipoResultadoMotor: 'exacto' };
  }
  if (cercanos.length > 0) {
    const { motores, transmisiones } = separarPorTipo(cercanos);
    return { motores, transmisiones, motoresCercanos: [], transmisionesCercanos: [], tipoResultadoMotor: 'cercano' };
  }

  const cualquierAno = sinDuplicadosMotor(await buscarMotores(yonkesDocs, marca, modelo, null, cilindrada));
  ordenarPorPlan(cualquierAno);
  const { motores, transmisiones } = separarPorTipo(cualquierAno);
  return { motores, transmisiones, motoresCercanos: [], transmisionesCercanos: [], tipoResultadoMotor: 'cualquierAno' };
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

// Mismo matching de marca/modelo/año que motores (subcolección 'piezasSueltas'), filtrando por
// nombre de pieza con el mismo piezaCoincide (subconjunto de palabras) que usan las piezas
// dentro de un vehículo — así "Parachoques" encuentra tanto "Parachoques delantero" suelto como
// dentro de un vehículo, igual. disponible=false se excluye por completo, igual que un motor.
async function buscarPiezasSueltas(yonkesDocs, marca, modelo, anio, pieza) {
  try {
    const pares = await buscarVehiculosPorAnio(dbServer, yonkesDocs, marca, modelo, anio, 'piezasSueltas');
    const encontrados = [];
    for (const { yonkeDoc, vDoc: pDoc } of pares) {
      const data = pDoc.data();
      if (data.disponible === false) continue;
      if (!piezaCoincide(pieza, data.pieza)) continue;
      const calificacion = await getRatingParaYonke(yonkeDoc.id);
      encontrados.push(toResultadoPiezaSuelta(yonkeDoc, pDoc, calificacion));
    }
    return encontrados;
  } catch (error) {
    // piezasSueltas es una subcolección nueva — si las reglas de seguridad de Firestore
    // todavía no le dan permiso de lectura (o falla por cualquier otro motivo puntual), esto
    // NUNCA debe tumbar la búsqueda completa de piezas dentro de vehículo, que es independiente.
    // Se degrada a "no hay piezas sueltas" en vez de propagar el error — mismo espíritu que
    // "guardarSinBloquear" en route.js para analítica.
    console.error('[consultarInventario] No se pudo leer piezasSueltas (revisar reglas de Firestore)', {
      code: error?.code, message: error?.message,
    });
    return [];
  }
}

function claveVehiculo(r) {
  return `${r.yonkeId}_${(r.vehiculo?.marca || '').toLowerCase()}_${(r.vehiculo?.modelo || '').toLowerCase()}_${r.vehiculo?.ano}`;
}

// Quita de `piezasSueltas` las que ya están cubiertas por un resultado real de vehículo (mismo
// yonke+marca+modelo+año) — cubre el caso raro de que un yonke registre la MISMA pieza dos
// veces (una vez dentro del vehículo, otra como suelta); gana la del vehículo real. A propósito
// NUNCA colapsa vehículo-contra-vehículo: un mismo yonke puede tener dos vehículos reales
// distintos con la misma marca/modelo/año (ej. dos Cruze 2011 de dos carros distintos) y ambos
// deben seguir apareciendo — sinDuplicados (por vehiculoId) ya los distingue correctamente.
function sinPiezasSueltasRedundantes(piezasSueltas, resultadosVehiculo) {
  if (piezasSueltas.length === 0) return piezasSueltas;
  const clavesVehiculo = new Set(resultadosVehiculo.map(claveVehiculo));
  return piezasSueltas.filter((r) => !clavesVehiculo.has(claveVehiculo(r)));
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
// page.js, pero server-side con dbServer. Devuelve { resultados, resultadosCercanos,
// tipoResultado, piezaNoEncontrada }.
//
// FIX: antes, si había coincidencia exacta, se hacía return inmediato y los años cercanos
// NUNCA se calculaban (bug "excluyente"). Ahora exacto y cercanos se calculan siempre que hay
// año, y se acumulan: si hay exacto, `resultados` trae el exacto y `resultadosCercanos` trae
// los ±4 (excluidos del rango, nunca duplican el año exacto) como grupo ADICIONAL. Si NO hay
// exacto, el comportamiento es igual que antes: los cercanos ocupan `resultados` directamente
// y `resultadosCercanos` queda vacío (no se muestra una sección de cercanos vacía de exactos).
// Piezas sueltas (yonkes/{id}/piezasSueltas) se mezclan AQUÍ ADENTRO, no en route.js — así el
// exacto/cercano/cualquierAno final ya considera ambas fuentes (pieza-en-vehículo + suelta)
// antes de decidir tipoResultado/piezaNoEncontrada, y el mensaje que ve el cliente ("X yonkes
// tienen este vehículo" / "no encontramos el año exacto pero...") sale correcto sin importar de
// dónde vino cada resultado. Se ejecuta SIEMPRE (ya no depende de enCatalogo en route.js) para
// que una pieza suelta de una marca/modelo nunca antes registrado como vehículo completo no
// quede invisible — mismo motivo por el que motores/transmisiones sueltos ya corren siempre.
export async function consultarInventario({ marca, modelo, anio, pieza, estado }) {
  const yonkesSnap = await getDocs(collection(dbServer, 'yonkes'));
  const { yonkesDocs, sinYonkesEnEstado } = filtrarPorEstado(yonkesSnap.docs, estado);
  if (sinYonkesEnEstado) {
    return { resultados: [], resultadosCercanos: [], tipoResultado: 'cualquierAno', piezaNoEncontrada: false, sinYonkesEnEstado: true };
  }

  // Sin año extraído del texto: buscamos en cualquier año directamente (mejor UX que
  // rechazar la búsqueda solo por faltar el dato), igual separando por disponibilidad de pieza.
  // No hay "exacto vs cercano" que acumular aquí — no aplica el fix.
  if (anio == null) {
    const [{ conPieza, soloVehiculo }, piezasSueltasRaw] = await Promise.all([
      buscarConSplitDePieza(yonkesDocs, marca, modelo, null, pieza),
      buscarPiezasSueltas(yonkesDocs, marca, modelo, null, pieza),
    ]);
    const piezasSueltas = sinPiezasSueltasRedundantes(piezasSueltasRaw, conPieza);
    const confirmados = sinDuplicados([...conPieza, ...piezasSueltas]);
    ordenarPorPlan(confirmados);
    if (confirmados.length > 0) {
      return { resultados: confirmados, resultadosCercanos: [], tipoResultado: 'cualquierAno', piezaNoEncontrada: false };
    }
    if (soloVehiculo.length > 0) {
      return { resultados: soloVehiculo, resultadosCercanos: [], tipoResultado: 'cualquierAno', piezaNoEncontrada: true };
    }
    return { resultados: [], resultadosCercanos: [], tipoResultado: 'cualquierAno', piezaNoEncontrada: false };
  }

  // Año exacto: se calcula pero YA NO se hace return inmediato. Las 4 búsquedas (vehículo
  // exacto, pieza suelta exacta, vehículo cercano, pieza suelta cercana) corren EN PARALELO.
  const [{ conPieza, soloVehiculo }, piezasSueltasExactasRaw, cercanosVehiculo, piezasSueltasCercanasRaw] = await Promise.all([
    buscarConSplitDePieza(yonkesDocs, marca, modelo, anio, pieza),
    buscarPiezasSueltas(yonkesDocs, marca, modelo, anio, pieza),
    buscarAniosCercanos((a) => buscarVehiculos(yonkesDocs, marca, modelo, a), anio, sinDuplicados),
    buscarAniosCercanos((a) => buscarPiezasSueltas(yonkesDocs, marca, modelo, a, pieza), anio, sinDuplicados),
  ]);

  const piezasSueltasExactas = sinPiezasSueltasRedundantes(piezasSueltasExactasRaw, conPieza);
  const confirmadosExacto = sinDuplicados([...conPieza, ...piezasSueltasExactas]);
  ordenarPorPlan(confirmadosExacto);
  const exactos = confirmadosExacto.length > 0 ? confirmadosExacto : soloVehiculo;
  const piezaNoEncontradaExacto = confirmadosExacto.length === 0 && soloVehiculo.length > 0;

  // Años cercanos ±4, mismo marca/modelo (sin filtrar por pieza específica en el lado vehículo,
  // igual que antes) combinados con las piezas sueltas cercanas (esas SÍ están confirmadas,
  // pero se mezclan igual porque este grupo ya se muestra como "aproximado" en el frontend).
  const piezasSueltasCercanas = sinPiezasSueltasRedundantes(piezasSueltasCercanasRaw, cercanosVehiculo);
  const cercanos = sinDuplicados([...cercanosVehiculo, ...piezasSueltasCercanas]);
  ordenarPorPlan(cercanos);

  if (exactos.length > 0) {
    return { resultados: exactos, resultadosCercanos: cercanos, tipoResultado: 'exacto', piezaNoEncontrada: piezaNoEncontradaExacto };
  }
  if (cercanos.length > 0) {
    return { resultados: cercanos, resultadosCercanos: [], tipoResultado: 'cercano', piezaNoEncontrada: false };
  }

  // Nivel 3: cualquier año, mismo marca/modelo.
  const [cualquierAnoVehiculo, piezasSueltasCualquierAnoRaw] = await Promise.all([
    buscarVehiculos(yonkesDocs, marca, modelo, null),
    buscarPiezasSueltas(yonkesDocs, marca, modelo, null, pieza),
  ]);
  const piezasSueltasCualquierAno = sinPiezasSueltasRedundantes(piezasSueltasCualquierAnoRaw, cualquierAnoVehiculo);
  const cualquierAno = sinDuplicados([...cualquierAnoVehiculo, ...piezasSueltasCualquierAno]);
  ordenarPorPlan(cualquierAno);
  return { resultados: cualquierAno, resultadosCercanos: [], tipoResultado: 'cualquierAno', piezaNoEncontrada: false };
}

// Búsqueda de solo vehículo (sin pieza): el usuario quiere ver todo el inventario
// disponible para esa marca/modelo/año, no una pieza en particular. Mismo pipeline
// acumulativo que consultarInventario() (ver nota de FIX ahí), sin separar por disponibilidad
// de pieza — regresa directamente los vehículos encontrados.
export async function consultarInventarioVehiculo({ marca, modelo, anio, estado }) {
  const yonkesSnap = await getDocs(collection(dbServer, 'yonkes'));
  const { yonkesDocs, sinYonkesEnEstado } = filtrarPorEstado(yonkesSnap.docs, estado);
  if (sinYonkesEnEstado) {
    return { resultados: [], resultadosCercanos: [], tipoResultado: 'cualquierAno', sinYonkesEnEstado: true };
  }

  if (anio == null) {
    const resultados = sinDuplicados(await buscarVehiculos(yonkesDocs, marca, modelo, null));
    ordenarPorPlan(resultados);
    return { resultados, resultadosCercanos: [], tipoResultado: 'cualquierAno' };
  }

  const exactos = sinDuplicados(await buscarVehiculos(yonkesDocs, marca, modelo, anio));
  ordenarPorPlan(exactos);
  const cercanos = await buscarAniosCercanos((a) => buscarVehiculos(yonkesDocs, marca, modelo, a), anio, sinDuplicados);

  if (exactos.length > 0) {
    return { resultados: exactos, resultadosCercanos: cercanos, tipoResultado: 'exacto' };
  }
  if (cercanos.length > 0) {
    return { resultados: cercanos, resultadosCercanos: [], tipoResultado: 'cercano' };
  }

  const cualquierAno = sinDuplicados(await buscarVehiculos(yonkesDocs, marca, modelo, null));
  ordenarPorPlan(cualquierAno);
  return { resultados: cualquierAno, resultadosCercanos: [], tipoResultado: 'cualquierAno' };
}
