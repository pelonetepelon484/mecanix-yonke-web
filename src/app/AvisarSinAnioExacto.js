'use client';

// Recuadro "No encontramos tu [marca] [modelo] [año] exacta." con "🚨 Activar alerta de búsqueda 🚨"
// arriba de los resultados de años cercanos o de cualquier año (buscador con IA y búsqueda
// avanzada usan la misma sección de resultados de HomeClient). Es el mismo formulario
// "Avisar a los yonkes", prellenado con lo que buscó el cliente; con config/pedidosClientes
// apagada, AvisarYonkes no muestra nada y la página queda como siempre.
import AvisarYonkes from './AvisarYonkes';
import { MENSAJE_AVISO_SIN_ANIO_EXACTO, debeOfrecerAvisoSinAnioExacto, tituloAvisoSinAnioExacto } from '../lib/avisoSinAnioExacto';

export default function AvisarSinAnioExacto({ tipoBusqueda, tipoResultado, hayResultados, marca, modelo, anio, pieza, estado }) {
  if (!debeOfrecerAvisoSinAnioExacto({ tipoBusqueda, tipoResultado, hayResultados, anio })) return null;
  return (
    <AvisarYonkes
      // Otra búsqueda = formulario nuevo con sus datos (el prellenado se toma al montarse).
      key={[marca, modelo, anio, pieza].join('|')}
      destacado
      titulo={tituloAvisoSinAnioExacto({ marca, modelo, anio })}
      mensaje={MENSAJE_AVISO_SIN_ANIO_EXACTO}
      marcaInicial={marca}
      modeloInicial={modelo}
      anioInicial={anio}
      piezaInicial={pieza}
      estadoInicial={estado}
    />
  );
}
