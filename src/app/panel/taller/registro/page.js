'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { collection, deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import { MENSAJES_TALLER, validarRegistroTaller } from '../../../../lib/taller';
import { VERSION_LEGAL, URL_TERMINOS, URL_PRIVACIDAD } from '../../../../lib/versionesLegales';
import { ErrorRegistro, registrarTaller } from '../../../../lib/registrarTaller';
import { useAuth } from '../../AuthContext';

// Dependencias reales de Firebase para el registro en pasos (ver src/lib/registrarTaller.ts).
const dependenciasFirebase = {
  crearCuenta: async (email, password) => {
    const credencial = await createUserWithEmailAndPassword(auth, email, password);
    return credencial.user.uid;
  },
  generarTallerId: () => doc(collection(db, 'talleres')).id,
  crearUsuario: (uid, tallerId, email) => setDoc(doc(db, 'usuarios', uid), {
    rol: 'taller',
    tallerId,
    email,
    fechaRegistro: serverTimestamp(),
  }),
  borrarTaller: (tallerId) => deleteDoc(doc(db, 'talleres', tallerId)),
  borrarCuenta: () => deleteUser(auth.currentUser),
};

function mensajeDeError(codigo) {
  if (codigo === 'correo-existe') return MENSAJES_TALLER.correoExiste;
  if (codigo === 'a-medias') return MENSAJES_TALLER.cuentaAMedias;
  return MENSAJES_TALLER.errorGeneral;
}

export default function RegistroTaller() {
  const router = useRouter();
  const { recargarRol } = useAuth();
  const [nombre, setNombre] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [error, setError] = useState('');
  const [registrando, setRegistrando] = useState(false);
  const [aceptaLegal, setAceptaLegal] = useState(false);

  async function handleRegistro() {
    setError('');
    const validacion = validarRegistroTaller({ nombre, whatsapp, ciudad, email, password, confirmarPassword });
    if (!validacion.ok) {
      setError(validacion.mensaje);
      return;
    }
    if (!aceptaLegal) {
      setError(MENSAJES_TALLER.aceptacionLegal);
      return;
    }

    setRegistrando(true);
    try {
      const datos = validacion.datos;
      // El taller guarda los datos del formulario; el usuario solo guarda rol, tallerId y correo.
      const deps = {
        ...dependenciasFirebase,
        crearTaller: (tallerId, uid) => setDoc(doc(db, 'talleres', tallerId), {
          nombre: datos.nombre,
          whatsapp: datos.whatsapp,
          ciudad: datos.ciudad,
          logoUrl: '',
          ownerUid: uid,
          activo: true,
          creadoAt: serverTimestamp(),
          // Qué versión de términos y aviso aceptó el taller, y cuándo (la regla lo exige).
          aceptacionLegal: { version: VERSION_LEGAL, fecha: new Date() },
        }),
      };
      await registrarTaller(datos, deps);
      // El contexto leyó el rol cuando la cuenta todavía no tenía documento: lo volvemos a leer
      // ya con usuarios/{uid} creado, y solo entonces entramos al panel del taller.
      const rol = await recargarRol();
      if (rol !== 'taller') throw new ErrorRegistro('a-medias');
      router.push('/panel/taller');
    } catch (err) {
      const codigo = err instanceof ErrorRegistro ? err.codigo : 'general';
      setError(mensajeDeError(codigo));
    } finally {
      setRegistrando(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ maxWidth: '420px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img src="/mecanix-logo.webp" alt="Mecanix" style={{ width: '220px', maxWidth: '100%', margin: '0 auto', display: 'block' }} />
          <p style={{ fontSize: '14px', color: '#E8720C', letterSpacing: '2px', marginTop: '8px', fontWeight: 'bold' }}>
            REGISTRO DE TALLER
          </p>
        </div>

        <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <label style={labelStyle}>Nombre del taller</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} style={inputStyle} />

          <label style={labelStyle}>WhatsApp (10 dígitos)</label>
          <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="6641234567" style={inputStyle} />

          <label style={labelStyle}>Ciudad</label>
          <input value={ciudad} onChange={(e) => setCiudad(e.target.value)} style={inputStyle} />

          <label style={labelStyle}>Correo electrónico</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />

          <label style={labelStyle}>Contraseña (mínimo 8 caracteres)</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />

          <label style={labelStyle}>Confirmar contraseña</label>
          <input type="password" value={confirmarPassword} onChange={(e) => setConfirmarPassword(e.target.value)} style={inputStyle} />

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', margin: '12px 0 14px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={aceptaLegal}
              onChange={(e) => setAceptaLegal(e.target.checked)}
              style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: '#E8720C', cursor: 'pointer', flexShrink: 0 }}
            />
            <span style={{ fontSize: '14px', color: '#555', lineHeight: '1.5' }}>
              He leído y acepto los{' '}
              <a href={URL_TERMINOS} target="_blank" rel="noopener noreferrer" style={{ color: '#E8720C', fontWeight: 'bold' }}>Términos y Condiciones</a>
              {' '}y el{' '}
              <a href={URL_PRIVACIDAD} target="_blank" rel="noopener noreferrer" style={{ color: '#E8720C', fontWeight: 'bold' }}>Aviso de Privacidad</a>.
            </span>
          </label>

          {error && (
            <p role="alert" style={{ color: '#D85A30', fontSize: '13px', marginTop: '4px', marginBottom: '12px' }}>
              {error}
            </p>
          )}

          <button onClick={handleRegistro} disabled={registrando} style={buttonStyle}>
            {registrando ? 'Registrando...' : 'Registrar taller'}
          </button>

          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <button onClick={() => router.push('/panel')} style={linkStyle}>Ya tengo cuenta: iniciar sesión</button>
          </div>
        </div>
      </div>
    </main>
  );
}

const labelStyle = { display: 'block', fontSize: '13px', color: '#555', marginBottom: '4px', marginTop: '10px' };
const inputStyle = {
  width: '100%', padding: '12px 14px', fontSize: '15px', borderRadius: '10px',
  border: '1px solid #DDD', marginBottom: '6px', boxSizing: 'border-box',
};
const buttonStyle = {
  width: '100%', padding: '14px', fontSize: '16px', fontWeight: 'bold', color: '#fff',
  backgroundColor: '#E8720C', border: 'none', borderRadius: '10px', cursor: 'pointer', marginTop: '8px',
};
const linkStyle = { background: 'none', border: 'none', color: '#1A3C5E', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' };
