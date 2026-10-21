'use client';

import { PRECIO_PREMIUM_TEXTO, TITULO_FUNCION_PREMIUM, URL_QUIERO_PREMIUM } from '../../lib/planes';
// url (opcional): el enlace de WhatsApp; los talleres usan URL_QUIERO_PREMIUM_TALLER. Sin él, el de yonkes.

// Candado de las funciones Premium cuando config/planes.limitesActivos está encendido y el yonke
// no tiene Premium vigente. Solo se muestra en ese caso: con el interruptor apagado, cada pantalla
// sigue con su comportamiento (y sus textos) de antes. Lo ya capturado no se borra, solo se oculta.

function registrarEvento(nombre, params = {}) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', nombre, params);
  }
}

// Botón "Quiero Premium" con el precio (abre WhatsApp, mismo enlace de siempre).
export function BotonQuieroPremium({ ubicacion, compacto = false, url = URL_QUIERO_PREMIUM }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={compacto ? botonCompactoStyle : botonStyle}
      onClick={() => registrarEvento('clic_premium', { ubicacion, plan_actual: 'basico' })}
    >
      Quiero Premium · {PRECIO_PREMIUM_TEXTO}
    </a>
  );
}

// Pantalla completa (venta manual, reciclaje, Demanda).
export default function CandadoPremium({ descripcion, ubicacion }) {
  return (
    <div role="note" style={contenedorStyle}>
      <p style={{ fontSize: '56px', margin: '0 0 12px' }}>🔒</p>
      <h2 style={tituloStyle}>{TITULO_FUNCION_PREMIUM}</h2>
      {descripcion && <p style={mensajeStyle}>{descripcion}</p>}
      <p style={precioStyle}>{PRECIO_PREMIUM_TEXTO}</p>
      <BotonQuieroPremium ubicacion={ubicacion} />
    </div>
  );
}

// Versión corta dentro de una sección (Mi negocio, Mis ventas).
export function AvisoPremium({ descripcion, ubicacion, url }) {
  return (
    <div role="note" style={avisoStyle}>
      <p style={{ margin: 0, fontSize: '13px', color: '#1A3C5E', fontWeight: '600' }}>
        🔒 {TITULO_FUNCION_PREMIUM}{descripcion ? `. ${descripcion}` : ''}
      </p>
      <BotonQuieroPremium ubicacion={ubicacion} compacto url={url} />
    </div>
  );
}

const contenedorStyle = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  padding: '40px 24px', textAlign: 'center', maxWidth: '420px', margin: '0 auto',
};
const tituloStyle = { fontSize: '22px', fontWeight: 'bold', color: '#1A3C5E', margin: '0 0 12px' };
const mensajeStyle = { fontSize: '15px', color: '#555', lineHeight: '1.6', margin: '0 0 12px' };
const precioStyle = { fontSize: '14px', color: '#854F0B', fontWeight: 'bold', margin: '0 0 20px' };
const botonStyle = {
  backgroundColor: '#E8720C', color: '#fff', fontWeight: 'bold', fontSize: '14px',
  padding: '12px 24px', borderRadius: '24px', textDecoration: 'none', display: 'inline-block',
};
const botonCompactoStyle = {
  backgroundColor: '#E8720C', color: '#fff', fontWeight: 'bold', fontSize: '13px',
  padding: '8px 16px', borderRadius: '20px', textDecoration: 'none',
};
const avisoStyle = {
  backgroundColor: '#EEF2F7', border: '1.5px dashed #1A3C5E', borderRadius: '12px',
  padding: '14px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center',
  justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap',
};
