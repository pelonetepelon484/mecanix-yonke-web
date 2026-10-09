'use client';

import { useState, useEffect, useRef } from 'react';

const UMBRAL_SWIPE_PX = 40;

// Visor de pantalla completa, deslizable, para una lista de fotos [{ url, etiqueta? }]. Lo usan las
// fotos de un vehículo (VisorFotosVehiculo, las 4 de lado) y las de un motor/transmisión o pieza
// suelta (hasta 3). Solo se monta al tocar la miniatura -- las demás fotos no se piden al
// navegador hasta ese momento. Cierra con el botón, tocando fuera de la imagen, o Escape.
export default function VisorFotos({ items, titulo, indiceInicial = 0, onClose }) {
  const fotos = (items || []).filter((it) => it?.url);
  const [indice, setIndice] = useState(Math.min(Math.max(0, indiceInicial), Math.max(0, fotos.length - 1)));
  const tocandoDesde = useRef(null);

  useEffect(() => {
    function alTeclado(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndice((i) => Math.min(i + 1, fotos.length - 1));
      if (e.key === 'ArrowLeft') setIndice((i) => Math.max(i - 1, 0));
    }
    document.addEventListener('keydown', alTeclado);
    return () => document.removeEventListener('keydown', alTeclado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (fotos.length === 0) return null;
  const actual = fotos[indice];
  const etiqueta = actual.etiqueta || (fotos.length > 1 ? `Foto ${indice + 1} de ${fotos.length}` : '');

  function siguiente() { setIndice((i) => Math.min(i + 1, fotos.length - 1)); }
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
    <div role="dialog" aria-modal="true" aria-label={`Fotos de ${titulo}`} onClick={onClose} style={overlayStyle}>
      <button type="button" onClick={onClose} aria-label="Cerrar" style={cerrarStyle}>✕</button>

      <div onClick={(e) => e.stopPropagation()} onTouchStart={alTocarInicio} onTouchEnd={alTocarFin} style={contenidoStyle}>
        {fotos.length > 1 && indice > 0 && (
          <button type="button" onClick={anterior} aria-label="Foto anterior" style={{ ...flechaStyle, left: '8px' }}>‹</button>
        )}
        <img src={actual.url} alt={etiqueta ? `${titulo} — ${etiqueta}` : titulo} style={imagenStyle} />
        {fotos.length > 1 && indice < fotos.length - 1 && (
          <button type="button" onClick={siguiente} aria-label="Foto siguiente" style={{ ...flechaStyle, right: '8px' }}>›</button>
        )}
      </div>

      {fotos.length > 1 && (
        <div style={puntosContenedorStyle} onClick={(e) => e.stopPropagation()}>
          {fotos.map((it, i) => (
            <button
              key={it.url}
              type="button"
              onClick={() => setIndice(i)}
              aria-label={`Ver foto ${it.etiqueta || i + 1}`}
              style={{ ...puntoStyle, backgroundColor: i === indice ? '#fff' : 'rgba(255,255,255,0.4)' }}
            />
          ))}
        </div>
      )}
      {etiqueta && <p style={etiquetaStyle}>{etiqueta}</p>}
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
