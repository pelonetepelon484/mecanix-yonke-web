'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { ESTADO_DEFAULT, cargarEstados } from '../../lib/estados';
import { generarSubdominioUnico } from '../../lib/generarSubdominio';
import { subirLogoYonke, validarArchivoLogo } from '../../lib/subirLogoYonke';
import { TEMAS_COLOR, TEMA_DEFAULT_ID } from '../../lib/temasColor';

const CIUDADES_BC = [
  { key: 'tijuana', label: 'Tijuana' },
  { key: 'mexicali', label: 'Mexicali' },
  { key: 'ensenada', label: 'Ensenada' },
  { key: 'tecate', label: 'Tecate' },
  { key: 'rosarito', label: 'Playas de Rosarito' },
  { key: 'sanquintin', label: 'San Quintín' },
];

export default function RegistroYonke() {
  const router = useRouter();

  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [estados, setEstados] = useState([{ id: ESTADO_DEFAULT, nombre: 'Baja California' }]);
  const [estado, setEstado] = useState(ESTADO_DEFAULT);
  const [ciudad, setCiudad] = useState('tijuana');
  const [ciudadLibre, setCiudadLibre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [registrando, setRegistrando] = useState(false);
  const [error, setError] = useState('');
  const [exitoso, setExitoso] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [temaElegido, setTemaElegido] = useState(TEMA_DEFAULT_ID);

  // Baja California mantiene el selector de CIUDADES_BC de siempre; cualquier otro estado no
  // tiene todavía un catálogo de ciudades, así que se captura como texto libre.
  const esBC = estado === ESTADO_DEFAULT;

  useEffect(() => {
    cargarEstados().then(setEstados);
  }, []);

  function manejarSeleccionLogo(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo si se corrige algo
    if (!file) return;
    const errorValidacion = validarArchivoLogo(file);
    if (errorValidacion) { alert(errorValidacion); return; }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function handleRegistro() {
    setError('');

    const ciudadFinal = esBC ? ciudad : ciudadLibre.trim();
    if (!nombre || !direccion || !ciudadFinal || !telefono || !email || !password || !confirmarPassword) {
      setError('Llena todos los campos obligatorios');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== confirmarPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setRegistrando(true);
    try {
      // 1. Crear cuenta en Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid = userCredential.user.uid;

      // 2. Crear documento del yonke en Firestore
      const yonkeRef = await addDoc(collection(db, 'yonkes'), {
        nombre: nombre.trim(),
        direccion: direccion.trim(),
        estado,
        ciudad: ciudadFinal,
        telefono: telefono.trim(),
        whatsapp: whatsapp.trim() || telefono.trim(),
        email: email.trim(),
        metodosPago: [],
        plan: 'freemium',
        activo: true,
        fechaRegistro: new Date(),
      });

      // 3. Crear documento del usuario en Firestore
      await setDoc(doc(db, 'usuarios', uid), {
        rol: 'yonke',
        yonkeId: yonkeRef.id,
        email: email.trim(),
        fechaRegistro: new Date(),
      });

      // 4. Subdominio automático + logo (opcional) + tema de color — nunca deben tumbar el
      // registro si algo falla aquí: la cuenta, el yonke y el acceso ya existen sin importar
      // el resultado de este bloque (mismo estado que un yonke registrado manualmente hoy).
      try {
        const subdominio = await generarSubdominioUnico(nombre.trim(), ciudadFinal, yonkeRef.id);
        const tema = TEMAS_COLOR.find((t) => t.id === temaElegido) || TEMAS_COLOR.find((t) => t.id === TEMA_DEFAULT_ID);

        let logoUrl = null;
        if (logoFile) {
          try {
            logoUrl = await subirLogoYonke(yonkeRef.id, logoFile);
          } catch (logoError) {
            console.error('No se pudo subir el logo durante el registro', logoError);
          }
        }

        await setDoc(doc(db, 'yonkes', yonkeRef.id), {
          subdominio,
          subdominioActivo: true, // nace activo, por el mes de Premium gratis de bienvenida
          branding: {
            colorPrimario: tema.colorPrimario,
            colorAcento: tema.colorAcento,
            ...(logoUrl ? { logoUrl } : {}),
          },
          ...(logoUrl ? { logoUrl } : {}), // mismo logo también en el campo que usan las búsquedas
        }, { merge: true });
      } catch (brandingError) {
        console.error('No se pudo generar el subdominio/branding automático', brandingError);
      }

      // Notificación por WhatsApp — vía endpoint server-side (nunca expone la API key de
      // CallMeBot en el navegador; ver src/app/lib/notificarAdmin.js).
      try {
        await fetch('/api/notificar-registro', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: nombre.trim(),
            ciudad: esBC ? (CIUDADES_BC.find(c => c.key === ciudad)?.label || ciudad) : ciudadFinal,
            telefono: telefono.trim(),
            email: email.trim(),
          }),
        });
      } catch (e) {
        console.log('WhatsApp notification failed', e);
      }

      setExitoso(true);
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este correo ya está registrado. ¿Ya tienes cuenta?');
      } else if (err.code === 'auth/invalid-email') {
        setError('El correo no es válido');
      } else {
        setError('No se pudo completar el registro. Intenta de nuevo.');
      }
    } finally {
      setRegistrando(false);
    }
  }

  if (exitoso) {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: '380px', width: '100%', textAlign: 'center' }}>
          <p style={{ fontSize: '64px', margin: '0 0 16px' }}>🎉</p>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#1A3C5E', marginBottom: '12px' }}>
            ¡Registro exitoso!
          </h2>
          <p style={{ fontSize: '15px', color: '#555', lineHeight: '1.6', marginBottom: '8px' }}>
            Tu yonke ya está registrado en la plataforma con el Plan Básico.
          </p>
          <p style={{ fontSize: '14px', color: '#888', lineHeight: '1.6', marginBottom: '24px' }}>
            Ahora puedes iniciar sesión y empezar a agregar tu inventario para aparecer en las búsquedas.
          </p>
          <button
            onClick={() => router.push('/panel/inventario')}
            style={buttonStyle}
          >
            Ir a mi panel
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '24px 16px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img
            src="/mecanix-logo.webp"
            alt="Mecanix"
            style={{ width: '200px', maxWidth: '100%', margin: '0 auto', display: 'block' }}
          />
          <p style={{ fontSize: '14px', color: '#E8720C', letterSpacing: '2px', marginTop: '8px', fontWeight: 'bold' }}>
            REGISTRA TU YONKE
          </p>
        </div>

        {/* Banner freemium */}
        <div style={freemiumBannerStyle}>
          <p style={{ margin: 0, fontSize: '14px', color: '#1A3C5E', fontWeight: 'bold' }}>
            🆓 Plan Básico — Completamente gratis
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#555' }}>
            Sube tu inventario y aparece en búsquedas sin costo. Actualiza a Premium cuando quieras más funciones.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Información del negocio</h2>

          <p style={labelStyle}>Nombre del yonke *</p>
          <input
            type="text"
            placeholder="Ej. Yonke El Tigre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            style={inputStyle}
          />

          <p style={labelStyle}>Estado *</p>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            style={selectStyle}
          >
            {estados.map(e => (
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
          </select>

          <p style={labelStyle}>Ciudad *</p>
          {esBC ? (
            <select
              value={ciudad}
              onChange={(e) => setCiudad(e.target.value)}
              style={selectStyle}
            >
              {CIUDADES_BC.map(c => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              placeholder="Ej. Guadalajara"
              value={ciudadLibre}
              onChange={(e) => setCiudadLibre(e.target.value)}
              style={inputStyle}
            />
          )}

          <p style={labelStyle}>Dirección *</p>
          <input
            type="text"
            placeholder="Calle, colonia, referencias"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            style={inputStyle}
          />

          <p style={labelStyle}>Teléfono *</p>
          <input
            type="tel"
            placeholder="664 000 0000"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            style={inputStyle}
          />

          <p style={labelStyle}>WhatsApp (opcional — si es diferente al teléfono)</p>
          <input
            type="tel"
            placeholder="664 000 0000"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Logo de tu negocio (opcional)</h2>
          <p style={{ fontSize: '13px', color: '#888', marginBottom: '14px' }}>
            Aparece en tus resultados de búsqueda y en tu página. Si no lo tienes a la mano,
            puedes subirlo después desde tu panel.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={logoPreviewBoxStyle}>
              {logoPreview ? (
                <img src={logoPreview} alt="Logo elegido" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: '11px', color: '#bbb', textAlign: 'center' }}>Sin logo</span>
              )}
            </div>
            <label style={{ ...selectStyle, flex: 1, textAlign: 'center', cursor: 'pointer', margin: 0 }}>
              {logoFile ? 'Cambiar logo' : 'Subir logo'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={manejarSeleccionLogo}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>

        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Estilo de tu página</h2>
          <p style={{ fontSize: '13px', color: '#888', marginBottom: '14px' }}>
            Elige los colores de tu página — puedes cambiarlo después.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '10px' }}>
            {TEMAS_COLOR.map((tema) => (
              <button
                key={tema.id}
                type="button"
                onClick={() => setTemaElegido(tema.id)}
                style={{
                  border: temaElegido === tema.id ? '2px solid #1A3C5E' : '2px solid transparent',
                  borderRadius: '10px', padding: '6px', cursor: 'pointer',
                  backgroundColor: temaElegido === tema.id ? '#EEF2F7' : '#fff',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                }}
              >
                <div style={{ display: 'flex', width: '100%', height: '28px', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ flex: 1, backgroundColor: tema.colorPrimario }} />
                  <div style={{ flex: 1, backgroundColor: tema.colorAcento }} />
                </div>
                <span style={{ fontSize: '11px', color: '#555', fontWeight: '600', textAlign: 'center' }}>{tema.nombre}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Acceso a tu panel</h2>

          <p style={labelStyle}>Correo electrónico *</p>
          <input
            type="email"
            placeholder="tucorreo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />

          <p style={labelStyle}>Contraseña * (mínimo 6 caracteres)</p>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />

          <p style={labelStyle}>Confirmar contraseña *</p>
          <input
            type="password"
            placeholder="••••••••"
            value={confirmarPassword}
            onChange={(e) => setConfirmarPassword(e.target.value)}
            style={inputStyle}
          />
        </div>

        {error && (
          <div style={errorStyle}>
            <p style={{ margin: 0, fontSize: '13px', color: '#D85A30' }}>{error}</p>
          </div>
        )}

        <button onClick={handleRegistro} disabled={registrando} style={buttonStyle}>
          {registrando ? 'Registrando...' : 'Crear cuenta gratis'}
        </button>

        <p style={{ textAlign: 'center', fontSize: '13px', color: '#888', marginTop: '16px' }}>
          ¿Ya tienes cuenta?{' '}
          <span
            onClick={() => router.push('/panel')}
            style={{ color: '#E8720C', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Iniciar sesión
          </span>
        </p>

      </div>
    </main>
  );
}

const sectionStyle = {
  backgroundColor: '#fff', borderRadius: '12px', padding: '18px',
  marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
};
const sectionTitleStyle = {
  fontSize: '16px', fontWeight: 'bold', color: '#1A3C5E', marginBottom: '12px',
};
const labelStyle = {
  fontSize: '13px', color: '#666', marginBottom: '6px', marginTop: '12px',
};
const inputStyle = {
  width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd',
  fontSize: '15px', backgroundColor: '#F4F5F5', color: '#333', boxSizing: 'border-box',
  marginBottom: '4px',
};
const selectStyle = {
  width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd',
  fontSize: '15px', backgroundColor: '#F4F5F5', color: '#333', boxSizing: 'border-box',
  cursor: 'pointer', marginBottom: '4px',
};
const buttonStyle = {
  width: '100%', padding: '16px', borderRadius: '10px', border: 'none',
  backgroundColor: '#E8720C', color: '#fff', fontWeight: 'bold',
  fontSize: '16px', cursor: 'pointer', marginBottom: '8px',
};
const freemiumBannerStyle = {
  backgroundColor: '#EEF2F7', border: '1px solid #1A3C5E', borderRadius: '10px',
  padding: '14px 16px', marginBottom: '16px',
};
const errorStyle = {
  backgroundColor: '#FEF0EC', border: '1px solid #F5C6B8', borderRadius: '8px',
  padding: '12px', marginBottom: '12px',
};
const logoPreviewBoxStyle = {
  width: '64px', height: '64px', borderRadius: '10px', border: '1px solid #eee',
  backgroundColor: '#F4F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0, overflow: 'hidden',
};