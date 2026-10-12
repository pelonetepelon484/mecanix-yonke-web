'use client';

import { useState } from 'react';
import textosTalleres from '../../../lib/textosLegalesTalleres.json';
import { aceptarVersion } from './cotizaciones/datos';

// Aviso de cambios en los términos. Se muestra mientras la versión aceptada no es la vigente.
// Con la versión vieja, el taller SOLO puede ver, reimprimir y descargar: no crea, no edita, no
// quita datos del cliente, no elimina ni convierte (las reglas de Firestore exigen lo mismo).
// Aceptación ESCRITA (decisión del abogado): el taller debe escribir la palabra ACEPTO; se aceptan
// mayúsculas o minúsculas y espacios al inicio o al final. Cualquier otra cosa deja el botón desactivado.
// Es el mismo componente en el inicio del taller, en cotizaciones y en órdenes.
export const PALABRA_ACEPTAR = 'ACEPTO';
export const TEXTO_SOLO_LECTURA = 'Mientras no aceptes, solo puedes visualizar, reimprimir y descargar tus documentos anteriores.';
export const esAceptacionEscrita = (texto) => String(texto ?? '').trim().toUpperCase() === PALABRA_ACEPTAR;

// (tallerActivo se sigue recibiendo, pero ya no cambia el texto: activo o no, solo lectura.)
export default function AvisoVersion({ tallerId, versionVigente, resumen, onAceptada }) {
  const [aceptando, setAceptando] = useState(false);
  const [error, setError] = useState('');
  const [escrito, setEscrito] = useState('');
  const puedeAceptar = esAceptacionEscrita(escrito) && !aceptando;

  if (!versionVigente.version) return null;

  async function aceptar() {
    if (!esAceptacionEscrita(escrito)) return;
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
      <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#666' }}>{TEXTO_SOLO_LECTURA}</p>
      <label htmlFor="aceptar-terminos" style={{ display: 'block', fontSize: '14px', color: '#1A3C5E', fontWeight: 'bold', margin: '0 0 6px' }}>
        Para aceptar, escribe la palabra {PALABRA_ACEPTAR}
      </label>
      <input
        id="aceptar-terminos" value={escrito} onChange={(e) => setEscrito(e.target.value)} autoComplete="off" autoCapitalize="characters"
        style={{ width: '100%', boxSizing: 'border-box', padding: '12px', fontSize: '16px', borderRadius: '10px', border: '1px solid #CCC', marginBottom: '10px' }}
      />
      {error && <p style={{ color: '#B3261E', fontSize: '13px', margin: '0 0 10px' }}>{error}</p>}
      <button onClick={aceptar} disabled={!puedeAceptar} style={{ width: '100%', minHeight: '52px', borderRadius: '12px', border: 'none', backgroundColor: '#1A3C5E', color: '#fff', fontSize: '16px', fontWeight: 'bold', cursor: puedeAceptar ? 'pointer' : 'default', opacity: puedeAceptar ? 1 : 0.5 }}>
        {aceptando ? 'Registrando...' : 'Acepto la versión nueva'}
      </button>
    </div>
  );
}
