import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { dbServer } from '../firebase-server';

const ESTADOS_VALIDOS = new Set([
  'no_interpretada', 'fuera_de_giro', 'parseo_parcial', 'fuera_de_catalogo', 'sin_inventario', 'ok',
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
export async function registrarBusqueda({
  texto, estado, pieza = null, marca = null, modelo = null, anio = null,
  tipoResultado = null, totalResultados = 0, piezaNoEncontrada = null,
  subtipo = null, origen = 'web', tieneContacto = false,
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
}
