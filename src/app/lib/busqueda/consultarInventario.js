import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { dbServer } from '../firebase-server';
import { getRatingParaYonke } from '../yonkesServerData';

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

// Catálogo VIVO (config/catalogoVehiculos) = modelos con inventario alguna vez registrado.
// Distinto de CATALOGO_BASE, que es el diccionario amplio usado solo para reconocer texto.
export async function existeEnCatalogoVivo(marca, modelo) {
  const snap = await getDoc(doc(dbServer, 'config', 'catalogoVehiculos'));
  if (!snap.exists()) return false;
  const catalogo = snap.data().catalogo || {};
  const modelos = catalogo[marca];
  if (!modelos) return false;
  return modelos.some((m) => m.toLowerCase() === modelo.toLowerCase());
}

function toResultado(yonkeDoc, vDoc, calificacion) {
  const yonkeData = yonkeDoc.data();
  // fechaIngreso es un Timestamp de Firestore — se omite para que la respuesta sea JSON limpio.
  const { fechaIngreso, ...vehiculo } = vDoc.data();
  return {
    yonkeId: yonkeDoc.id, yonkeNombre: yonkeData.nombre, direccion: yonkeData.direccion,
    telefono: yonkeData.telefono, whatsapp: yonkeData.whatsapp || '',
    metodosPago: yonkeData.metodosPago || [], plan: yonkeData.plan,
    ciudad: yonkeData.ciudad || '', horario: yonkeData.horario || null,
    vehiculoId: vDoc.id, vehiculo, calificacion,
  };
}

async function buscarVehiculos(yonkesDocs, marca, modelo, anio) {
  const encontrados = [];
  for (const yonkeDoc of yonkesDocs) {
    const yonkeData = yonkeDoc.data();
    if (!yonkeData.activo) continue;
    const vehiculosRef = collection(dbServer, 'yonkes', yonkeDoc.id, 'vehiculos');
    const q = anio != null ? query(vehiculosRef, where('ano', '==', anio)) : vehiculosRef;
    const snap = await getDocs(q);
    const coincidentes = snap.docs.filter((vDoc) => {
      const data = vDoc.data();
      return data.marca?.toLowerCase() === marca.toLowerCase()
        && data.modelo?.toLowerCase() === modelo.toLowerCase();
    });
    for (const vDoc of coincidentes) {
      const calificacion = await getRatingParaYonke(yonkeDoc.id);
      encontrados.push(toResultado(yonkeDoc, vDoc, calificacion));
    }
  }
  return encontrados;
}

async function tienePiezaDisponible(yonkeId, vehiculoId, pieza) {
  const piezasRef = collection(dbServer, 'yonkes', yonkeId, 'vehiculos', vehiculoId, 'piezas');
  const snap = await getDocs(piezasRef);
  return snap.docs.some((pDoc) => {
    const data = pDoc.data();
    return data.disponible && data.nombre?.toLowerCase() === pieza.toLowerCase();
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
