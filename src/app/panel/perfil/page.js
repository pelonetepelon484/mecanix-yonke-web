'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../../lib/firebase';
import { useAuth } from '../AuthContext';
import BottomNav from '../BottomNav';
import { subirLogoYonke, borrarLogoYonke, validarArchivoLogo } from '../../lib/subirLogoYonke';
import { TEMAS_COLOR, TEMA_DEFAULT_ID } from '../../lib/temasColor';

const METODOS_PAGO = [
  { key: 'efectivo', label: 'Efectivo' },
  { key: 'tarjeta', label: 'Tarjeta (débito/crédito)' },
  { key: 'transferencia', label: 'Transferencia bancaria' },
  { key: 'spei', label: 'SPEI' },
  { key: 'codi', label: 'CoDi' },
  { key: 'zelle', label: 'Zelle' },
  { key: 'paypal', label: 'PayPal' },
];

const DIAS = [
  { key: 'lunes', label: 'Lunes' },
  { key: 'martes', label: 'Martes' },
  { key: 'miercoles', label: 'Miércoles' },
  { key: 'jueves', label: 'Jueves' },
  { key: 'viernes', label: 'Viernes' },
  { key: 'sabado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' },
];

const HORARIO_DEFAULT = {
  lunes:     { abierto: true,  apertura: '08:00', cierre: '17:00' },
  martes:    { abierto: true,  apertura: '08:00', cierre: '17:00' },
  miercoles: { abierto: true,  apertura: '08:00', cierre: '17:00' },
  jueves:    { abierto: true,  apertura: '08:00', cierre: '17:00' },
  viernes:   { abierto: true,  apertura: '08:00', cierre: '17:00' },
  sabado:    { abierto: true,  apertura: '08:00', cierre: '14:00' },
  domingo:   { abierto: false, apertura: '09:00', cierre: '13:00' },
};

export default function PerfilPanel() {
  const router = useRouter();
  const { user, yonkeId, loading } = useAuth();

  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [metodosPago, setMetodosPago] = useState([]);
  const [horario, setHorario] = useState(HORARIO_DEFAULT);
  const [loadingPerfil, setLoadingPerfil] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [logoUrl, setLogoUrl] = useState(null);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [temaElegido, setTemaElegido] = useState(TEMA_DEFAULT_ID);
  const [guardandoTema, setGuardandoTema] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      const timer = setTimeout(() => router.push('/panel'), 1500);
      return () => clearTimeout(timer);
    }
  }, [user, loading]);

  useEffect(() => {
    async function cargarPerfil() {
      if (!yonkeId) return;
      const ref = doc(db, 'yonkes', yonkeId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setNombre(data.nombre || '');
        setDireccion(data.direccion || '');
        setTelefono(data.telefono || '');
        setMetodosPago(data.metodosPago || []);
        setHorario(data.horario || HORARIO_DEFAULT);
        setLogoUrl(data.logoUrl || null);
        // Marca el tema que coincida con los colores actuales; si no tiene branding o tiene
        // colores personalizados que no calzan con ningún tema, se muestra Azul Mecanix
        // resaltado SOLO como default visual — no se guarda nada hasta que el yonke elija.
        const b = data.branding || {};
        const temaActual = TEMAS_COLOR.find((t) => t.colorPrimario === b.colorPrimario && t.colorAcento === b.colorAcento);
        setTemaElegido(temaActual ? temaActual.id : TEMA_DEFAULT_ID);
      }
      setLoadingPerfil(false);
    }
    cargarPerfil();
  }, [yonkeId]);

  async function manejarSeleccionLogo(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo si se corrige algo
    if (!file) return;

    const errorValidacion = validarArchivoLogo(file);
    if (errorValidacion) { alert(errorValidacion); return; }

    setSubiendoLogo(true);
    try {
      const url = await subirLogoYonke(yonkeId, file);
      // Se guarda en ambos campos (igual que panel/registro) para que la página del
      // subdominio, que lee branding.logoUrl, no se quede con una versión vieja.
      // updateDoc (no setDoc+merge) es obligatorio aquí: solo updateDoc interpreta
      // 'branding.logoUrl' como ruta anidada — con setDoc+merge crea un campo LITERAL
      // llamado "branding.logoUrl" (con el punto en el nombre) en vez de anidarlo.
      await updateDoc(doc(db, 'yonkes', yonkeId), { logoUrl: url, 'branding.logoUrl': url });
      setLogoUrl(url);
    } catch (error) {
      console.error(error);
      alert('No se pudo subir el logo. Intenta de nuevo.');
    } finally {
      setSubiendoLogo(false);
    }
  }

  async function quitarLogo() {
    if (!confirm('¿Quitar el logo actual? Volverá a mostrarse solo el nombre del yonke.')) return;
    setSubiendoLogo(true);
    try {
      await borrarLogoYonke(yonkeId);
      await updateDoc(doc(db, 'yonkes', yonkeId), { logoUrl: deleteField(), 'branding.logoUrl': deleteField() });
      setLogoUrl(null);
    } catch (error) {
      console.error(error);
      alert('No se pudo quitar el logo. Intenta de nuevo.');
    } finally {
      setSubiendoLogo(false);
    }
  }

  // Guardado inmediato al elegir un tema (igual que el logo) — así nunca se sobreescriben
  // colores personalizados como efecto secundario de guardar otra sección del perfil con el
  // botón de abajo; solo se escribe cuando el yonke de verdad da clic en un tema.
  async function elegirTema(temaId) {
    const tema = TEMAS_COLOR.find((t) => t.id === temaId);
    if (!tema) return;
    setGuardandoTema(true);
    try {
      // updateDoc (no setDoc+merge): con setDoc+merge, una key con punto como
      // 'branding.colorPrimario' se guarda LITERAL (el nombre del campo lleva el punto),
      // no anidada — por eso resolveBranding() nunca encontraba tenant.branding.colorPrimario
      // y siempre caía al azul default. updateDoc sí interpreta el punto como ruta anidada.
      await updateDoc(doc(db, 'yonkes', yonkeId), {
        'branding.colorPrimario': tema.colorPrimario,
        'branding.colorAcento': tema.colorAcento,
      });
      setTemaElegido(temaId);
    } catch (error) {
      console.error(error);
      alert('No se pudo guardar el tema de color. Intenta de nuevo.');
    } finally {
      setGuardandoTema(false);
    }
  }

  function toggleMetodo(key) {
    setMetodosPago(prev =>
      prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key]
    );
  }

  function toggleDia(dia) {
    setHorario(prev => ({
      ...prev,
      [dia]: { ...prev[dia], abierto: !prev[dia].abierto }
    }));
  }

  function actualizarHora(dia, campo, valor) {
    const limpio = valor.replace(/[^0-9:]/g, '');
    setHorario(prev => ({
      ...prev,
      [dia]: { ...prev[dia], [campo]: limpio }
    }));
  }

  async function guardarPerfil() {
    if (!nombre || !direccion || !telefono) {
      alert('Llena nombre, dirección y teléfono');
      return;
    }
    setGuardando(true);
    try {
      const ref = doc(db, 'yonkes', yonkeId);
      await setDoc(ref, {
        nombre: nombre.trim(),
        direccion: direccion.trim(),
        telefono: telefono.trim(),
        metodosPago,
        horario,
      }, { merge: true });
      alert('Tu perfil se guardó correctamente');
    } catch (error) {
      console.error(error);
      alert('No se pudo guardar el perfil');
    } finally {
      setGuardando(false);
    }
  }

  async function handleLogout() {
    await signOut(auth);
    router.push('/panel');
  }

  if (loading || !user || loadingPerfil) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A3C5E' }}>
        <p style={{ color: '#fff' }}>Cargando...</p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', paddingBottom: '70px' }}>
      <div style={{ backgroundColor: '#1A3C5E', padding: '20px 16px', paddingTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '600px', margin: '0 auto' }}>
          <h1 style={{ color: '#fff', fontSize: '20px', margin: 0, fontWeight: 'bold' }}>Mi negocio</h1>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#E8720C', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>

        {/* Logo del negocio */}
        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Logo del negocio</h2>
          <p style={{ fontSize: '13px', color: '#888', marginBottom: '14px' }}>
            Aparece junto a tu nombre en los resultados de búsqueda. PNG, JPEG o WEBP, máximo 2MB.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '14px' }}>
            <div style={logoPreviewBoxStyle}>
              {logoUrl ? (
                <img src={logoUrl} alt="Logo actual" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: '11px', color: '#bbb', textAlign: 'center' }}>Sin logo</span>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ ...saveButtonStyle, display: 'block', textAlign: 'center', opacity: subiendoLogo ? 0.6 : 1, cursor: subiendoLogo ? 'wait' : 'pointer', marginBottom: logoUrl ? '8px' : 0 }}>
                {subiendoLogo ? 'Procesando...' : (logoUrl ? 'Reemplazar logo' : 'Subir logo')}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={manejarSeleccionLogo}
                  disabled={subiendoLogo}
                  style={{ display: 'none' }}
                />
              </label>
              {logoUrl && (
                <button
                  onClick={quitarLogo}
                  disabled={subiendoLogo}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: '#fff', color: '#C62828', fontWeight: 'bold', fontSize: '13px', cursor: subiendoLogo ? 'wait' : 'pointer' }}
                >
                  Quitar logo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Color de tu página */}
        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Color de tu página</h2>
          <p style={{ fontSize: '13px', color: '#888', marginBottom: '14px' }}>
            Así se ven los colores de tu página con subdominio propio. Se guarda al instante al elegir.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '10px' }}>
            {TEMAS_COLOR.map((tema) => (
              <button
                key={tema.id}
                type="button"
                onClick={() => elegirTema(tema.id)}
                disabled={guardandoTema}
                style={{
                  border: temaElegido === tema.id ? '2px solid #1A3C5E' : '2px solid transparent',
                  borderRadius: '10px', padding: '6px', cursor: guardandoTema ? 'wait' : 'pointer',
                  backgroundColor: temaElegido === tema.id ? '#EEF2F7' : '#fff',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                  opacity: guardandoTema ? 0.6 : 1,
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

        {/* Información del negocio */}
        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Información del negocio</h2>

          <p style={labelStyle}>Nombre del yonke</p>
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Yonke El Tigre" style={inputStyle} />

          <p style={labelStyle}>Dirección</p>
          <input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle, colonia, referencias" style={inputStyle} />

          <p style={labelStyle}>Teléfono</p>
          <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="664 000 0000" style={inputStyle} />
        </div>

        {/* Horarios */}
        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Horario de atención</h2>
          <p style={{ fontSize: '13px', color: '#888', marginBottom: '14px' }}>
            El cliente verá esto en los resultados de búsqueda
          </p>

          {DIAS.map(({ key, label }) => {
            const diaData = horario[key] || { abierto: false, apertura: '08:00', cierre: '17:00' };
            return (
              <div key={key} style={diaRowStyle}>
                <div style={diaHeaderStyle}>
                  <span style={{ fontSize: '15px', fontWeight: 'bold', color: diaData.abierto ? '#1A3C5E' : '#bbb' }}>
                    {label}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '12px', color: '#888' }}>
                      {diaData.abierto ? 'Abierto' : 'Cerrado'}
                    </span>
                    <input
                      type="checkbox"
                      checked={diaData.abierto}
                      onChange={() => toggleDia(key)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#1A3C5E' }}
                    />
                  </div>
                </div>

                {diaData.abierto && (
                  <div style={horasRowStyle}>
                    <div style={{ flex: 1 }}>
                      <p style={horaLabelStyle}>Apertura</p>
                      <input
                        type="text"
                        value={diaData.apertura}
                        onChange={(e) => actualizarHora(key, 'apertura', e.target.value)}
                        placeholder="08:00"
                        maxLength={5}
                        style={horaInputStyle}
                      />
                    </div>
                    <span style={{ fontSize: '18px', color: '#ccc', marginTop: '20px' }}>—</span>
                    <div style={{ flex: 1 }}>
                      <p style={horaLabelStyle}>Cierre</p>
                      <input
                        type="text"
                        value={diaData.cierre}
                        onChange={(e) => actualizarHora(key, 'cierre', e.target.value)}
                        placeholder="17:00"
                        maxLength={5}
                        style={horaInputStyle}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Métodos de pago */}
        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Métodos de pago que aceptas</h2>
          <p style={{ fontSize: '13px', color: '#888', marginBottom: '14px' }}>
            El cliente verá esto antes de visitarte
          </p>

          {METODOS_PAGO.map((metodo) => {
            const activo = metodosPago.includes(metodo.key);
            return (
              <label key={metodo.key} style={checkboxRowStyle}>
                <input
                  type="checkbox"
                  checked={activo}
                  onChange={() => toggleMetodo(metodo.key)}
                  style={{ width: '18px', height: '18px', marginRight: '12px', cursor: 'pointer', accentColor: '#E8720C' }}
                />
                <span style={{ fontSize: '15px', color: '#333' }}>{metodo.label}</span>
              </label>
            );
          })}
        </div>

        <button onClick={guardarPerfil} disabled={guardando} style={saveButtonStyle}>
          {guardando ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      <BottomNav />
    </main>
  );
}

const logoPreviewBoxStyle = {
  width: '72px', height: '72px', borderRadius: '10px', border: '1px solid #eee',
  backgroundColor: '#F4F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0, overflow: 'hidden',
};
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
};
const diaRowStyle = {
  borderBottom: '1px solid #F4F5F5', paddingTop: '10px', paddingBottom: '10px',
};
const diaHeaderStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
};
const horasRowStyle = {
  display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px',
};
const horaLabelStyle = {
  fontSize: '11px', color: '#999', marginBottom: '4px',
};
const horaInputStyle = {
  width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd',
  fontSize: '16px', color: '#1A3C5E', fontWeight: 'bold', textAlign: 'center',
  backgroundColor: '#F4F5F5', boxSizing: 'border-box',
};
const checkboxRowStyle = {
  display: 'flex', alignItems: 'center', padding: '10px 0', cursor: 'pointer',
};
const saveButtonStyle = {
  width: '100%', padding: '16px', borderRadius: '10px', border: 'none',
  backgroundColor: '#E8720C', color: '#fff', fontWeight: 'bold',
  fontSize: '16px', cursor: 'pointer', marginBottom: '40px',
};