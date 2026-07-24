import { addDoc, collection } from 'firebase/firestore';
import { dbServer } from '../firebase-server';

const ESTADOS_VALIDOS = new Set([
  'no_interpretada', 'fuera_de_giro', 'parseo_parcial', 'fuera_de_catalogo', 'sin_inventario', 'ok',
]);

// Log unificado de TODA búsqueda del Buscador Inteligente (éxito incluido), reemplaza a los
// antiguos busquedas_no_interpretadas/modelos_no_reconocidos (solo-fallos). Mismo patrón que
// registrarEnCatalogo (SelectorMarcaModelo.js): awaited por el caller, pero el error se traga
// y se loguea aquí adentro — nunca se propaga, nunca bloquea la respuesta al usuario.
export async function registrarBusqueda({
  texto, estado, pieza = null, marca = null, modelo = null, anio = null,
  tipoResultado = null, totalResultados = null, piezaNoEncontrada = null,
  categoriaFueraDeGiro = null, origen = 'web', tieneContacto = false,
}) {
  if (!ESTADOS_VALIDOS.has(estado)) {
    console.error(`[registrarBusqueda] estado inválido, no se guarda: "${estado}"`);
    return;
  }
  try {
    await addDoc(collection(dbServer, 'busquedas'), {
      texto: (texto || '').slice(0, 300),
      estado, pieza, marca, modelo, anio,
      tipoResultado, totalResultados, piezaNoEncontrada,
      categoriaFueraDeGiro, origen, tieneContacto: Boolean(tieneContacto),
      fecha: new Date(),
    });
  } catch (error) {
    console.error('[registrarBusqueda] No se pudo guardar en "busquedas" (revisar reglas de Firestore)', {
      code: error?.code,
      message: error?.message,
    });
  }
}
