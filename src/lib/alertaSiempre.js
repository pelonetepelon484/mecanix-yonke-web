// Alerta de búsqueda SIEMPRE (config/pedidosClientes.alertaSiempre, encendida por omisión: solo
// false la apaga). Lógica pura de qué alerta de un paso (AlertaUnPaso) muestra la portada:
// - sin resultados: la grande ("protagonista"), como siempre;
// - con resultados (exacto, cercano, solo motores/transmisiones, respaldo por vehículo): la chica
//   ("compacta") ARRIBA de las tarjetas; apagada, el botón "discreta" al final, como antes;
// - además, con la bandera, en número de parte, marca muy general y pieza sin vehículo.
// Nunca en "¿Quisiste decir…?", demasiadas búsquedas seguidas ni error.

export const TIPOS_SIN_RESULTADO_CON_ALERTA = ['sin_inventario', 'no_catalogado', 'sin_yonkes_estado', 'sin_en_tu_zona'];
export const TIPOS_EXTRA_ALERTA_SIEMPRE = ['numero_de_parte', 'marca_muy_general', 'pieza_sin_vehiculo'];

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
