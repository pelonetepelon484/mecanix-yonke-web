import { doc, getDoc } from 'firebase/firestore';
import { dbServer } from '../firebase-server';
import { OTROS_OFICIOS_BASE, SALUDOS_CORTESIA_BASE, VENTA_VEHICULO_BASE } from './palabrasFueraDeGiroBase';

const DIACRITICOS_COMBINABLES = new RegExp('[\\u0300-\\u036f]', 'g');

function normalizar(texto) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICOS_COMBINABLES, '');
}

const UMBRAL_PALABRAS_RESTANTES_SALUDO_DEFAULT = 2;

// Fusiona las listas base (funcionan sin Firestore) con config/palabrasFueraDeGiro si existe,
// igual que SelectorMarcaModelo.cargarCatalogoCombinado fusiona CATALOGO_BASE con el catálogo
// vivo. Fail-open: si Firestore falla, se usan solo las listas base.
async function cargarPalabrasCombinadas() {
  let extra = {};
  try {
    const snap = await getDoc(doc(dbServer, 'config', 'palabrasFueraDeGiro'));
    if (snap.exists()) extra = snap.data();
  } catch (e) {
    console.error('[detectarFueraDeGiro] No se pudo leer config/palabrasFueraDeGiro, usando solo listas base', e);
  }
  return {
    otrosOficios: [...new Set([...OTROS_OFICIOS_BASE, ...(extra.otrosOficios || [])])].map(normalizar),
    saludosCortesia: [...new Set([...SALUDOS_CORTESIA_BASE, ...(extra.saludosCortesia || [])])].map(normalizar),
    ventaVehiculoCompleto: [...new Set([...VENTA_VEHICULO_BASE, ...(extra.ventaVehiculoCompleto || [])])].map(normalizar),
    umbralPalabrasRestantesSaludo: typeof extra.umbralPalabrasRestantesSaludo === 'number'
      ? extra.umbralPalabrasRestantesSaludo
      : UMBRAL_PALABRAS_RESTANTES_SALUDO_DEFAULT,
  };
}

function contieneAlguna(textoNormalizado, frases) {
  return frases.some((f) => textoNormalizado.includes(f));
}

// Capa previa a la búsqueda: detecta texto que, aunque pasó Capa 0, no es realmente una
// búsqueda de autopartes. Se evalúa en este orden (la primera categoría que aplique gana):
// 1. venta_vehiculo — puede ganarle incluso a una intención "reconocida" (ver route.js).
// 2. oficio — requiere que la intención NO esté reconocida (evita descartar una búsqueda
//    real que coincida por casualidad con una palabra de otro oficio).
// 3. saludo — requiere que Capa 1 no haya extraído absolutamente nada.
export async function detectarFueraDeGiro(textoOriginal, intencion) {
  const textoNormalizado = normalizar(textoOriginal);
  const { otrosOficios, saludosCortesia, ventaVehiculoCompleto, umbralPalabrasRestantesSaludo } =
    await cargarPalabrasCombinadas();

  if (intencion.vehiculoReconocido && contieneAlguna(textoNormalizado, ventaVehiculoCompleto)) {
    return { esFueraDeGiro: true, categoria: 'venta_vehiculo' };
  }

  if (!intencion.reconocido && contieneAlguna(textoNormalizado, otrosOficios)) {
    return { esFueraDeGiro: true, categoria: 'oficio' };
  }

  if (!intencion.reconocido && !intencion.vehiculoReconocido && !intencion.pieza) {
    const fraseSaludo = saludosCortesia.find((f) => textoNormalizado.includes(f));
    if (fraseSaludo) {
      const palabrasRestantes = textoNormalizado
        .split(/\s+/)
        .filter(Boolean)
        .filter((p) => !fraseSaludo.split(/\s+/).includes(p));
      if (palabrasRestantes.length <= umbralPalabrasRestantesSaludo) {
        return { esFueraDeGiro: true, categoria: 'saludo' };
      }
    }
  }

  return { esFueraDeGiro: false, categoria: null };
}
