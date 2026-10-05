'use client';

import { useState, useEffect } from 'react';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { subirFotoVehiculo, borrarFotoVehiculo, validarArchivoFotoVehiculo, SLOTS_FOTO_VEHICULO } from '../lib/vehiculoFotosStorage';

const ETIQUETAS_SLOT = {
  frontal: 'Frontal', trasera: 'Trasera', derecha: 'Lateral derecho', izquierda: 'Lateral izquierdo',
};

function mensajeDeError(error) {
  if (error?.code === 'storage/unauthorized' || error?.code === 'permission-denied') {
    return 'No tienes permiso para guardar esta imagen. Avísale a Mecanix.';
  }
  return error?.message || 'No se pudo completar la operación. Intenta de nuevo.';
}

// 4 fotos fijas por vehículo (frontal/trasera/derecha/izquierda), todas opcionales. Requiere
// vehiculoId real -- solo se debe mostrar para un vehículo que YA existe en Firestore (el path de
// Storage lo necesita); para un vehículo nuevo, el llamador primero guarda el documento y recién
// entonces muestra este editor (ver guardarVehiculo en panel/inventario/page.js).
//
// Guarda cada slot en yonkes/{yonkeId}/vehiculos/{vehiculoId}.fotos.{slot} = {url, path} con una
// escritura de campo puntual (dot-path), para no tener que reenviar los otros 3 slots en cada
// subida. Secuencia al reemplazar: sube la nueva -> guarda en Firestore -> si eso falla, borra lo
// recién subido (huérfano); si guarda bien, borra la anterior por su path. Mismo orden que
// PromoImagenesEditor.js.
export default function VehiculoFotosEditor({ yonkeId, vehiculoId, fotos, onChange }) {
  const [ocupado, setOcupado] = useState(false);
  const [slotSubiendo, setSlotSubiendo] = useState(null);
  const [errores, setErrores] = useState({});
  const [pendientes, setPendientes] = useState({});
  const [previews, setPreviews] = useState({});

  // Revoca los object URLs locales al desmontar -- nunca se quedan colgados en memoria.
  useEffect(() => () => {
    Object.values(previews).forEach((url) => URL.revokeObjectURL(url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardarSlotEnFirestore(slot, nuevaFotoONull) {
    const ref = doc(db, 'yonkes', yonkeId, 'vehiculos', vehiculoId);
    await updateDoc(ref, { [`fotos.${slot}`]: nuevaFotoONull === null ? deleteField() : nuevaFotoONull });
  }

  async function procesarArchivo(slot, file) {
    setErrores((prev) => ({ ...prev, [slot]: '' }));
    const errorValidacion = validarArchivoFotoVehiculo(file);
    if (errorValidacion) {
      setErrores((prev) => ({ ...prev, [slot]: errorValidacion }));
      return;
    }

    setPreviews((prev) => {
      if (prev[slot]) URL.revokeObjectURL(prev[slot]);
      return { ...prev, [slot]: URL.createObjectURL(file) };
    });
    setPendientes((prev) => ({ ...prev, [slot]: file }));
    setOcupado(true);
    setSlotSubiendo(slot);

    const anterior = fotos?.[slot] || null;
    try {
      const nueva = await subirFotoVehiculo(yonkeId, vehiculoId, slot, file);
      try {
        await guardarSlotEnFirestore(slot, nueva);
      } catch (errorGuardado) {
        await borrarFotoVehiculo(nueva.path).catch(() => {});
        throw errorGuardado;
      }
      if (anterior?.path) {
        await borrarFotoVehiculo(anterior.path).catch((err) => console.error('No se pudo borrar la foto anterior', err));
      }
      onChange({ ...fotos, [slot]: nueva });
      setPendientes((prev) => { const { [slot]: _quitado, ...resto } = prev; return resto; });
    } catch (error) {
      console.error(error);
      setErrores((prev) => ({ ...prev, [slot]: mensajeDeError(error) }));
      // `pendientes[slot]` se conserva a propósito: así "Reintentar" vuelve a subir el mismo
      // archivo sin que el usuario tenga que elegirlo de nuevo.
    } finally {
      setOcupado(false);
      setSlotSubiendo(null);
    }
  }

  function elegirArchivo(slot, e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    procesarArchivo(slot, file);
  }

  function reintentar(slot) {
    const file = pendientes[slot];
    if (file) procesarArchivo(slot, file);
  }

  async function eliminar(slot) {
    const actual = fotos?.[slot];
    if (!actual) return;
    if (!confirm('¿Eliminar esta foto?')) return;
    setOcupado(true);
    setSlotSubiendo(slot);
    setErrores((prev) => ({ ...prev, [slot]: '' }));
    try {
      await guardarSlotEnFirestore(slot, null);
      await borrarFotoVehiculo(actual.path).catch((err) => console.error('No se pudo borrar la foto', err));
      setPreviews((prev) => {
        if (prev[slot]) URL.revokeObjectURL(prev[slot]);
        const { [slot]: _quitado, ...resto } = prev;
        return resto;
      });
      onChange({ ...fotos, [slot]: undefined });
    } catch (error) {
      console.error(error);
      setErrores((prev) => ({ ...prev, [slot]: mensajeDeError(error) }));
    } finally {
      setOcupado(false);
      setSlotSubiendo(null);
    }
  }

  return (
    <div style={{ marginBottom: '14px' }}>
      <p style={notaStyle}>Fotos del vehículo (opcional) — hasta 4, una por lado.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
        {SLOTS_FOTO_VEHICULO.map((slot) => {
          const foto = fotos?.[slot];
          const preview = previews[slot];
          const subiendoEsteSlot = slotSubiendo === slot;
          const error = errores[slot];
          const hayPendiente = !!pendientes[slot];
          return (
            <div key={slot} style={slotCardStyle}>
              <p style={slotLabelStyle}>{ETIQUETAS_SLOT[slot]}</p>
              <div style={miniaturaContenedorStyle}>
                {preview || foto?.url ? (
                  <img src={preview || foto.url} alt={ETIQUETAS_SLOT[slot]} loading="lazy" style={miniaturaStyle} />
                ) : (
                  <span style={{ fontSize: '22px', color: '#ccc' }}>📷</span>
                )}
                {subiendoEsteSlot && <div style={overlaySubiendoStyle}>Subiendo...</div>}
              </div>
              {error ? (
                <div>
                  <p role="alert" style={errorTextoStyle}>{error}</p>
                  {hayPendiente ? (
                    <button type="button" onClick={() => reintentar(slot)} disabled={ocupado} style={botonMiniStyle}>
                      Reintentar
                    </button>
                  ) : (
                    <label style={{ ...botonMiniStyle, opacity: ocupado ? 0.5 : 1, cursor: ocupado ? 'wait' : 'pointer' }}>
                      Elegir otra
                      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => elegirArchivo(slot, e)} disabled={ocupado} style={{ display: 'none' }} />
                    </label>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  <label style={{ ...botonMiniStyle, opacity: ocupado ? 0.5 : 1, cursor: ocupado ? 'wait' : 'pointer' }}>
                    📷 Tomar
                    <input type="file" accept="image/*" capture="environment" aria-label={`Tomar foto — ${ETIQUETAS_SLOT[slot]}`} onChange={(e) => elegirArchivo(slot, e)} disabled={ocupado} style={{ display: 'none' }} />
                  </label>
                  <label style={{ ...botonMiniStyle, opacity: ocupado ? 0.5 : 1, cursor: ocupado ? 'wait' : 'pointer' }}>
                    🖼️ Galería
                    <input type="file" accept="image/png,image/jpeg,image/webp" aria-label={`Elegir de galería — ${ETIQUETAS_SLOT[slot]}`} onChange={(e) => elegirArchivo(slot, e)} disabled={ocupado} style={{ display: 'none' }} />
                  </label>
                  {foto && (
                    <button type="button" onClick={() => eliminar(slot)} disabled={ocupado} style={botonEliminarMiniStyle}>
                      Eliminar
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const notaStyle = { fontSize: '12px', color: '#666', margin: '0 0 8px', lineHeight: '1.4' };
const slotCardStyle = { backgroundColor: '#F4F5F5', borderRadius: '10px', padding: '10px' };
const slotLabelStyle = { fontSize: '12px', fontWeight: 'bold', color: '#1A3C5E', margin: '0 0 6px' };
const miniaturaContenedorStyle = {
  position: 'relative', width: '100%', aspectRatio: '4 / 3', borderRadius: '8px', backgroundColor: '#fff',
  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: '6px',
};
const miniaturaStyle = { width: '100%', height: '100%', objectFit: 'cover' };
const overlaySubiendoStyle = {
  position: 'absolute', inset: 0, backgroundColor: 'rgba(26,60,94,0.75)', color: '#fff',
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold',
};
const botonMiniStyle = {
  padding: '6px 8px', borderRadius: '6px', border: '1.5px solid #1A3C5E', backgroundColor: '#fff',
  color: '#1A3C5E', fontWeight: 'bold', fontSize: '11px', display: 'inline-block',
};
const botonEliminarMiniStyle = {
  padding: '6px 8px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent',
  color: '#D85A30', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer',
};
const errorTextoStyle = { color: '#C0392B', fontSize: '11px', margin: '0 0 6px', lineHeight: '1.4' };
