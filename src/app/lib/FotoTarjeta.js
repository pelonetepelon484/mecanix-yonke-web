'use client';

import { useState } from 'react';

// Miniatura de tarjeta de resultado: proporción fija (reserva el espacio, la página no salta al
// cargar), lazy loading, y el mismo placeholder discreto tanto si no hay foto como si la imagen
// falla al cargar (onError) -- una tarjeta sin foto se ve igual de bien que una con foto, nunca
// rota. `onClick` es opcional: cuando se da, la miniatura se usa para abrir el visor (solo
// vehículos); motores/piezas sueltas solo se muestran, sin acción.
export default function FotoTarjeta({ url, alt, onClick, icono = '🚗', ancho = '72px' }) {
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
    </div>
  );
}
