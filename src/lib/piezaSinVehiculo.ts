// Gate del buscador inteligente: cuando el texto trae una PIEZA pero no un vehículo lo bastante
// específico para saber qué versión de la pieza aplica, no se debe intentar la búsqueda — se
// avisa al cliente en vez de mostrarle piezas que podrían no ser compatibles (ver auditoría
// 2026-09-28: "calavera", "facia trasera de mk6" llenaban el reporte de ruido sin poder ofrecer
// resultados confiables).
//
// "Vehículo lo bastante específico" = hay MODELO resuelto. Una marca sola NO alcanza: viene de
// un alias de plataforma ambiguo (ej. "mk6" -> Volkswagen, podría ser Golf, Jetta, GTI...) o de
// que el cliente solo dijo la marca ("calavera de chevrolet") — ninguno de los dos casos permite
// saber qué versión de la pieza le queda. Una cilindrada (ej. "arranque 3.6") sí es suficiente,
// porque consultarInventario.js la cruza contra vehiculo.cilindrada para filtrar de verdad.

function normalizarPieza(pieza: string): string {
  return pieza.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Piezas que no dependen del vehículo (se venden/buscan igual sin importar marca/modelo/año) —
// lista configurable: agregar aquí el nombre EXACTO tal como lo devuelve extraerPieza() (el
// nombre canónico del catálogo de piezas), normalizado se compara sin acentos/mayúsculas.
// Nota (auditoría 2026-09-28): "aceite" y "batería" son solo el ejemplo típico de este tipo de
// pieza — hoy NINGUNO de los dos existe todavía en PIEZAS_CATALOGO (src/app/lib/piezasCatalogo.js),
// así que esta lista no tiene efecto práctico hasta que se agreguen ahí también.
export const PIEZAS_EXENTAS_DE_VEHICULO: string[] = ['Aceite', 'Batería'];

const PIEZAS_EXENTAS_NORMALIZADAS = new Set(PIEZAS_EXENTAS_DE_VEHICULO.map(normalizarPieza));

export function piezaExentaDeVehiculo(pieza: string | null | undefined): boolean {
  if (!pieza) return false;
  return PIEZAS_EXENTAS_NORMALIZADAS.has(normalizarPieza(pieza));
}

export interface DatosParaGateVehiculo {
  pieza: string | null | undefined;
  modelo: string | null | undefined;
  cilindrada: number | null | undefined;
}

// true = mostrar el aviso "dinos tu vehículo" EN VEZ de intentar la búsqueda. Se usa tanto en el
// flujo normal (extraerIntencion.js, con la intención recién interpretada) como en el flujo de
// "confirmado" de route.js (cuando el cliente ya venía de una aclaración de typo/cilindrada) —
// misma función, para que las dos rutas nunca se desincronicen.
export function debeMostrarAvisoPiezaSinVehiculo({ pieza, modelo, cilindrada }: DatosParaGateVehiculo): boolean {
  if (!pieza) return false;
  if (modelo) return false;
  if (cilindrada != null) return false;
  if (piezaExentaDeVehiculo(pieza)) return false;
  return true;
}
