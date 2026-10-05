'use client';

import { useState, useEffect, useRef } from 'react';
import { SLOTS_FOTO_VEHICULO } from './vehiculoFotosStorage';

const ETIQUETAS_SLOT = {
  frontal: 'Frontal', trasera: 'Trasera', derecha: 'Lateral derecho', izquierda: 'Lateral izquierdo',
};

const UMBRAL_SWIPE_PX = 40;

// Visor de pantalla completa con las fotos de un vehículo (hasta 4), deslizable. Solo se monta
// cuando el usuario toca la foto frontal de una tarjeta -- las otras 3 fotos nunca se piden al
// navegador hasta ese momento, porque este componente (y sus <img>) no existen en el DOM antes.
// Cierra con el botón, tocando fuera de la imagen, o Escape.
export default function VisorFotosVehiculo({ fotos, nombreVehiculo, slotInicial, onClose }) {
  const items = SLOTS_FOTO_VEHICULO
    .filter((slot) => fotos?.[slot]?.url)
    .map((slot) => ({ slot, url: fotos[slot].url }));

  const indiceInicial = Math.max(0, items.findIndex((it) => it.slot === slotInicial));
  const [indice, setIndice] = useState(indiceInicial);
  const tocandoDesde = useRef(null);

  useEffect(() => {
    function alTeclado(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndice((i) => Math.min(i + 1, items.length - 1));
      if (e.key === 'ArrowLeft') setIndice((i) => Math.max(i - 1, 0));
    }
    document.addEventListener('keydown', alTeclado);
    return () => document.removeEventListener('keydown', alTeclado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (items.length === 0) return null;
  const actual = items[indice];

  function siguiente() { setIndice((i) => Math.min(i + 1, items.length - 1)); }
  function anterior() { setIndice((i) => Math.max(i - 1, 0)); }

  function alTocarInicio(e) { tocandoDesde.current = e.touches[0].clientX; }
  function alTocarFin(e) {
    if (tocandoDesde.current == null) return;
    const delta = e.changedTouches[0].clientX - tocandoDesde.current;
    tocandoDesde.current = null;
    if (delta <= -UMBRAL_SWIPE_PX) siguiente();
    else if (delta >= UMBRAL_SWIPE_PX) anterior();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Fotos de ${nombreVehiculo}`}
      onClick={onClose}
      style={overlayStyle}
    >
      <button type="button" onClick={onClose} aria-label="Cerrar" style={cerrarStyle}>✕</button>

      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={alTocarInicio}
        onTouchEnd={alTocarFin}
        style={contenidoStyle}
      >
        {items.length > 1 && indice > 0 && (
          <button type="button" onClick={anterior} aria-label="Foto anterior" style={{ ...flechaStyle, left: '8px' }}>‹</button>
        )}
        <img
          src={actual.url}
          alt={`${nombreVehiculo} — ${ETIQUETAS_SLOT[actual.slot]}`}
          style={imagenStyle}
        />
        {items.length > 1 && indice < items.length - 1 && (
          <button type="button" onClick={siguiente} aria-label="Foto siguiente" style={{ ...flechaStyle, right: '8px' }}>›</button>
        )}
      </div>

      {items.length > 1 && (
        <div style={puntosContenedorStyle} onClick={(e) => e.stopPropagation()}>
          {items.map((it, i) => (
            <button
              key={it.slot}
              type="button"
              onClick={() => setIndice(i)}
              aria-label={`Ver foto ${ETIQUETAS_SLOT[it.slot]}`}
              style={{ ...puntoStyle, backgroundColor: i === indice ? '#fff' : 'rgba(255,255,255,0.4)' }}
            />
          ))}
        </div>
      )}
      <p style={etiquetaStyle}>{ETIQUETAS_SLOT[actual.slot]}</p>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.92)', zIndex: 2000,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px',
};
const cerrarStyle = {
  position: 'absolute', top: '16px', right: '16px', width: '40px', height: '40px', borderRadius: '50%',
  border: 'none', backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '18px', cursor: 'pointer', zIndex: 1,
};
const contenidoStyle = {
  position: 'relative', width: '100%', maxWidth: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const imagenStyle = { width: '100%', maxHeight: '75vh', objectFit: 'contain', userSelect: 'none' };
const flechaStyle = {
  position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: '40px', height: '40px', borderRadius: '50%',
  border: 'none', backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '22px', cursor: 'pointer', lineHeight: '1',
};
const puntosContenedorStyle = { display: 'flex', gap: '8px', marginTop: '16px' };
const puntoStyle = { width: '8px', height: '8px', borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer' };
const etiquetaStyle = { color: '#fff', fontSize: '13px', marginTop: '10px', opacity: 0.8 };
