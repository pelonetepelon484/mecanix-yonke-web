'use client';

import { useAuth } from './AuthContext';
import { TEXTO_BLOQUEO_TERMINOS_YONKE } from './terminosYonke';

// Mensaje corto junto a lo que está bloqueado.
export function MensajeBloqueoTerminos({ style }) {
  return (
    <p role="note" style={{ backgroundColor: '#FFF6E8', border: '1px solid #F0C9A0', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', color: '#7A4A12', margin: '0 0 14px', ...style }}>
      {TEXTO_BLOQUEO_TERMINOS_YONKE}
    </p>
  );
}

// Envuelve controles que escriben: sin términos vigentes, se ven pero desactivados (un <fieldset
// disabled> desactiva todos los botones y campos de adentro), con el mensaje arriba.
export function BloqueoTerminos({ children }) {
  const { puedeEditarYonke } = useAuth();
  if (puedeEditarYonke !== false) return children;
  return (
    <>
      <MensajeBloqueoTerminos />
      <fieldset disabled style={{ border: 0, margin: 0, padding: 0, minWidth: 0, opacity: 0.6 }}>
        {children}
      </fieldset>
    </>
  );
}
