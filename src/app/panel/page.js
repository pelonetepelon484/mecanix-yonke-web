'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from './AuthContext';

export default function PanelLogin() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [entrando, setEntrando] = useState(false);

  if (!loading && user) {
    router.push('/panel/inventario');
  }

  async function handleLogin() {
    if (!email || !password) {
      setError('Llena correo y contraseña');
      return;
    }
    setEntrando(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.push('/panel/inventario');
    } catch (err) {
      setError('Correo o contraseña incorrectos');
    } finally {
      setEntrando(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ maxWidth: '380px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img
            src="/mecanix-logo.png"
            alt="Mecanix"
            style={{ width: '220px', maxWidth: '100%', margin: '0 auto', display: 'block' }}
          />
          <p style={{ fontSize: '14px', color: '#E8720C', letterSpacing: '2px', marginTop: '8px', fontWeight: 'bold' }}>
            PANEL DEL YONKE
          </p>
        </div>

        <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            style={inputStyle}
          />

          {error && (
            <p style={{ color: '#D85A30', fontSize: '13px', marginTop: '-6px', marginBottom: '12px' }}>
              {error}
            </p>
          )}

          <button onClick={handleLogin} disabled={entrando} style={buttonStyle}>
            {entrando ? 'Entrando...' : 'Iniciar sesión'}
          </button>
        </div>
      </div>
    </main>
  );
}

const inputStyle = {
  width: '100%',
  padding: '12px',
  borderRadius: '8px',
  border: '1px solid #ddd',
  marginBottom: '12px',
  fontSize: '15px',
  backgroundColor: '#F4F5F5',
  color: '#333',
  boxSizing: 'border-box',
};

const buttonStyle = {
  width: '100%',
  padding: '14px',
  borderRadius: '8px',
  border: 'none',
  backgroundColor: '#E8720C',
  color: '#fff',
  fontWeight: 'bold',
  fontSize: '15px',
  cursor: 'pointer',
  marginTop: '4px',
};