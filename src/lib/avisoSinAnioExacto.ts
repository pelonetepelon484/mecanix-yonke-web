// "No encontramos tu [marca] [modelo] [año] exacto. ¿Quieres que avisemos a los yonkes?": cuándo
// se ofrece "Avisar a los yonkes" ARRIBA de los resultados de la página principal (buscador con
// IA y búsqueda avanzada). Solo cambia lo que se muestra; la búsqueda (±4 años, cualquier año)
// sigue exactamente igual.

// Niveles de resultado sin el año exacto (ver consultarInventario.js y buscarPiezas en HomeClient).
const NIVELES_SIN_ANIO_EXACTO = new Set(['cercano', 'cualquierAno']);

// Se ofrece solo si: es búsqueda de vehículo/pieza (no las pestañas de motor o transmisión), hay
// resultados, vienen de años cercanos o de cualquier año, y el cliente SÍ escribió un año (sin año
// no hay un "año exacto" que faltó). Con año exacto, nunca.
export function debeOfrecerAvisoSinAnioExacto({ tipoBusqueda, tipoResultado, hayResultados, anio }: {
  tipoBusqueda: string; tipoResultado: string; hayResultados: boolean; anio: unknown;
}): boolean {
  return tipoBusqueda === 'vehiculo'
    && hayResultados
    && NIVELES_SIN_ANIO_EXACTO.has(tipoResultado)
    && String(anio ?? '').trim() !== '';
}

export function mensajeAvisoSinAnioExacto({ marca, modelo, anio }: { marca?: unknown; modelo?: unknown; anio?: unknown }): string {
  const vehiculo = [marca, modelo, anio].map((v) => String(v ?? '').trim()).filter(Boolean).join(' ');
  return `No encontramos tu ${vehiculo} exacto. ¿Quieres que avisemos a los yonkes?`;
}
