'use client';

import { useState } from 'react';

// Miniatura de tarjeta de resultado: proporción fija (reserva el espacio, la página no salta al
// cargar), lazy loading, y el mismo placeholder discreto tanto si no hay foto como si la imagen
// falla al cargar (onError) -- una tarjeta sin foto se ve igual de bien que una con foto, nunca
// rota. `onClick` es opcional: cuando se da, la miniatura abre el visor de fotos. `total`
// (opcional): cuántas fotos hay; con 2 o más se muestra un indicador "📷 3" sobre la miniatura.
export default function FotoTarjeta({ url, alt, onClick, icono = '🚗', ancho = '72px', total = 0 }) {
  const [fallo, setFallo] = useState(false);
  const mostrarPlaceholder = !url || fallo;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      style={{
        position: 'relative', width: ancho, aspectRatio: '4 / 3', borderRadius: '8px', overflow: 'hidden',
        backgroundColor: '#F0F2F5', display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default', flexShrink: 0,
      }}
    >
      {mostrarPlaceholder ? (
        <span style={{ fontSize: '22px', color: '#ccc' }}>{icono}</span>
      ) : (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          onError={() => setFallo(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
      {!mostrarPlaceholder && total > 1 && (
        <span aria-label={`${total} fotos`} style={{
          position: 'absolute', right: '3px', bottom: '3px', padding: '1px 5px', borderRadius: '8px',
          backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '10px', fontWeight: 'bold', lineHeight: '1.4',
        }}>
          📷 {total}
        </span>
      )}
    </div>
  );
}
