'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { enviarRecuperacionPassword } from '../lib/passwordReset';

// Mismos textos que la app (LoginScreen.js en mecanix-yonke-virtual2) para que la
// experiencia de recuperación de contraseña sea idéntica en web y app.
function mostrarResultadoRecuperacion(resultado) {
  if (resultado.ok) {
    alert('Revisa tu correo\n\nSi ese correo está registrado, te llegará un enlace para restablecer tu contraseña. Revisa tu bandeja (y la carpeta de spam).');
  } else if (resultado.tipo === 'sin-conexion') {
    alert('Sin conexión\n\nNecesitas conexión a internet para enviar el correo de recuperación.');
  } else if (resultado.tipo === 'invalido' || resultado.tipo === 'vacio') {
    alert('Correo inválido\n\nEscribe un correo electrónico válido.');
  } else {
    alert('Error\n\nNo se pudo enviar el correo de recuperación. Intenta de nuevo.');
  }
}

export default function PanelLogin() {
  const router = useRouter();
  const { user, userRole, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [entrando, setEntrando] = useState(false);

  const [modalRecuperarVisible, setModalRecuperarVisible] = useState(false);
  const [emailRecuperar, setEmailRecuperar] = useState('');
  const [enviandoRecuperacion, setEnviandoRecuperacion] = useState(false);

  // Redirigir según rol cuando ya hay sesión
  if (!loading && user) {
    if (userRole === 'admin') {
      router.push('/admin');
    } else {
      router.push('/panel/inventario');
    }
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
      // La redirección la maneja el useEffect de arriba
    } catch (err) {
      setError('Correo o contraseña incorrectos');
    } finally {
      setEntrando(false);
    }
  }

  function abrirRecuperar() {
    setEmailRecuperar(email);
    setModalRecuperarVisible(true);
  }

  async function enviarRecuperacion() {
    setEnviandoRecuperacion(true);
    const resultado = await enviarRecuperacionPassword(emailRecuperar);
    setEnviandoRecuperacion(false);

    if (resultado.ok) setModalRecuperarVisible(false);
    mostrarResultadoRecuperacion(resultado);
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ maxWidth: '380px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img
            src="/mecanix-logo.webp"
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

          <div style={{ textAlign: 'center', marginTop: '14px' }}>
            <button onClick={abrirRecuperar} style={olvideButtonStyle}>
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <p style={{ fontSize: '13px', color: '#888', marginBottom: '10px' }}>
              ¿Tienes un yonke y quieres aparecer en la plataforma?
            </p>
            <button
              onClick={() => router.push('/panel/registro')}
              style={registerButtonStyle}
            >
              🆓 Regístrate gratis
            </button>
          </div>
        </div>
      </div>

      {modalRecuperarVisible && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <p style={modalTitleStyle}>Recuperar contraseña</p>
            <p style={modalSubStyle}>
              Escribe tu correo y te enviaremos un enlace para establecer una contraseña nueva.
            </p>

            <input
              type="email"
              placeholder="Correo electrónico"
              value={emailRecuperar}
              onChange={(e) => setEmailRecuperar(e.target.value)}
              style={inputStyle}
            />

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                onClick={() => setModalRecuperarVisible(false)}
                style={modalCancelarStyle}
              >
                Cancelar
              </button>
              <button
                onClick={enviarRecuperacion}
                disabled={enviandoRecuperacion}
                style={{ ...modalEnviarStyle, opacity: enviandoRecuperacion ? 0.6 : 1, cursor: enviandoRecuperacion ? 'wait' : 'pointer' }}
              >
                {enviandoRecuperacion ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const inputStyle = {
  width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd',
  marginBottom: '12px', fontSize: '15px', backgroundColor: '#F4F5F5',
  color: '#333', boxSizing: 'border-box',
};
const buttonStyle = {
  width: '100%', padding: '14px', borderRadius: '8px', border: 'none',
  backgroundColor: '#E8720C', color: '#fff', fontWeight: 'bold',
  fontSize: '15px', cursor: 'pointer', marginTop: '4px',
};
const registerButtonStyle = {
  width: '100%', padding: '12px', borderRadius: '8px',
  border: '2px solid #1A3C5E', backgroundColor: '#fff',
  color: '#1A3C5E', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer',
};
const olvideButtonStyle = {
  background: 'none', border: 'none', color: '#1A3C5E',
  fontSize: '14px', fontWeight: 'bold', cursor: 'pointer',
};
const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
  justifyContent: 'center', padding: '24px', zIndex: 200,
};
const modalStyle = {
  backgroundColor: '#fff', borderRadius: '16px', padding: '24px',
  maxWidth: '380px', width: '100%', boxSizing: 'border-box',
};
const modalTitleStyle = {
  fontSize: '18px', fontWeight: 'bold', color: '#1A3C5E', margin: '0 0 8px',
};
const modalSubStyle = {
  fontSize: '13px', color: '#666', margin: '0 0 16px', lineHeight: '18px',
};
const modalCancelarStyle = {
  flex: 1, padding: '14px', borderRadius: '8px', border: 'none',
  backgroundColor: '#F4F5F5', color: '#888', fontWeight: 'bold',
  fontSize: '14px', cursor: 'pointer',
};
const modalEnviarStyle = {
  flex: 1, padding: '14px', borderRadius: '8px', border: 'none',
  backgroundColor: '#E8720C', color: '#fff', fontWeight: 'bold',
  fontSize: '14px', cursor: 'pointer',
};