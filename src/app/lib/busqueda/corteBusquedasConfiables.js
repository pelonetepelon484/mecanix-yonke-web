import { Timestamp, where } from 'firebase/firestore';

// FECHA MÁGICA — por qué existe:
// Hasta el commit e0c2331 (23 sept 2026, 22:53:44 hora Tijuana), un bug de clasificación en
// extraerIntencion.js/route.js hacía que la MAYORÍA de las búsquedas se guardaran con
// estado='fuera_de_catalogo' aunque la marca/modelo SÍ existieran (ver auditorías de búsquedas
// de esa misma fecha) — así que cualquier conteo/agregación sobre `busquedas` de antes de este
// corte está contaminado y no debe mezclarse con datos posteriores.
//
// Decisión (no mía, de David): NO se rescatan ni reinterpretan los documentos viejos — se
// conservan tal cual en Firestore (podrían servir para depurar el bug original si hace falta
// después), simplemente se EXCLUYEN de lecturas/reportes nuevos con este filtro.
//
// Nota: la misma noche se corrigieron otros dos bugs de clasificación relacionados (alias de
// plataforma "mkN", commit 627d000; mezcla de modelo entre marcas distintas, commit b14d336) —
// se decidió deliberadamente usar SOLO el primer commit (e0c2331) como corte, no el último.
export const CORTE_BUSQUEDAS_CONFIABLES = new Date('2026-09-24T05:53:44.000Z');

// Filtro listo para usar en cualquier query sobre la colección `busquedas` — así el valor de
// corte vive en un solo lugar y nunca se repite hardcodeado.
// Uso: query(collection(db, 'busquedas'), filtroBusquedasConfiables(), where('estado', '==', ...))
export function filtroBusquedasConfiables() {
  return where('fecha', '>=', Timestamp.fromDate(CORTE_BUSQUEDAS_CONFIABLES));
}
