'use client';

import { useState } from 'react';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { URL_TERMINOS } from '../../lib/versionesLegales';
import { PALABRA_ACEPTAR, esAceptacionEscrita } from './taller/AvisoVersion';
import { aceptarTerminosYonke, TEXTO_BLOQUEO_TERMINOS_YONKE } from './terminosYonke';

// Aviso de reaceptación de los Términos generales, arriba de todo el panel del yonke. Se muestra
// solo al dueño (rol 'yonke') cuando existe config/terminosYonkes y su versión aceptada no es la
// vigente. El texto de los cambios sale de config/terminosYonkes.resumenCambios (no del código).
// Aceptación ESCRITA, igual que en talleres: la palabra ACEPTO, en mayúsculas o minúsculas y con
// o sin espacios al inicio o al final; cualquier otra cosa deja el botón desactivado.
export default function AvisoTerminosYonke() {
  const { userRole, yonkeId, terminosYonke, puedeEditarYonke, marcarTerminosAceptados } = useAuth();
  const [escrito, setEscrito] = useState('');
  const [aceptando, setAceptando] = useState(false);
  const [error, setError] = useState('');

  if (userRole !== 'yonke' || !yonkeId || puedeEditarYonke || !terminosYonke?.version) return null;
  const puedeAceptar = esAceptacionEscrita(escrito) && !aceptando;

  async function aceptar() {
    if (!esAceptacionEscrita(escrito)) return;
    setError('');
    setAceptando(true);
    try {
      await aceptarTerminosYonke(db, yonkeId, terminosYonke.version);
      marcarTerminosAceptados();
    } catch (err) {
      console.error(err);
      setError('No pudimos registrar tu aceptación. Intenta de nuevo.');
    } finally {
      setAceptando(false);
    }
  }

  return (
    <div style={{ backgroundColor: '#F4F5F5', padding: '16px 16px 0' }}>
      <div role="alert" style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: '#FFF6E8', border: '1px solid #E8720C', borderRadius: '14px', padding: '16px' }}>
        <p style={{ margin: '0 0 6px', fontWeight: 'bold', color: '#1A3C5E' }}>Cambiaron los Términos y Condiciones</p>
        <p style={{ margin: '0 0 10px', fontSize: '14px', color: '#444', lineHeight: '1.5', whiteSpace: 'pre-line' }}>
          {terminosYonke.resumenCambios || 'Revisa los cambios en el enlace.'}
        </p>
        <p style={{ margin: '0 0 12px', fontSize: '14px' }}>
          <a href={URL_TERMINOS} target="_blank" rel="noopener noreferrer" style={{ color: '#E8720C', fontWeight: 'bold' }}>Leer el texto completo</a>
        </p>
        <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#666' }}>{TEXTO_BLOQUEO_TERMINOS_YONKE}</p>
        <label htmlFor="aceptar-terminos-yonke" style={{ display: 'block', fontSize: '14px', color: '#1A3C5E', fontWeight: 'bold', margin: '0 0 6px' }}>
          Para aceptar, escribe la palabra {PALABRA_ACEPTAR}
        </label>
        <input
          id="aceptar-terminos-yonke" value={escrito} onChange={(e) => setEscrito(e.target.value)} autoComplete="off" autoCapitalize="characters"
          style={{ width: '100%', boxSizing: 'border-box', padding: '12px', fontSize: '16px', borderRadius: '10px', border: '1px solid #CCC', marginBottom: '10px' }}
        />
        {error && <p style={{ color: '#B3261E', fontSize: '13px', margin: '0 0 10px' }}>{error}</p>}
        <button onClick={aceptar} disabled={!puedeAceptar} style={{ width: '100%', minHeight: '52px', borderRadius: '12px', border: 'none', backgroundColor: '#1A3C5E', color: '#fff', fontSize: '16px', fontWeight: 'bold', cursor: puedeAceptar ? 'pointer' : 'default', opacity: puedeAceptar ? 1 : 0.5 }}>
          {aceptando ? 'Registrando...' : 'Acepto los términos vigentes'}
        </button>
      </div>
    </div>
  );
}
