'use client';

import { useState } from 'react';
import textosTalleres from '../../../lib/textosLegalesTalleres.json';
import { aceptarVersion } from './cotizaciones/datos';

// Aviso de cambios en los términos. Se muestra mientras la versión aceptada no es la vigente.
// Con la versión vieja, el taller ve sus cotizaciones en solo lectura y no puede crear ni editar.
export default function AvisoVersion({ tallerId, versionVigente, resumen, onAceptada, tallerActivo = true }) {
  const [aceptando, setAceptando] = useState(false);
  const [error, setError] = useState('');

  if (!versionVigente.version) return null;

  async function aceptar() {
    setError('');
    setAceptando(true);
    try {
      await aceptarVersion(tallerId, versionVigente.version);
      onAceptada();
    } catch (err) {
      console.error(err);
      setError('No pudimos registrar tu aceptación. Intenta de nuevo.');
    } finally {
      setAceptando(false);
    }
  }

  return (
    <div role="alert" style={{ backgroundColor: '#FFF6E8', border: '1px solid #E8720C', borderRadius: '14px', padding: '16px', marginBottom: '14px' }}>
      <p style={{ margin: '0 0 6px', fontWeight: 'bold', color: '#1A3C5E' }}>Cambiaron los Términos y el Aviso de Privacidad</p>
      <p style={{ margin: '0 0 10px', fontSize: '14px', color: '#444', lineHeight: '1.5' }}>{resumen || 'Revisa los cambios en el enlace.'}</p>
      <p style={{ margin: '0 0 12px', fontSize: '14px' }}>
        <a href={textosTalleres.urls.terminosTalleres} target="_blank" rel="noopener noreferrer" style={{ color: '#E8720C', fontWeight: 'bold' }}>Leer el texto completo</a>
      </p>
      <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#666' }}>
        {tallerActivo
          ? 'Mientras no aceptes la versión nueva, tus cotizaciones se ven en solo lectura: no puedes crear ni editar. Puedes quitar los datos de tus clientes.'
          : 'Mientras no aceptes la versión nueva, tus cotizaciones se ven en solo lectura: no puedes crear ni editar.'}
      </p>
      {error && <p style={{ color: '#B3261E', fontSize: '13px', margin: '0 0 10px' }}>{error}</p>}
      <button onClick={aceptar} disabled={aceptando} style={{ width: '100%', minHeight: '52px', borderRadius: '12px', border: 'none', backgroundColor: '#1A3C5E', color: '#fff', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', opacity: aceptando ? 0.6 : 1 }}>
        {aceptando ? 'Registrando...' : 'Acepto la versión nueva'}
      </button>
    </div>
  );
}
