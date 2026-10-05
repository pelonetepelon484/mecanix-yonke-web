'use client';

import { useState, useEffect } from 'react';
import { subirFotoPieza, borrarFotoPieza, validarArchivoFotoPieza } from '../lib/piezaFotoStorage';

function mensajeDeError(error) {
  if (error?.code === 'storage/unauthorized' || error?.code === 'permission-denied') {
    return 'No tienes permiso para guardar esta imagen. Avísale a Mecanix.';
  }
  return error?.message || 'No se pudo completar la operación. Intenta de nuevo.';
}

// 1 foto opcional, reusada para pieza de vehículo, motor/transmisión suelto y pieza suelta -- el
// llamador decide dónde vive en Storage (`carpeta` + `id`) y cómo se guarda en Firestore
// (`onGuardar`), este componente no conoce esos detalles de cada entidad.
//
// onGuardar(nuevaFotoOrNull): async, hace el updateDoc/deleteField real. Si lanza, este
// componente borra el archivo recién subido (huérfano) y muestra el error con botón Reintentar
// -- el guardado del registro en sí nunca depende de que esto funcione.
export default function FotoPiezaEditor({ carpeta, id, foto, onGuardar, deshabilitado = false }) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [pendiente, setPendiente] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function procesar(file) {
    setError('');
    const errorValidacion = validarArchivoFotoPieza(file);
    if (errorValidacion) { setError(errorValidacion); return; }

    setPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
    setPendiente(file);
    setOcupado(true);

    const anterior = foto || null;
    try {
      const nueva = await subirFotoPieza(carpeta, id, file);
      try {
        await onGuardar(nueva);
      } catch (errorGuardado) {
        await borrarFotoPieza(nueva.path).catch(() => {});
        throw errorGuardado;
      }
      if (anterior?.path) {
        await borrarFotoPieza(anterior.path).catch((err) => console.error('No se pudo borrar la foto anterior', err));
      }
      setPendiente(null);
    } catch (e) {
      console.error(e);
      setError(mensajeDeError(e));
      // `pendiente` se conserva a propósito para que "Reintentar" suba el mismo archivo.
    } finally {
      setOcupado(false);
    }
  }

  function elegir(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    procesar(file);
  }

  function reintentar() {
    if (pendiente) procesar(pendiente);
  }

  async function eliminar() {
    if (!foto) return;
    if (!confirm('¿Eliminar esta foto?')) return;
    setOcupado(true);
    setError('');
    try {
      await onGuardar(null);
      await borrarFotoPieza(foto.path).catch((err) => console.error('No se pudo borrar la foto', err));
      setPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    } catch (e) {
      console.error(e);
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  }

  const bloqueado = deshabilitado || ocupado;
  const imagenAMostrar = preview || foto?.url;

  return (
    <div style={contenedorStyle}>
      <div style={miniaturaContenedorStyle}>
        {imagenAMostrar ? (
          <img src={imagenAMostrar} alt="" loading="lazy" style={miniaturaStyle} />
        ) : (
          <span style={{ fontSize: '16px', color: '#ccc' }}>📷</span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {error ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <p role="alert" style={errorTextoStyle}>{error}</p>
            {pendiente ? (
              <button type="button" onClick={reintentar} disabled={bloqueado} style={botonMiniStyle}>Reintentar</button>
            ) : (
              <label style={{ ...botonMiniStyle, opacity: bloqueado ? 0.5 : 1, cursor: bloqueado ? 'wait' : 'pointer' }}>
                Elegir otra
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={elegir} disabled={bloqueado} style={{ display: 'none' }} />
              </label>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '4px' }}>
            <label style={{ ...botonMiniStyle, opacity: bloqueado ? 0.5 : 1, cursor: bloqueado ? 'wait' : 'pointer' }} title="Tomar foto">
              📷
              <input type="file" accept="image/*" capture="environment" aria-label="Tomar foto" onChange={elegir} disabled={bloqueado} style={{ display: 'none' }} />
            </label>
            <label style={{ ...botonMiniStyle, opacity: bloqueado ? 0.5 : 1, cursor: bloqueado ? 'wait' : 'pointer' }} title="Elegir de galería">
              🖼️
              <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Elegir de galería" onChange={elegir} disabled={bloqueado} style={{ display: 'none' }} />
            </label>
            {foto && (
              <button type="button" onClick={eliminar} disabled={bloqueado} style={botonEliminarMiniStyle} aria-label="Eliminar foto">✕</button>
            )}
          </div>
        )}
        {ocupado && <p style={subiendoTextoStyle}>Subiendo...</p>}
      </div>
    </div>
  );
}

const contenedorStyle = { display: 'flex', alignItems: 'center', gap: '8px' };
const miniaturaContenedorStyle = {
  width: '40px', height: '40px', borderRadius: '6px', backgroundColor: '#F4F5F5',
  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
};
const miniaturaStyle = { width: '100%', height: '100%', objectFit: 'cover' };
const botonMiniStyle = {
  padding: '5px 7px', borderRadius: '6px', border: '1.5px solid #1A3C5E', backgroundColor: '#fff',
  color: '#1A3C5E', fontWeight: 'bold', fontSize: '12px', display: 'inline-block', lineHeight: '1',
};
const botonEliminarMiniStyle = {
  padding: '5px 7px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent',
  color: '#D85A30', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer',
};
const errorTextoStyle = { color: '#C0392B', fontSize: '11px', margin: 0, lineHeight: '1.3' };
const subiendoTextoStyle = { color: '#888', fontSize: '11px', margin: 0 };
