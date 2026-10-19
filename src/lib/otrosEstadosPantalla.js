import { avisoEnvioOtroEstado } from './pedidosClientes';

// Sección "Disponible en otros estados" de la portada (etapa 2). Lógica pura, sin React: lee la
// respuesta de /api/buscar y decide qué mostrar. Sin los campos nuevos (banderas apagadas en el
// servidor) devuelve null y la pantalla queda idéntica a la de siempre.
// - Caso 'a': el cliente eligió estado y ahí no hubo nada (etapa 1, resultadosOtrosEstados en una
//   respuesta sin resultados). Solo yonkes que envían; las tarjetas van solo con WhatsApp.
// - Caso 'b': "Todos los estados" y ningún resultado del estado del visitante por IP (etapa 1b,
//   sinResultadosEnTuEstado). La IP puede equivocarse: las tarjetas conservan Reservar y "Pedir
//   entrega a mi taller", y el aviso de envío es condicional.

export const AVISO_SIN_ENVIOS = 'ℹ️ Este yonke no anuncia envíos: pregúntale si te la puede mandar.';
export const AVISO_ENVIO_SI_LEJOS = '📦 Si estás lejos de este yonke, pídele fotos o video y confirma el costo del envío antes de pagar.';
export const TEXTO_ELIGE_ESTADO_OTROS = '¿No es tu zona? Elige tu estado';

const conTarjetas = (grupos) => Array.isArray(grupos)
  ? grupos.filter((g) => Array.isArray(g?.resultados) && g.resultados.length > 0)
  : [];

// null o { modo: 'a' | 'b', grupos, busqueda }.
export function leerOtrosEstados(data) {
  const grupos = conTarjetas(data?.resultadosOtrosEstados);
  if (grupos.length === 0) return null;
  const busqueda = data.busqueda || null;
  if (data.estado === 'resultados') {
    return data.sinResultadosEnTuEstado ? { modo: 'b', grupos, busqueda } : null;
  }
  return { modo: 'a', grupos, busqueda };
}

export function tituloOtrosEstados(modo, nombreEstadoCliente) {
  return modo === 'a'
    ? `No hay en ${nombreEstadoCliente}. Esto es lo que hay en otros estados`
    : 'No encontramos en tu zona. Esto es lo que hay en otros estados';
}

// Opciones que reciben las tarjetas de la sección. Reservar y "Pedir entrega" solo se quitan en el
// caso a (estado elegido por el cliente).
export function opcionesTarjetaOtroEstado(modo, busqueda) {
  return { conReservar: modo !== 'a', busqueda: busqueda || null };
}

export function avisoTarjetaOtroEstado(modo, r, estadoNombre) {
  if (r?.enviosNacionales !== true) return AVISO_SIN_ENVIOS;
  return modo === 'a' ? avisoEnvioOtroEstado(estadoNombre) : AVISO_ENVIO_SI_LEJOS;
}

// Cuadro de mensaje del buscador inteligente (HomeClient): qué partes se dibujan adentro. Una sola
// fuente para cada parte y para decidir si el cuadro tiene algo; sin nada adentro no se dibuja
// (antes quedaba una franja vacía con la alerta de un paso + estado elegido + otros estados).
// - texto: oculto con la alerta de un paso y sin_inventario (el título de la alerta ya lo dice);
// - confirmar: "Sí, buscar así / No, corregir";
// - botonTodos: "Buscar en todos los estados", solo con un estado elegido y sin la sección de
//   otros estados (así no se repite la búsqueda).
export function partesCuadroMensaje({ tipo, alertaUnPaso, estadoBusqueda, conOtrosEstados }) {
  return {
    texto: !(alertaUnPaso && tipo === 'sin_inventario'),
    confirmar: tipo === 'confirmar',
    botonTodos: ['sin_inventario', 'no_catalogado', 'sin_yonkes_estado'].includes(tipo) && estadoBusqueda !== 'todos' && !conOtrosEstados,
  };
}

export function cuadroMensajeTieneContenido(partes) {
  return Boolean(partes && (partes.texto || partes.confirmar || partes.botonTodos));
}
