// Alerta de búsqueda SIEMPRE (config/pedidosClientes.alertaSiempre, encendida por omisión: solo
// false la apaga). Lógica pura de qué alerta de un paso (AlertaUnPaso) muestra la portada:
// - sin resultados: la grande ("protagonista"), como siempre;
// - con resultados (exacto, cercano, solo motores/transmisiones, respaldo por vehículo): la chica
//   ("compacta") ARRIBA de las tarjetas; apagada, el botón "discreta" al final, como antes;
// - además, con la bandera, en número de parte, marca muy general y pieza sin vehículo.
// Nunca en "¿Quisiste decir…?", demasiadas búsquedas seguidas ni error.

export const TIPOS_SIN_RESULTADO_CON_ALERTA = ['sin_inventario', 'no_catalogado', 'sin_yonkes_estado', 'sin_en_tu_zona'];
export const TIPOS_EXTRA_ALERTA_SIEMPRE = ['numero_de_parte', 'marca_muy_general', 'pieza_sin_vehiculo'];

// Título del recuadro grande de la alerta cuando la búsqueda no llegó a buscar un vehículo
// (número de parte, marca muy general o pieza sin vehículo): ahí no aplica "No tenemos ese
// vehículo todavía". null para los demás tipos (se queda el título de siempre).
export const TITULO_ALERTA_BUSQUEDA_INCOMPLETA = '¿No encuentras la pieza? Consulta con los yonkes';
// Con config/pedidosClientes.formularioAbierto ("consulta" en lugar de "alerta").
export const TITULO_CONSULTA_BUSQUEDA_INCOMPLETA = '¿No encuentras la pieza? Consulta con los yonkes';
export function tituloAlertaProtagonista(tipo, consulta = false) {
  if (!TIPOS_EXTRA_ALERTA_SIEMPRE.includes(tipo)) return null;
  return consulta ? TITULO_CONSULTA_BUSQUEDA_INCOMPLETA : TITULO_ALERTA_BUSQUEDA_INCOMPLETA;
}

export function alertaSiempreActiva(config) {
  return config?.alertaSiempre !== false;
}

// ¿Este mensaje del buscador inteligente lleva la alerta grande?
export function mensajeConAlerta(tipo, alertaSiempre) {
  return TIPOS_SIN_RESULTADO_CON_ALERTA.includes(tipo)
    || (alertaSiempre && TIPOS_EXTRA_ALERTA_SIEMPRE.includes(tipo));
}

// Con resultados: dónde va la alerta ('arriba' compacta o 'final' discreta).
export function lugarAlertaConResultados(alertaSiempre) {
  return alertaSiempre ? 'arriba' : 'final';
}
