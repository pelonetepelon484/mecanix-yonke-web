import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { dbServer } from './firebase-server';
import { leerConfigRefaccionariasDe, refaccionariaVisible } from '../../lib/refaccionarias';
import { leerIndice } from '../../lib/buscadorRefacciones';

// Lecturas del servidor para la página pública /refaccionarias/[slug] (etapa 3), con caché en
// memoria de 5 minutos: config/refaccionarias, la refaccionaria por slug (1 lectura) y el bloque de
// la página que se pide (1 lectura). Visitas repetidas dentro de los 5 minutos no leen nada. Un
// cambio del admin (activar, vencer, bandera) tarda hasta 5 minutos en verse.
export const CACHE_PAGINA_REFACCIONARIA_MS = 5 * 60 * 1000;
const MAX_CLAVES_CACHE = 500;

// Envuelve una lectura con caché por clave. Si la lectura falla no se guarda nada (se reintenta).
export function conCache(leer, ttlMs = CACHE_PAGINA_REFACCIONARIA_MS, reloj = () => Date.now()) {
  const guardado = new Map();
  return async (clave) => {
    const previo = guardado.get(clave);
    if (previo && reloj() - previo.en < ttlMs) return previo.valor;
    const valor = await leer(clave);
    // Tope de claves para que direcciones inventadas no hagan crecer la memoria sin fin.
    if (guardado.size >= MAX_CLAVES_CACHE) guardado.clear();
    guardado.set(clave, { valor, en: reloj() });
    return valor;
  };
}

const aMs = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : v instanceof Date ? v.getTime() : null);

// Solo lo que la página necesita, serializable (sin ownerUid ni datos de la cuenta).
export function refaccionariaParaPagina(id, d) {
  return {
    id,
    nombre: typeof d.nombre === 'string' ? d.nombre : '',
    ciudad: typeof d.ciudad === 'string' ? d.ciudad : '',
    whatsapp: typeof d.whatsapp === 'string' ? d.whatsapp : '',
    logoUrl: typeof d.logoUrl === 'string' ? d.logoUrl : '',
    horario: d.horario && typeof d.horario === 'object' ? d.horario : null,
    zonaEntrega: d.zonaEntrega && typeof d.zonaEntrega === 'object' ? d.zonaEntrega : null,
    totalPiezas: Number.isInteger(d.totalPiezas) ? d.totalPiezas : 0,
    inventarioActualizadoMs: aMs(d.inventarioActualizadoAt),
    // Para decidir si se muestra (refaccionariaVisible) en cada visita:
    activo: d.activo === true,
    pruebaHastaMs: aMs(d.pruebaHasta),
    premiumHastaMs: aMs(d.premiumHasta),
  };
}

// config/refaccionarias. Sin documento, con otro valor o si falla la lectura: todo apagado (la
// página da 404 y el buscador no aparece, como hoy).
const configPublica = conCache(async () => {
  try {
    const snap = await getDoc(doc(dbServer, 'config', 'refaccionarias'));
    return leerConfigRefaccionariasDe(snap.exists() ? snap.data() : null);
  } catch (error) {
    console.warn('[refaccionarias] No se pudo leer config/refaccionarias; página y buscador apagados.', error?.code || error?.message);
    return leerConfigRefaccionariasDe(null);
  }
});
export const paginaPublicaEncendida = async () => (await configPublica('config')).paginaPublica;
// config/refaccionarias.buscador (exige también paginaPublica: ver leerConfigRefaccionariasDe).
export const buscadorRefaccionesEncendido = async () => (await configPublica('config')).buscador;

export const refaccionariaPorSlug = conCache(async (slug) => {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 80) return null;
  const snap = await getDocs(query(collection(dbServer, 'refaccionarias'), where('slug', '==', slug), limit(1)));
  const d = snap.docs[0];
  return d ? refaccionariaParaPagina(d.id, d.data()) : null;
});

// clave: "<refaccionariaId>/<número de bloque>"
export const bloqueDeInventario = conCache(async (clave) => {
  const [id, numero] = clave.split('/');
  const snap = await getDoc(doc(dbServer, 'refaccionarias', id, 'bloques', numero));
  return snap.exists() ? { piezas: snap.data().piezas } : null;
});

// ---------- Buscador "Piezas nuevas" (etapa 4) ----------
// La lista de refaccionarias activas y sus índices se guardan 15 minutos: al vencer una cuenta o
// cambiar su inventario, el buscador tarda hasta 15 minutos en reflejarlo. Los bloques de los
// resultados usan la caché de 5 minutos de arriba (bloqueDeInventario).
export const CACHE_BUSCADOR_MS = 15 * 60 * 1000;

export function refaccionariaParaBuscador(id, d) {
  return {
    ...refaccionariaParaPagina(id, d),
    slug: typeof d.slug === 'string' ? d.slug : '',
    estado: typeof d.estado === 'string' ? d.estado : '',
    verificado: d.verificado === true,
  };
}

// La lista guarda las fechas en milisegundos: se revisa la vigencia en cada búsqueda.
export function visibleAhora(r, ahora = new Date()) {
  return refaccionariaVisible({
    activo: r.activo,
    pruebaHasta: r.pruebaHastaMs ? new Date(r.pruebaHastaMs) : null,
    premiumHasta: r.premiumHastaMs ? new Date(r.premiumHastaMs) : null,
  }, ahora);
}

// 1 lectura por refaccionaria activa (where activo == true, índice automático).
export const refaccionariasActivas = conCache(async () => {
  const snap = await getDocs(query(collection(dbServer, 'refaccionarias'), where('activo', '==', true)));
  return snap.docs.map((d) => refaccionariaParaBuscador(d.id, d.data()));
}, CACHE_BUSCADOR_MS);

// clave: "<refaccionariaId>/<número de índice>". Sin documento: lista vacía.
export const indiceDeBusqueda = conCache(async (clave) => {
  const [id, numero] = clave.split('/');
  const snap = await getDoc(doc(dbServer, 'refaccionarias', id, 'busqueda', numero));
  return snap.exists() ? leerIndice(snap.data().entradas) : [];
}, CACHE_BUSCADOR_MS);
