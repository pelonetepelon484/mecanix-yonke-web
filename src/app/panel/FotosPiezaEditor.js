'use client';

// Hasta 3 fotos para un motor/transmisión suelto o una pieza suelta. Cada espacio es el mismo
// FotoPiezaEditor de 1 foto (sube con la misma compresión, reintenta, borra el archivo viejo
// después de guardar), así que aquí solo se arma la lista. Compatibilidad: una pieza vieja con
// solo `foto` muestra esa foto como la primera (ver src/lib/fotosPieza.ts).
//
// onGuardar(listaNueva): async, guarda la lista completa en Firestore (camposFotos). Los
// guardados van en fila, uno tras otro: dos fotos subidas casi al mismo tiempo nunca se pisan.
import { useEffect, useRef } from 'react';
import FotoPiezaEditor from './FotoPiezaEditor';
import { MAX_FOTOS_PIEZA, claveFoto, fotosDeItem, reemplazarFoto } from '../../lib/fotosPieza';

export default function FotosPiezaEditor({ carpeta, id, item, onGuardar, deshabilitado = false }) {
  const fotos = fotosDeItem(item);
  const claveLista = fotos.map(claveFoto).join('|');
  const listaActual = useRef(fotos);
  const fila = useRef(Promise.resolve());

  // La lista que llega de afuera manda (por ejemplo, al abrir otro motor en el mismo modal).
  useEffect(() => {
    listaActual.current = fotosDeItem(item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, claveLista]);

  function guardarCambio(claveAnterior, nueva) {
    const tarea = fila.current.then(async () => {
      const lista = reemplazarFoto(listaActual.current, claveAnterior, nueva);
      await onGuardar(lista);
      listaActual.current = lista;
    });
    fila.current = tarea.catch(() => {});
    return tarea; // si falla, FotoPiezaEditor borra el archivo recién subido y muestra el error
  }

  return (
    <div>
      <p style={contadorStyle}>{fotos.length} de {MAX_FOTOS_PIEZA} fotos</p>
      <div style={listaStyle}>
        {fotos.map((foto) => (
          <FotoPiezaEditor
            key={claveFoto(foto)}
            carpeta={carpeta}
            id={id}
            foto={foto}
            deshabilitado={deshabilitado}
            onGuardar={(nueva) => guardarCambio(claveFoto(foto), nueva)}
          />
        ))}
        {fotos.length < MAX_FOTOS_PIEZA && (
          <FotoPiezaEditor
            key={`nueva-${claveLista}`}
            carpeta={carpeta}
            id={id}
            foto={null}
            deshabilitado={deshabilitado}
            onGuardar={(nueva) => guardarCambio(null, nueva)}
          />
        )}
      </div>
    </div>
  );
}

const contadorStyle = { fontSize: '12px', color: '#888', margin: '0 0 6px' };
const listaStyle = { display: 'flex', flexDirection: 'column', gap: '8px' };
