'use client';

// Cambiar contraseña del yonke ligero. Pide la actual: así nadie la cambia en un celular prestado o
// con la sesión abierta.
import { useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { PASSWORD_MAX, PASSWORD_MIN } from '../../../lib/yonkeLigero';

const ERRORES_CLAVE = ['auth/wrong-password', 'auth/invalid-credential', 'auth/invalid-login-credentials'];

export default function CambiarPassword() {
  const [abierto, setAbierto] = useState(false);
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);

  async function guardar() {
    setError('');
    if (nueva.length < PASSWORD_MIN || nueva.length > PASSWORD_MAX) {
      setError(`La contraseña nueva debe tener al menos ${PASSWORD_MIN} caracteres.`);
      return;
    }
    setGuardando(true);
    try {
      const usuario = auth.currentUser;
      await reauthenticateWithCredential(usuario, EmailAuthProvider.credential(usuario.email, actual));
      await updatePassword(usuario, nueva);
      setActual('');
      setNueva('');
      setAbierto(false);
      setListo(true);
    } catch (err) {
      setError(ERRORES_CLAVE.includes(err?.code) ? 'Tu contraseña actual no es correcta.'
        : err?.code === 'auth/too-many-requests' ? 'Demasiados intentos. Espera unos minutos.'
          : 'No se pudo cambiar la contraseña. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  if (!abierto) {
    return (
      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        {listo && <p role="status" style={{ margin: '0 0 6px', fontSize: '13px', color: '#2E7D32', fontWeight: 'bold' }}>Tu contraseña se cambió.</p>}
        <button type="button" onClick={() => { setListo(false); setAbierto(true); }} style={{ background: 'none', border: 'none', color: '#555', fontSize: '13px', textDecoration: 'underline', cursor: 'pointer' }}>
          Cambiar contraseña
        </button>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px', marginTop: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <label htmlFor="password-actual" style={etiqueta}>Contraseña actual</label>
      <input id="password-actual" type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} style={campo} />
      <label htmlFor="password-nueva" style={etiqueta}>Contraseña nueva (mínimo {PASSWORD_MIN} caracteres)</label>
      <input id="password-nueva" type="password" autoComplete="new-password" maxLength={PASSWORD_MAX} value={nueva} onChange={(e) => setNueva(e.target.value)} style={campo} />
      {error && <p role="alert" style={{ margin: '0 0 10px', fontSize: '13px', color: '#D85A30' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="button" onClick={guardar} disabled={guardando} style={{ ...boton, backgroundColor: '#1A3C5E', opacity: guardando ? 0.6 : 1 }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
        <button type="button" onClick={() => { setAbierto(false); setError(''); setActual(''); setNueva(''); }} style={{ ...boton, backgroundColor: '#888' }}>Cancelar</button>
      </div>
    </div>
  );
}

const etiqueta = { display: 'block', fontSize: '13px', color: '#666', marginBottom: '6px' };
const campo = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px', backgroundColor: '#F4F5F5', color: '#333', boxSizing: 'border-box', marginBottom: '12px' };
const boton = { flex: 1, minHeight: '44px', borderRadius: '10px', border: 'none', color: '#fff', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' };
