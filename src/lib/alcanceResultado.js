// Alcance del resultado de una búsqueda del buscador inteligente (lógica pura). Tres valores:
// - 'con_resultado': hubo resultados en el alcance que pidió el cliente;
// - 'solo_otros_estados': en su estado no hubo, pero se le mostraron resultados de otros estados
//   (config/buscador.otrosEstadosSinResultados con resultados, o "Todos los estados" por IP sin
//   nada del estado del visitante: config/buscador.otrosEstadosPorIp);
// - 'sin_resultado': no hubo nada en ningún estado (o la búsqueda no llegó a buscar).
// conResultado (estado === 'ok') NO cambia de significado: se sigue guardando igual.

export const ALCANCES_RESULTADO = ['con_resultado', 'solo_otros_estados', 'sin_resultado'];

// Al guardar (registrarBusqueda): con los mismos datos que ya se guardan.
export function calcularAlcanceResultado({ estado, soloOtrosEstados = false, otrosEstados = null }) {
  if (estado === 'ok') return soloOtrosEstados === true ? 'solo_otros_estados' : 'con_resultado';
  if (Number.isInteger(otrosEstados?.mostrados) && otrosEstados.mostrados > 0) return 'solo_otros_estados';
  return 'sin_resultado';
}

// Al leer, para registros de busquedas (admin) y de busquedasResumen (yonke), nuevos o viejos, sin
// reescribir nada. Si el registro trae alcanceResultado, ese. Si no (registros de antes):
// soloOtrosEstados → otrosEstados.mostrados > 0 → conResultado → estado === 'ok' (los más
// viejos). busquedasResumen nunca tuvo soloOtrosEstados ni otrosEstados: queda en conResultado.
export function alcanceResultado(d) {
  if (ALCANCES_RESULTADO.includes(d?.alcanceResultado)) return d.alcanceResultado;
  if (d?.soloOtrosEstados === true) return 'solo_otros_estados';
  if (Number.isInteger(d?.otrosEstados?.mostrados) && d.otrosEstados.mostrados > 0) return 'solo_otros_estados';
  const con = typeof d?.conResultado === 'boolean' ? d.conResultado : d?.estado === 'ok';
  return con ? 'con_resultado' : 'sin_resultado';
}

// Etiqueta y color de cada alcance (mapa de búsquedas del admin).
export const ETIQUETAS_ALCANCE = {
  con_resultado: { texto: '✓ Con resultado', color: '#2E7D32' },
  solo_otros_estados: { texto: '↗ Solo en otros estados', color: '#1565C0' },
  sin_resultado: { texto: '✗ Sin resultado', color: '#C62828' },
};
