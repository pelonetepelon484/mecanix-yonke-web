import { CONSEJOS_ENVIO } from './pedidosClientes';

// Sección "Disponible en otros estados" de la portada (etapa 2). Lógica pura, sin React: lee la
// respuesta de /api/buscar y decide qué mostrar. Sin los campos nuevos (banderas apagadas en el
// servidor) devuelve null y la pantalla queda idéntica a la de siempre.
// - Caso 'a': el cliente eligió estado y ahí no hubo nada (etapa 1, resultadosOtrosEstados en una
//   respuesta sin resultados). Los que envían primero y los que no con su aviso; las tarjetas van
//   solo con WhatsApp.
// - Caso 'b': "Todos los estados" y ningún resultado del estado del visitante por IP (etapa 1b,
//   sinResultadosEnTuEstado). La IP puede equivocarse: las tarjetas conservan Reservar y "Pedir
//   entrega a mi taller", y el aviso de envío es condicional.

// Aviso de envío de las tarjetas con Envíos nacionales: el MISMO texto aprobado de la página de
// respuestas (/mi-pedido, CONSEJOS_ENVIO en src/lib/pedidosClientes.ts).
export const AVISO_SIN_ENVIOS = 'ℹ️ Este yonke no anuncia envíos: pregúntale si te la puede mandar.';
export const AVISO_ENVIO_SI_LEJOS = CONSEJOS_ENVIO;
export const TEXTO_ELIGE_ESTADO_OTROS = '¿No es tu estado? Elígelo aquí';

// Caso a: título y texto del recuadro de la alerta de un paso (AlertaUnPaso, protagonista) cuando
// abajo sí hay resultados de otros estados. El botón de la alerta no cambia.
export const TITULO_CON_OTROS_ESTADOS = 'Lo encontramos en otros estados';
export const textoConOtrosEstados = (nombreEstado) =>
  `No hay yonkes de ${nombreEstado || 'tu estado'} con ese vehículo, pero abajo ves los de otros estados. ¿Lo quieres solo en tu estado? Activa la alerta de búsqueda.`;

// Scroll automático hacia el encabezado de la sección (config/buscador.scrollOtrosEstados): espacio
// que se deja ARRIBA del encabezado, en píxeles, para que se alcance a ver el final del recuadro
// de la alerta. Se suma la altura de cualquier barra fija de arriba (alturaBarrasFijasArriba).
export const MARGEN_SCROLL_OTROS_ESTADOS = 120;

const conTarjetas = (grupos) => Array.isArray(grupos)
  ? grupos.filter((g) => Array.isArray(g?.resultados) && g.resultados.length > 0)
  : [];

// null o { modo: 'a' | 'b', grupos, busqueda, scroll }. scroll: solo en el caso a y solo si el
// servidor lo pidió (scrollOtrosEstados: true, su bandera).
export function leerOtrosEstados(data) {
  const grupos = conTarjetas(data?.resultadosOtrosEstados);
  if (grupos.length === 0) return null;
  const busqueda = data.busqueda || null;
  if (data.estado === 'resultados') {
    return data.sinResultadosEnTuEstado ? { modo: 'b', grupos, busqueda, scroll: false } : null;
  }
  return { modo: 'a', grupos, busqueda, scroll: data.scrollOtrosEstados === true };
}

export function tituloOtrosEstados(modo, nombreEstadoCliente) {
  return modo === 'a'
    ? `No hay en ${nombreEstadoCliente}. Esto es lo que hay en otros estados`
    : 'No encontramos en tu estado. Esto es lo que hay en otros estados';
}

// Opciones que reciben las tarjetas de la sección. Reservar y "Pedir entrega" solo se quitan en el
// caso a (estado elegido por el cliente).
export function opcionesTarjetaOtroEstado(modo, busqueda) {
  return { conReservar: modo !== 'a', busqueda: busqueda || null };
}

export function avisoTarjetaOtroEstado(r) {
  return r?.enviosNacionales === true ? CONSEJOS_ENVIO : AVISO_SIN_ENVIOS;
}

// Cuadro de mensaje del buscador inteligente (HomeClient): qué partes se dibujan adentro. Una sola
// fuente para cada parte y para decidir si el cuadro tiene algo; sin nada adentro no se dibuja
// (antes quedaba una franja vacía con la alerta de un paso + estado elegido + otros estados).
// - texto: oculto con la alerta de un paso y sin_inventario (el título de la alerta ya lo dice), y
//   cuando abajo SÍ se muestran resultados de otros estados (seMuestranOtrosEstados): con
//   sin_yonkes_estado SIEMPRE ("Prueba buscando en Todos los estados" los contradiría, haya o no
//   alerta de un paso) y con sin_inventario solo con la alerta de un paso (sin ella, su texto
//   "No tenemos esa pieza en inventario ahorita." no contradice nada y es la única explicación);
// - confirmar: "Sí, buscar así / No, corregir";
// - botonTodos: "Buscar en todos los estados", solo con un estado elegido y cuando el servidor NO
//   buscó ya en otros estados (conOtrosEstados: llegó la sección o otrosEstadosRevisados). Así
//   solo se ve donde hace falta: "no identificamos el modelo", bandera apagada o búsqueda cortada.
// sinYonkesYaRevisado (solo con config/pedidosClientes.formularioAbierto): ya se buscó en otros
// estados, así que "Aún no tenemos yonkes registrados en… Prueba buscando en Todos los estados" no
// sale, aunque allá tampoco haya resultados.
export function partesCuadroMensaje({ tipo, alertaUnPaso, estadoBusqueda, conOtrosEstados, seMuestranOtrosEstados = false, sinYonkesYaRevisado = false }) {
  return {
    texto: !(alertaUnPaso && tipo === 'sin_inventario')
      && !(seMuestranOtrosEstados && (tipo === 'sin_yonkes_estado' || (alertaUnPaso && tipo === 'sin_inventario')))
      && !(sinYonkesYaRevisado && tipo === 'sin_yonkes_estado'),
    confirmar: tipo === 'confirmar',
    botonTodos: ['sin_inventario', 'no_catalogado', 'sin_yonkes_estado'].includes(tipo) && estadoBusqueda !== 'todos' && !conOtrosEstados,
  };
}

export function cuadroMensajeTieneContenido(partes) {
  return Boolean(partes && (partes.texto || partes.confirmar || partes.botonTodos));
}
