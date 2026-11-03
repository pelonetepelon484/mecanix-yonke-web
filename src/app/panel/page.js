'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { enviarRecuperacionPassword } from '../lib/passwordReset';
import { talleresHabilitados } from '../../lib/talleresHabilitados';
import { esIdPedido } from '../../lib/pedidosClientes';
import { RUTA_CODIGO_TEMPORAL } from '../../lib/codigoTemporal';
import { RUTA_LIGERO, TEXTO_RECUPERAR_WHATSAPP, correoDeEntrada, enlaceRecuperarWhatsapp, whatsappDeEntrada } from '../../lib/yonkeLigero';

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
  // config/yonkesLigeros.habilitado: los textos dicen "WhatsApp". Entrar con el número funciona
  // siempre; apagada, la pantalla es la de siempre.
  const [conWhatsapp, setConWhatsapp] = useState(false);

  useEffect(() => {
    let vigente = true;
    (async () => {
      const snap = await getDoc(doc(db, 'config', 'yonkesLigeros'));
      if (vigente) setConWhatsapp(snap.exists() && snap.data().habilitado === true);
    })().catch(() => {});
    return () => { vigente = false; };
  }, []);

  // Redirigir según rol cuando ya hay sesión
  if (!loading && user) {
    if (userRole === 'admin') {
      router.push('/admin');
    } else if (userRole === 'taller') {
      router.push('/panel/taller');
    } else if (userRole === 'refaccionaria') {
      router.push('/panel/refaccionaria');
    } else {
      // Viene de una búsqueda activa (?pedido={id}): directo a contestarla. El ligero, a su panel.
      const pedido = new URLSearchParams(window.location.search).get('pedido');
      const inicio = userRole === 'yonkeLigero' ? RUTA_LIGERO : '/panel/reservaciones';
      if (esIdPedido(pedido)) router.push(`${inicio}?pedido=${pedido}`);
      else router.push(userRole === 'yonkeLigero' ? RUTA_LIGERO : '/panel/inventario');
    }
  }

  async function handleLogin() {
    if (!email || !password) {
      setError(conWhatsapp ? 'Llena correo o WhatsApp y contraseña' : 'Llena correo y contraseña');
      return;
    }
    setEntrando(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, correoDeEntrada(email), password);
      // La redirección la maneja el useEffect de arriba
    } catch (err) {
      setError(whatsappDeEntrada(email) ? 'WhatsApp o contraseña incorrectos' : 'Correo o contraseña incorrectos');
    } finally {
      setEntrando(false);
    }
  }

  const whatsappRecuperar = whatsappDeEntrada(emailRecuperar);

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
            src="/logo-mecanix-solo.webp"
            alt="Mecanix"
            style={{ width: '220px', maxWidth: '100%', margin: '0 auto', display: 'block' }}
          />
          <p style={{ fontSize: '14px', color: '#E8720C', letterSpacing: '2px', marginTop: '8px', fontWeight: 'bold' }}>
            ACCESO A TU PANEL
          </p>
        </div>

        <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <input
            type={conWhatsapp ? 'text' : 'email'}
            placeholder={conWhatsapp ? 'Correo o WhatsApp' : 'Correo electrónico'}
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
          {conWhatsapp && (
            <div style={{ textAlign: 'center', marginTop: '8px' }}>
              <button onClick={() => router.push(RUTA_CODIGO_TEMPORAL)} style={olvideButtonStyle}>
                Tengo una contraseña temporal
              </button>
            </div>
          )}

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

          {talleresHabilitados() && (
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <p style={{ fontSize: '13px', color: '#888', marginBottom: '6px' }}>¿Tienes un taller mecánico?</p>
              <button onClick={() => router.push('/panel/taller/registro')} style={olvideButtonStyle}>
                Regístrate como taller
              </button>
            </div>
          )}
        </div>
      </div>

      {modalRecuperarVisible && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <p style={modalTitleStyle}>Recuperar contraseña</p>
            <p style={modalSubStyle}>
              {whatsappRecuperar
                ? TEXTO_RECUPERAR_WHATSAPP
                : 'Escribe tu correo y te enviaremos un enlace para establecer una contraseña nueva.'}
            </p>

            <input
              type={conWhatsapp || whatsappRecuperar ? 'text' : 'email'}
              placeholder={conWhatsapp ? 'Correo o WhatsApp' : 'Correo electrónico'}
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
              {whatsappRecuperar ? (
                <a
                  href={enlaceRecuperarWhatsapp(whatsappRecuperar)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...modalEnviarStyle, textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}
                >
                  Escribir por WhatsApp
                </a>
              ) : (
                <button
                  onClick={enviarRecuperacion}
                  disabled={enviandoRecuperacion}
                  style={{ ...modalEnviarStyle, opacity: enviandoRecuperacion ? 0.6 : 1, cursor: enviandoRecuperacion ? 'wait' : 'pointer' }}
                >
                  {enviandoRecuperacion ? 'Enviando...' : 'Enviar'}
                </button>
              )}
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