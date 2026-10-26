// "No encontramos el año exacto de tu [marca] [modelo] [año]." + "Activa una alerta de búsqueda": cuándo
// se ofrece la alerta (el formulario AvisarYonkes) ARRIBA de los resultados de la página principal (buscador con
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

export function tituloAvisoSinAnioExacto({ marca, modelo, anio }: { marca?: unknown; modelo?: unknown; anio?: unknown }): string {
  const vehiculo = [marca, modelo, anio].map((v) => String(v ?? '').trim()).filter(Boolean).join(' ');
  return `No encontramos el año exacto de tu ${vehiculo}.`;
}

export const MENSAJE_AVISO_SIN_ANIO_EXACTO =
  'Si quieres, consulta con los yonkes: verán tu búsqueda activa (sin tus datos de contacto) y te responderán aquí si tienen la pieza.';
// Con config/pedidosClientes.formularioAbierto.
export const MENSAJE_AVISO_SIN_ANIO_EXACTO_CONSULTA =
  'Si quieres, consulta con los yonkes: verán tu búsqueda activa (sin tus datos de contacto) y te responderán aquí si tienen la pieza.';
