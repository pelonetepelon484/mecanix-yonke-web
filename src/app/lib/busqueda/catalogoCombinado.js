import { doc, getDoc } from 'firebase/firestore';
import { dbServer } from '../firebase-server';
import { CATALOGO_BASE } from '../catalogoBase';

const TTL_MS = 10 * 60 * 1000; // 10 minutos

// Caché en memoria a nivel de módulo — vive mientras la instancia de servidor esté tibia.
// null hasta la primera lectura; se recalcula solo cuando expira el TTL.
let cache = null;
let cacheEn = 0;

// Marcas conocidas (nombres, no alias) en minúscula — para el filtro de abajo. Un "modelo"
// del catálogo vivo que sea literalmente el nombre de otra marca (ej. Dodge con modelo "Ram",
// captura real e incompleta de algún yonke que no puso el número: "Ram 1500", etc.) nunca debe
// tratarse como modelo válido: confirmado en Firestore que esto pasa hoy con Dodge/"Ram", y
// deja que ese match gane por orden de iteración antes de llegar al modelo real bajo la marca
// RAM (rompía "chrysler ram 700" / "dodge ram 700", que deben resolver a RAM/700).
const MARCAS_CONOCIDAS = new Set(Object.keys(CATALOGO_BASE).map((m) => m.toLowerCase()));

// Fusiona CATALOGO_BASE con el catálogo vivo de Firestore (config/catalogoVehiculos), unión
// por marca — mismo criterio que cargarCatalogoCombinado() en SelectorMarcaModelo.js (ese es
// client-side para el selector del panel; este es la versión server-side para el parser del
// buscador inteligente). Fail-open: si Firestore falla, se usa solo el estático — nunca debe
// bloquear ni tirar una búsqueda por esto.
async function construirCatalogoCombinado() {
  const combinado = {};
  Object.keys(CATALOGO_BASE).forEach((marca) => {
    combinado[marca] = new Set(CATALOGO_BASE[marca]);
  });

  try {
    const snap = await getDoc(doc(dbServer, 'config', 'catalogoVehiculos'));
    if (snap.exists()) {
      const vivo = snap.data().catalogo || {};
      Object.keys(vivo).forEach((marca) => {
        if (!combinado[marca]) combinado[marca] = new Set();
        (vivo[marca] || []).forEach((modelo) => {
          if (MARCAS_CONOCIDAS.has(modelo.toLowerCase())) return;
          combinado[marca].add(modelo);
        });
      });
    }
  } catch (error) {
    console.error('[catalogoCombinado] No se pudo leer config/catalogoVehiculos, usando solo CATALOGO_BASE', {
      code: error?.code,
      message: error?.message,
    });
  }

  const final = {};
  Object.keys(combinado).forEach((marca) => {
    final[marca] = [...combinado[marca]];
  });
  return final;
}

// Punto de entrada del parser: devuelve el catálogo combinado, sirviendo desde caché en
// memoria si todavía no expira el TTL. En caché caliente esto es síncrono en la práctica
// (no toca Firestore); en caché fría dispara una sola lectura y la reutiliza para todas las
// búsquedas siguientes durante los próximos 10 minutos.
export async function obtenerCatalogoCombinado() {
  const ahora = Date.now();
  if (cache && (ahora - cacheEn) < TTL_MS) {
    return cache;
  }
  cache = await construirCatalogoCombinado();
  cacheEn = ahora;
  return cache;
}
