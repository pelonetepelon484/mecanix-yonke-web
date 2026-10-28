'use client';

import { useState } from 'react';
import { PALABRA_ACEPTAR, esAceptacionEscrita } from '../taller/AvisoVersion';
import { TEXTOS_PROVISIONALES, URL_TERMINOS_REFACCIONARIAS } from '../../../lib/refaccionarias';
import { aceptarVersionRefaccionaria } from './datos';

// Aviso de aceptación de los términos de refaccionarias (versión propia, config/refaccionarias):
// aceptación ESCRITA con la palabra ACEPTO, igual que talleres y yonkes. El resumen de cambios sale
// de config/refaccionarias.resumenCambios; sin él, un texto de respaldo (provisional).
export default function AvisoVersionRefaccionaria({ refaccionariaId, version, resumen, onAceptada }) {
  const [aceptando, setAceptando] = useState(false);
  const [error, setError] = useState('');
  const [escrito, setEscrito] = useState('');
  const puedeAceptar = esAceptacionEscrita(escrito) && !aceptando;

  if (!version) return null;

  async function aceptar() {
    if (!esAceptacionEscrita(escrito)) return;
    setError('');
    setAceptando(true);
    try {
      await aceptarVersionRefaccionaria(refaccionariaId, version);
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
      <p style={{ margin: '0 0 6px', fontWeight: 'bold', color: '#1A3C5E' }}>{TEXTOS_PROVISIONALES.tituloAvisoVersion}</p>
      <p style={{ margin: '0 0 10px', fontSize: '14px', color: '#444', lineHeight: '1.5' }}>{resumen || TEXTOS_PROVISIONALES.resumenCambiosRespaldo}</p>
      <p style={{ margin: '0 0 12px', fontSize: '14px' }}>
        <a href={URL_TERMINOS_REFACCIONARIAS} target="_blank" rel="noopener noreferrer" style={{ color: '#E8720C', fontWeight: 'bold' }}>Leer el texto completo</a>
      </p>
      <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#666' }}>{TEXTOS_PROVISIONALES.soloLectura}</p>
      <label htmlFor="aceptar-terminos-refaccionaria" style={{ display: 'block', fontSize: '14px', color: '#1A3C5E', fontWeight: 'bold', margin: '0 0 6px' }}>
        Para aceptar, escribe la palabra {PALABRA_ACEPTAR}
      </label>
      <input
        id="aceptar-terminos-refaccionaria" value={escrito} onChange={(e) => setEscrito(e.target.value)} autoComplete="off" autoCapitalize="characters"
        style={{ width: '100%', boxSizing: 'border-box', padding: '12px', fontSize: '16px', borderRadius: '10px', border: '1px solid #CCC', marginBottom: '10px' }}
      />
      {error && <p style={{ color: '#B3261E', fontSize: '13px', margin: '0 0 10px' }}>{error}</p>}
      <button onClick={aceptar} disabled={!puedeAceptar} style={{ width: '100%', minHeight: '52px', borderRadius: '12px', border: 'none', backgroundColor: '#1A3C5E', color: '#fff', fontSize: '16px', fontWeight: 'bold', cursor: puedeAceptar ? 'pointer' : 'default', opacity: puedeAceptar ? 1 : 0.5 }}>
        {aceptando ? 'Registrando...' : 'Acepto la versión nueva'}
      </button>
    </div>
  );
}
