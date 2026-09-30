// Puente entre los dos esquemas de id de "estado de México" que usa el proyecto, sin ninguna
// relación entre sí hoy:
//   - yonkes/{id}.estado / colección `estados`: slug en español (ej. 'nuevo-leon', 'estado-de-mexico',
//     'cdmx'), generado por normalizarId() en admin/estados/page.js.
//   - busquedas.estadoGeografico: código ISO 3166-2:MX de 3 letras en minúsculas (ej. 'nle', 'mex',
//     'cmx'), el mismo esquema de @svg-maps/mexico que ya usa admin/busquedas/mapa/page.js.
//
// Auditoría 2026-09-29: se leyó la colección `estados` en vivo (solo lectura) y confirmó estos 32
// ids exactos, ya con los 32 estados de México dados de alta. Esta tabla es estática a propósito
// (sin leer Firestore en cada request) porque el conjunto de estados de México no cambia.

export const ESTADO_A_CODIGO_GEO: Record<string, string> = {
  'aguascalientes': 'agu',
  'baja-california': 'bcn',
  'baja-california-sur': 'bcs',
  'campeche': 'cam',
  'cdmx': 'cmx',
  'chiapas': 'chp',
  'chihuahua': 'chh',
  'coahuila': 'coa',
  'colima': 'col',
  'durango': 'dur',
  'estado-de-mexico': 'mex',
  'guanajuato': 'gua',
  'guerrero': 'gro',
  'hidalgo': 'hid',
  'jalisco': 'jal',
  'michoacan': 'mic',
  'morelos': 'mor',
  'nayarit': 'nay',
  'nuevo-leon': 'nle',
  'oaxaca': 'oax',
  'puebla': 'pue',
  'queretaro': 'que',
  'quintana-roo': 'roo',
  'san-luis-potosi': 'slp',
  'sinaloa': 'sin',
  'sonora': 'son',
  'tabasco': 'tab',
  'tamaulipas': 'tam',
  'tlaxcala': 'tla',
  'veracruz': 'ver',
  'yucatan': 'yuc',
  'zacatecas': 'zac',
};

export const CODIGO_GEO_A_ESTADO: Record<string, string> = Object.fromEntries(
  Object.entries(ESTADO_A_CODIGO_GEO).map(([estadoId, codigo]) => [codigo, estadoId]),
);

// null si el id de estado no tiene código conocido (nunca debería pasar con los 32 ids reales,
// pero un dato corrupto o un estado nuevo agregado sin actualizar esta tabla no debe romper nada).
export function codigoGeoDeEstado(estadoId: string): string | null {
  return ESTADO_A_CODIGO_GEO[estadoId] ?? null;
}

export function estadoDeCodigoGeo(codigo: string): string | null {
  return CODIGO_GEO_A_ESTADO[codigo] ?? null;
}
