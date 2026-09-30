// Reporte de demanda por pieza/vehículo para el panel del yonke — versión reducida del "Mapa de
// búsquedas" de admin, sin ningún número visible: agrupa, aplica un mínimo de búsquedas por fila
// (sin exponer ese conteo) y devuelve solo la clave y una etiqueta de dos valores. El ORDEN del
// arreglo (de más a menos buscado) es en sí el dato de demanda.

export const DEMANDA_MINIMO_POR_FILA = 2;

export type EstadoDemanda = 'Con resultado' | 'Demanda sin cubrir';

export interface BusquedaParaDemanda {
  pieza: string | null;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  conResultado: boolean;
}

export interface FilaDemanda {
  clave: string;
  estado: EstadoDemanda;
}

// Mismo formato que queBuscaba() en admin/busquedas/mapa/page.js ("Pieza — Marca Modelo Año"),
// con año opcional: incluirAnio=false agrupa piezas del mismo vehículo sin importar el año exacto
// (ej. "Calavera Dodge Stratus 2001" y "...2002" caen en la misma fila). Se deja como parámetro,
// no como constante fija, porque el nivel de agrupación correcto se decide con datos reales (ver
// script de auditoría de la Fase 2) — el endpoint (commit 4) elige el valor final.
export function claveDemanda(d: BusquedaParaDemanda, incluirAnio: boolean): string {
  const vehiculo = [d.marca, d.modelo, incluirAnio ? d.anio : null].filter(Boolean).join(' ');
  return [d.pieza, vehiculo].filter(Boolean).join(' — ') || '(sin detalle)';
}

// Agrupa por claveDemanda(), descarta grupos con menos de DEMANDA_MINIMO_POR_FILA búsquedas (sin
// decir cuántas tenían) y ordena de más a menos buscado. "Demanda sin cubrir" gana sobre "Con
// resultado" si AL MENOS UNA búsqueda del grupo no tuvo resultado -- una sola búsqueda sin cubrir
// ya es información válida para el yonke, aunque otras del mismo grupo sí hayan encontrado algo.
export function construirReporteDemanda(
  busquedas: BusquedaParaDemanda[],
  { incluirAnio = true }: { incluirAnio?: boolean } = {},
): FilaDemanda[] {
  const grupos = new Map<string, { conteo: number; algunaSinResultado: boolean }>();
  for (const b of busquedas) {
    const clave = claveDemanda(b, incluirAnio);
    const actual = grupos.get(clave) || { conteo: 0, algunaSinResultado: false };
    actual.conteo += 1;
    if (!b.conResultado) actual.algunaSinResultado = true;
    grupos.set(clave, actual);
  }
  return [...grupos.entries()]
    .filter(([, v]) => v.conteo >= DEMANDA_MINIMO_POR_FILA)
    .sort((a, b) => b[1].conteo - a[1].conteo)
    .map(([clave, v]) => ({ clave, estado: v.algunaSinResultado ? 'Demanda sin cubrir' : 'Con resultado' }));
}
