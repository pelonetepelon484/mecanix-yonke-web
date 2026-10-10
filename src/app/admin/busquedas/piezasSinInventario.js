// Tabla "Piezas sin inventario más buscadas" del admin. Todo se calcula en el navegador con las
// búsquedas que la pantalla ya carga (las últimas 300 sin inventario): no hay lecturas extra.
// El estado de cada búsqueda es DESDE DÓNDE SE CONECTÓ el cliente (estadoGeografico, por su
// conexión), no el que eligió en el selector — ese no se guarda. Sin dato: "Sin ubicación".
import { NOMBRES_ESTADO } from './nombresEstado';
import { aFecha } from './mapa/fechas';

export const TODOS_LOS_ESTADOS = 'todos';
export const SIN_UBICACION = 'sin_ubicacion';
const MAX_FILAS = 10;
const MAX_ESTADOS_VISIBLES = 3;

export function claveUbicacion(d) {
  return d.estadoGeografico && d.estadoGeografico !== 'desconocido' ? d.estadoGeografico : SIN_UBICACION;
}

export function nombreUbicacion(clave) {
  return clave === SIN_UBICACION ? 'Sin ubicación' : NOMBRES_ESTADO[clave] || clave;
}

// Sin pieza = el cliente buscó solo el vehículo. Sin marca se deja "?".
export function piezaVehiculo(d) {
  return `${d.pieza || 'Cualquier pieza'} — ${d.marca || '?'} ${d.modelo || ''}`.trim();
}

// Más buscado primero; empate, por nombre.
function ordenarConteos(conteos) {
  return [...conteos.entries()]
    .map(([clave, conteo]) => ({ clave, nombre: nombreUbicacion(clave), conteo }))
    .sort((a, b) => b.conteo - a.conteo || a.nombre.localeCompare(b.nombre, 'es'));
}

// "Baja California (4), Sonora (2), Jalisco (1) +2 más"
export function textoEstados(conteos) {
  const lista = ordenarConteos(conteos);
  const visibles = lista.slice(0, MAX_ESTADOS_VISIBLES).map((e) => `${e.nombre} (${e.conteo})`).join(', ');
  const resto = lista.length - MAX_ESTADOS_VISIBLES;
  return resto > 0 ? `${visibles} +${resto} más` : visibles;
}

// Opciones del filtro: los estados que aparecen en las búsquedas, con cuántas hay en cada uno.
// Si el estado elegido ya no aparece (por ejemplo al cambiar a "Solo México"), se deja con 0.
export function opcionesEstado(docs, elegido = TODOS_LOS_ESTADOS) {
  const conteos = new Map();
  for (const d of docs) conteos.set(claveUbicacion(d), (conteos.get(claveUbicacion(d)) || 0) + 1);
  if (elegido !== TODOS_LOS_ESTADOS && !conteos.has(elegido)) conteos.set(elegido, 0);
  return ordenarConteos(conteos);
}

// Filas de la tabla, solo con las búsquedas del estado elegido: veces buscado, última vez y en
// qué estados. Las 10 más buscadas.
export function filasSinInventario(docs, estado = TODOS_LOS_ESTADOS) {
  const mapa = new Map();
  for (const d of docs) {
    const ubicacion = claveUbicacion(d);
    if (estado !== TODOS_LOS_ESTADOS && ubicacion !== estado) continue;
    const clave = piezaVehiculo(d);
    const fila = mapa.get(clave) || { clave, conteo: 0, ultima: null, estados: new Map() };
    fila.conteo++;
    const fecha = aFecha(d.fecha);
    if (fecha && (!fila.ultima || fecha > fila.ultima)) fila.ultima = fecha;
    fila.estados.set(ubicacion, (fila.estados.get(ubicacion) || 0) + 1);
    mapa.set(clave, fila);
  }
  return [...mapa.values()]
    .sort((a, b) => b.conteo - a.conteo)
    .slice(0, MAX_FILAS)
    .map((f) => ({ ...f, textoEstados: textoEstados(f.estados) }));
}
