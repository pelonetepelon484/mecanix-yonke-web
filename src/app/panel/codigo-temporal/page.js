'use client';

// El yonke que entra con WhatsApp escribe el código que le mandó Mecanix y crea su contraseña nueva.
// El código no abre sesión: solo sirve para esto, una vez. Después entra con su contraseña nueva.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { MENSAJES_CODIGO } from '../../../lib/codigoTemporal';
import { PASSWORD_MAX, PASSWORD_MIN, correoInterno, whatsappDiezDigitos } from '../../../lib/yonkeLigero';

export default function CodigoTemporalPage() {
  const router = useRouter();
  const [whatsapp, setWhatsapp] = useState('');
  const [codigo, setCodigo] = useState('');
  const [password, setPassword] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [cambiada, setCambiada] = useState(false);

  async function guardar() {
    setGuardando(true);
    setError('');
    try {
      const res = await fetch('/api/yonkes/usar-codigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp, codigo, password }),
      });
      const datos = await res.json().catch(() => null);
      if (!res.ok || !datos?.ok) {
        setError(datos?.mensaje || MENSAJES_CODIGO.noDisponible);
        setGuardando(false);
        return;
      }
      setCambiada(true);
    } catch (err) {
      console.error(err);
      setError(MENSAJES_CODIGO.noDisponible);
      setGuardando(false);
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, correoInterno(whatsappDiezDigitos(whatsapp)), password);
      router.push('/panel');
    } catch (err) {
      console.error(err); // la contraseña ya cambió: se queda el botón para entrar a mano
    } finally {
      setGuardando(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#1A3C5E', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: '400px', backgroundColor: '#fff', borderRadius: '16px', padding: '24px', boxSizing: 'border-box' }}>
        <h1 style={{ margin: '0 0 8px', fontSize: '20px', color: '#1A3C5E' }}>Tengo una contraseña temporal</h1>
        {cambiada ? (
          <>
            <p role="status" style={{ fontSize: '14px', color: '#2E7D32', fontWeight: 'bold' }}>Tu contraseña se cambió.</p>
            <button type="button" onClick={() => router.push('/panel')} style={boton}>Ir a iniciar sesión</button>
          </>
        ) : (
          <>
            <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#555' }}>Escribe la contraseña temporal que te mandamos por WhatsApp y crea tu contraseña nueva.</p>
            <label htmlFor="codigo-whatsapp" style={etiqueta}>Tu WhatsApp (10 dígitos)</label>
            <input id="codigo-whatsapp" type="tel" autoComplete="tel-national" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} style={campo} />
            <label htmlFor="codigo-temporal" style={etiqueta}>Contraseña temporal</label>
            <input id="codigo-temporal" type="text" autoComplete="one-time-code" autoCapitalize="none" autoCorrect="off" value={codigo} onChange={(e) => setCodigo(e.target.value)} style={campo} />
            <label htmlFor="codigo-password" style={etiqueta}>Contraseña nueva (mínimo {PASSWORD_MIN} caracteres)</label>
            <input id="codigo-password" type="password" autoComplete="new-password" maxLength={PASSWORD_MAX} value={password} onChange={(e) => setPassword(e.target.value)} style={campo} />
            {error && <p role="alert" style={{ margin: '0 0 12px', fontSize: '13px', color: '#D85A30' }}>{error}</p>}
            <button type="button" disabled={guardando} onClick={guardar} style={{ ...boton, opacity: guardando ? 0.6 : 1 }}>{guardando ? 'Guardando...' : 'Crear mi contraseña'}</button>
            <div style={{ textAlign: 'center', marginTop: '14px' }}>
              <button type="button" onClick={() => router.push('/panel')} style={{ background: 'none', border: 'none', color: '#555', fontSize: '13px', textDecoration: 'underline', cursor: 'pointer' }}>Volver a iniciar sesión</button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

const etiqueta = { display: 'block', fontSize: '13px', color: '#666', marginBottom: '6px' };
const campo = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px', backgroundColor: '#F4F5F5', color: '#333', boxSizing: 'border-box', marginBottom: '12px' };
const boton = { width: '100%', minHeight: '46px', borderRadius: '10px', border: 'none', backgroundColor: '#1A3C5E', color: '#fff', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' };
