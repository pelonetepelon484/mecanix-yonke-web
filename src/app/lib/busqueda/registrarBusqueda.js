import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { dbServer } from '../firebase-server';
import { calcularAlcanceResultado } from '../../../lib/alcanceResultado';

// IMPORTANTE: este Set debe coincidir con la lista de `estado` permitidos en firestore.rules
// (match /busquedas/{docId}, en este repositorio). Agregar un valor aquí sin agregarlo también en
// las reglas hace que addDoc() falle en silencio (permission-denied, atrapado abajo): el buscador
// sigue funcionando para el cliente, pero esa búsqueda no queda registrada. Lo mismo con los
// campos de busquedasResumen, que en las reglas son una lista EXACTA (keys().hasOnly): un campo
// nuevo ahí se publica primero en las reglas y después en el código.
const ESTADOS_VALIDOS = new Set([
  'no_interpretada', 'fuera_de_giro', 'parseo_parcial', 'fuera_de_catalogo', 'sin_inventario', 'ok',
  'numero_de_parte', 'marca_muy_general', 'pieza_sin_vehiculo',
]);

// Nombres de campo EXACTOS exigidos por la regla de Firestore (match /busquedas/{docId}):
// textoOriginal (string, 1-299 chars), estado (enum), numResultados (int >= 0, nunca null),
// origen ('web'|'whatsapp'), fecha. Cualquier otro campo es libre (sin validar por la regla),
// pero se mantiene consistente para el dashboard/migración.
//
// Log unificado de TODA búsqueda del Buscador Inteligente (éxito incluido), reemplaza a los
// antiguos busquedas_no_interpretadas/modelos_no_reconocidos (solo-fallos). Mismo patrón que
// registrarEnCatalogo (SelectorMarcaModelo.js): awaited por el caller, pero el error se traga
// y se loguea aquí adentro — nunca se propaga, nunca bloquea la respuesta al usuario.
//
// estadoGeografico/ciudad/yonkeIds: campos del "Mapa de búsquedas" (spec sección 1) — a propósito
// NO se llama `estado` como el geográfico, porque `estado` ya significa "estado de la búsqueda"
// en todo este archivo/route.js (ver nota en route.js sobre no confundir ambos conceptos).
// conResultado se deriva aquí mismo de `estado` ('ok' = sí hubo resultado) para que el dashboard
// del mapa no tenga que conocer el enum completo de estados de búsqueda.
export async function registrarBusqueda({
  texto, estado, pieza = null, marca = null, modelo = null, anio = null,
  tipoResultado = null, totalResultados = 0, piezaNoEncontrada = null,
  subtipo = null, origen = 'web', tieneContacto = false,
  estadoGeografico = null, ciudad = null, yonkeIds = [], pais = null,
  // sinVehiculo: SOLO true para el caso "pieza sin vehículo detectado" (banner en vez de
  // resultados, ver src/lib/piezaSinVehiculo.ts) — se usa para excluir estas búsquedas del
  // reporte "Piezas/vehículos más buscados" y del conteo "Con resultado" (admin/busquedas/mapa),
  // sin dejar de guardarlas (el % de sinVehiculo es en sí un indicador útil).
  sinVehiculo = false,
  // otrosEstados: { mostrados, yonkeIds } solo cuando aplicó "resultados de otros estados"
  // (config/buscador.otrosEstadosSinResultados, ver otrosEstados.js). La búsqueda sigue siendo
  // sin_inventario (conResultado false) y yonkeIds de arriba sigue vacío; con mostrados > 0, su
  // alcanceResultado es 'solo_otros_estados'.
  // Sin él, el documento queda idéntico al de siempre. Solo va en busquedas, no en el resumen.
  otrosEstados = null,
  // soloOtrosEstados: true solo con "Todos los estados" por IP cuando ningún resultado era del
  // estado del visitante (config/buscador.otrosEstadosPorIp, ver otrosEstadosPorIp.js). estado y
  // conResultado no cambian (sí hubo resultados en el país). Sin él, documento idéntico.
  soloOtrosEstados = false,
  // estadoBusqueda: el estado que eligió el cliente en el buscador ('todos' o el id del estado).
  // estadoGeografico es OTRO dato: el del visitante según su conexión. Solo va en busquedas.
  estadoBusqueda = null,
}) {
  if (!ESTADOS_VALIDOS.has(estado)) {
    console.error(`[registrarBusqueda] estado inválido, no se guarda: "${estado}"`);
    return;
  }

  // textoOriginal debe tener 1-299 caracteres (regla: size() > 0 && size() < 300).
  const textoOriginal = (texto || '').trim().slice(0, 299);
  if (!textoOriginal) {
    console.error('[registrarBusqueda] texto vacío tras normalizar, no se guarda (violaría textoOriginal.size() > 0)');
    return;
  }

  // numResultados debe ser SIEMPRE un entero >= 0, nunca null/undefined/float.
  const numResultados = Number.isInteger(totalResultados) && totalResultados >= 0 ? totalResultados : 0;

  const datos = {
    textoOriginal, estado, pieza, marca, modelo, anio,
    tipoResultado, numResultados, piezaNoEncontrada,
    subtipo, origen, tieneContacto: Boolean(tieneContacto),
    estadoGeografico, ciudad,
    // pais: código ISO del visitante desde el header de Vercel (route.js/obtenerGeoVisitante),
    // ej. 'MX', 'US' — null cuando no se pudo determinar (local, o el header no llegó), NUNCA se
    // asume 'MX' por default. Sirve para que el dashboard filtre el ruido de bots de fuera de
    // México sin borrar nada — ver admin/busquedas/page.js. Búsquedas de antes de este campo se
    // quedan con pais=null (no se migran), el dashboard las trata como "país desconocido".
    pais,
    yonkeIds: Array.isArray(yonkeIds) ? yonkeIds : [],
    conResultado: estado === 'ok',
    sinVehiculo: Boolean(sinVehiculo),
    ...(otrosEstados ? {
      otrosEstados: {
        mostrados: Number.isInteger(otrosEstados.mostrados) && otrosEstados.mostrados >= 0 ? otrosEstados.mostrados : 0,
        yonkeIds: Array.isArray(otrosEstados.yonkeIds) ? otrosEstados.yonkeIds.filter((id) => typeof id === 'string') : [],
      },
    } : {}),
    ...(soloOtrosEstados === true ? { soloOtrosEstados: true } : {}),
    // con_resultado | solo_otros_estados | sin_resultado (ver src/lib/alcanceResultado.js).
    alcanceResultado: calcularAlcanceResultado({ estado, soloOtrosEstados, otrosEstados }),
    ...(typeof estadoBusqueda === 'string' && estadoBusqueda ? { estadoBusqueda: estadoBusqueda.slice(0, 60) } : {}),
    fecha: Timestamp.now(),
  };

  try {
    await addDoc(collection(dbServer, 'busquedas'), datos);
  } catch (error) {
    console.error('[registrarBusqueda] Rechazado por Firestore al guardar en "busquedas"', {
      code: error?.code,
      message: error?.message,
      documento: datos,
    });
  }

  // Copia reducida para que el panel "Demanda" del yonke (panel/demanda/page.js) pueda leerla
  // directo desde el navegador sin exponer nunca textoOriginal (lo que escribió el cliente) ni
  // yonkeIds (qué otros yonkes/competidores se consideraron) -- ver auditoría de privacidad
  // 2026-09-30. Sin estadoGeografico no hay bajo qué estado agruparla, así que no se escribe.
  if (estadoGeografico) {
    const datosResumen = {
      estadoGeografico, pieza, marca, modelo, anio,
      estado, conResultado: datos.conResultado, sinVehiculo: datos.sinVehiculo,
      alcanceResultado: datos.alcanceResultado,
      fecha: datos.fecha,
    };
    try {
      await addDoc(collection(dbServer, 'busquedasResumen'), datosResumen);
    } catch (error) {
      console.error('[registrarBusqueda] Rechazado por Firestore al guardar en "busquedasResumen"', {
        code: error?.code,
        message: error?.message,
        documento: datosResumen,
      });
    }
  }
}
