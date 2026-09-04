'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, setDoc, deleteDoc, Timestamp, deleteField, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { enviarRecuperacionPassword } from '../../../lib/passwordReset';
import { crearUsuarioYonkeSinDeslogear } from '../../../lib/crearUsuarioYonke';
import { ESTADO_DEFAULT, cargarEstados } from '../../../lib/estados';
import { generarSubdominioUnico } from '../../../lib/generarSubdominio';

// Mismos textos que "Reenviar recuperación" en la app (UsuariosYonkeScreen.js en
// mecanix-yonke-virtual2) para que la experiencia sea idéntica en web y app.
function mostrarResultadoRecuperacion(resultado, email) {
  if (resultado.ok) {
    alert(`Listo\n\nSe envió el correo de recuperación a ${email}`);
  } else if (resultado.tipo === 'sin-conexion') {
    alert('Sin conexión\n\nNecesitas conexión a internet para enviar el correo de recuperación.');
  } else if (resultado.tipo === 'invalido' || resultado.tipo === 'vacio') {
    alert('Error\n\nEste usuario no tiene un correo válido registrado.');
  } else {
    alert('Error\n\nNo se pudo enviar el correo de recuperación. Intenta de nuevo.');
  }
}

const CIUDADES_BC = [
  { key: 'tijuana', label: 'Tijuana' },
  { key: 'mexicali', label: 'Mexicali' },
  { key: 'ensenada', label: 'Ensenada' },
  { key: 'tecate', label: 'Tecate' },
  { key: 'rosarito', label: 'Playas de Rosarito' },
  { key: 'sanquintin', label: 'San Quintín' },
];

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

function formatearFechaInput(fecha) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function EditarYonkePage() {
  const router = useRouter();
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [estados, setEstados] = useState([{ id: ESTADO_DEFAULT, nombre: 'Baja California' }]);
  const [estado, setEstado] = useState(ESTADO_DEFAULT);
  const [ciudad, setCiudad] = useState('tijuana');
  const [ciudadLibre, setCiudadLibre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [plan, setPlan] = useState('freemium');
  const [premiumHasta, setPremiumHasta] = useState('');
  const [activo, setActivo] = useState(true);
  const [verificado, setVerificado] = useState(false);
  const [entregaInmediata, setEntregaInmediata] = useState(false);
  const [capturaADomicilio, setCapturaADomicilio] = useState(false);
  const [subdominioActivo, setSubdominioActivo] = useState(true);
  const [subdominio, setSubdominio] = useState('');
  const [generandoSubdominio, setGenerandoSubdominio] = useState(false);
  const [metodosPago, setMetodosPago] = useState([]);
  const [horario, setHorario] = useState(HORARIO_DEFAULT);

  const [usuarios, setUsuarios] = useState([]);
  const [reenviandoId, setReenviandoId] = useState(null);
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [nuevoPassword, setNuevoPassword] = useState('');
  const [creandoAcceso, setCreandoAcceso] = useState(false);
  const [revocandoId, setRevocandoId] = useState(null);

  async function cargarUsuarios() {
    const ref = collection(db, 'usuarios');
    const q = query(ref, where('yonkeId', '==', id));
    const snap = await getDocs(q);
    setUsuarios(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  useEffect(() => {
    cargarUsuarios();
  }, [id]);

  async function crearAcceso() {
    if (!nuevoEmail.trim() || !nuevoPassword) {
      alert('Llena el correo y la contraseña del nuevo acceso'); return;
    }
    if (nuevoPassword.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres'); return;
    }
    setCreandoAcceso(true);
    try {
      const uid = await crearUsuarioYonkeSinDeslogear(nuevoEmail.trim(), nuevoPassword);
      await setDoc(doc(db, 'usuarios', uid), {
        rol: 'yonke',
        yonkeId: id,
        email: nuevoEmail.trim(),
        fechaRegistro: new Date(),
      });
      setNuevoEmail('');
      setNuevoPassword('');
      await cargarUsuarios();
      alert('✅ Acceso creado. Ya puede iniciar sesión con ese correo y contraseña.');
    } catch (error) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        alert('Ese correo ya tiene una cuenta registrada.');
      } else if (error.code === 'auth/invalid-email') {
        alert('El correo no es válido.');
      } else if (error.code === 'auth/weak-password') {
        alert('La contraseña es muy débil (mínimo 6 caracteres).');
      } else {
        alert('No se pudo crear el acceso. Intenta de nuevo.');
      }
    } finally {
      setCreandoAcceso(false);
    }
  }

  async function revocarAcceso(usuario) {
    if (!confirm(`¿Revocar el acceso de ${usuario.email}?\n\nEsto quita su acceso a la plataforma de inmediato. La cuenta de Firebase Authentication NO se elimina — deberás borrarla aparte en la consola de Firebase si ya no la quieres.`)) return;
    setRevocandoId(usuario.id);
    try {
      await deleteDoc(doc(db, 'usuarios', usuario.id));
      await cargarUsuarios();
      alert(`Acceso revocado.\n\nRecuerda eliminar manualmente la cuenta de Firebase Authentication de ${usuario.email} en la consola de Firebase para evitar una cuenta huérfana.`);
    } catch (error) {
      console.error(error);
      alert('No se pudo revocar el acceso. Intenta de nuevo.');
    } finally {
      setRevocandoId(null);
    }
  }

  async function reenviarRecuperacion(usuario) {
    setReenviandoId(usuario.id);
    const resultado = await enviarRecuperacionPassword(usuario.email);
    setReenviandoId(null);
    mostrarResultadoRecuperacion(resultado, usuario.email);
  }

  useEffect(() => {
    cargarEstados().then(setEstados);
  }, []);

  useEffect(() => {
    async function cargarYonke() {
      const ref = doc(db, 'yonkes', id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setNombre(data.nombre || '');
        setDireccion(data.direccion || '');
        // Compatibilidad: yonkes de antes de este cambio no tienen `estado` — se asume Baja
        // California, igual que estadoDeYonke() en todo el resto del proyecto.
        const estadoDoc = data.estado || ESTADO_DEFAULT;
        setEstado(estadoDoc);
        if (estadoDoc === ESTADO_DEFAULT) {
          setCiudad(data.ciudad || 'tijuana');
        } else {
          setCiudadLibre(data.ciudad || '');
        }
        setTelefono(data.telefono || '');
        setWhatsapp(data.whatsapp || '');
        setEmail(data.email || '');
        setPlan(data.plan || 'freemium');
        if (data.premiumHasta) {
          const fecha = data.premiumHasta?.toDate ? data.premiumHasta.toDate() : new Date(data.premiumHasta);
          setPremiumHasta(formatearFechaInput(fecha));
        }
        setActivo(data.activo !== false);
        setVerificado(data.verificado === true);
        setEntregaInmediata(data.entregaInmediata === true);
        setCapturaADomicilio(data.capturaADomicilio === true);
        // Compatibilidad: si el campo no existe (subdominios que ya funcionaban antes de este
        // control), se muestra activo por defecto — igual que subdominioEstaActivo() en getTenant.js.
        setSubdominioActivo(data.subdominioActivo !== false);
        setSubdominio(data.subdominio || '');
        setMetodosPago(data.metodosPago || []);
        setHorario(data.horario || HORARIO_DEFAULT);
      }
      setLoading(false);
    }
    cargarYonke();
  }, [id]);

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

  const esBC = estado === ESTADO_DEFAULT;

  // Genera y guarda el subdominio de un yonke que se registró antes de que esto existiera
  // (o manualmente sin uno) — misma función que usa el registro nuevo, así que el resultado y
  // la verificación de colisión son idénticos en ambos caminos.
  async function generarSubdominioAdmin() {
    setGenerandoSubdominio(true);
    try {
      const ciudadFinal = esBC ? ciudad : ciudadLibre;
      const nuevo = await generarSubdominioUnico(nombre, ciudadFinal, id);
      await setDoc(doc(db, 'yonkes', id), { subdominio: nuevo, subdominioActivo: true }, { merge: true });
      setSubdominio(nuevo);
      setSubdominioActivo(true);
    } catch (error) {
      console.error(error);
      alert('No se pudo generar el subdominio, intenta de nuevo.');
    } finally {
      setGenerandoSubdominio(false);
    }
  }

  async function guardar() {
    const ciudadFinal = esBC ? ciudad : ciudadLibre.trim();
    if (!nombre || !direccion || !ciudadFinal || !telefono) {
      alert('Llena nombre, ciudad, dirección y teléfono'); return;
    }
    setGuardando(true);
    try {
      await setDoc(doc(db, 'yonkes', id), {
        nombre: nombre.trim(),
        direccion: direccion.trim(),
        estado,
        ciudad: ciudadFinal,
        telefono: telefono.trim(),
        whatsapp: whatsapp.trim() || telefono.trim(),
        email: email.trim(),
        plan,
        premiumHasta: plan === 'premium' && premiumHasta
          ? Timestamp.fromDate(new Date(`${premiumHasta}T00:00:00`))
          : deleteField(),
        activo,
        verificado,
        entregaInmediata,
        capturaADomicilio,
        subdominioActivo,
        metodosPago,
        horario,
      }, { merge: true });
      alert('✅ Yonke actualizado correctamente');
      router.push('/admin');
    } catch (error) {
      console.error(error);
      alert('No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A3C5E' }}>
        <p style={{ color: '#fff' }}>Cargando...</p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F0F2F5', fontFamily: "'Inter', sans-serif", paddingBottom: '40px' }}>
      <div style={{ backgroundColor: '#1A3C5E', padding: '20px 16px', paddingTop: '24px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: '#E8720C', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold', padding: 0 }}>
              ← Volver
            </button>
            <h1 style={{ color: '#fff', fontSize: '18px', margin: '4px 0 0', fontWeight: '700' }}>Editar yonke</h1>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>

        {/* Info básica */}
        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Información del negocio</h2>

          <p style={labelStyle}>Nombre *</p>
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del yonke" style={inputStyle} />

          <p style={labelStyle}>Estado *</p>
          <select value={estado} onChange={(e) => setEstado(e.target.value)} style={inputStyle}>
            {estados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>

          <p style={labelStyle}>Ciudad *</p>
          {esBC ? (
            <select value={ciudad} onChange={(e) => setCiudad(e.target.value)} style={inputStyle}>
              {CIUDADES_BC.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          ) : (
            <input type="text" value={ciudadLibre} onChange={(e) => setCiudadLibre(e.target.value)} placeholder="Ej. Guadalajara" style={inputStyle} />
          )}

          <p style={labelStyle}>Dirección *</p>
          <input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Dirección completa" style={inputStyle} />

          <p style={labelStyle}>Teléfono *</p>
          <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="664 000 0000" style={inputStyle} />

          <p style={labelStyle}>WhatsApp</p>
          <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="664 000 0000" style={inputStyle} />

          <p style={labelStyle}>Correo electrónico</p>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" style={inputStyle} />
        </div>

        {/* Accesos / Usuarios */}
        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Accesos / Usuarios</h2>

          {usuarios.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#999', margin: '0 0 8px' }}>
              Este yonke todavía no tiene ningún acceso creado.
            </p>
          ) : (
            usuarios.map((u) => (
              <div key={u.id} style={{ padding: '10px 0', borderBottom: '1px solid #F4F5F5' }}>
                <span style={{ fontSize: '14px', color: '#333', fontWeight: '600' }}>{u.email}</span>
                <div style={{ display: 'flex', gap: '16px', marginTop: '6px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => reenviarRecuperacion(u)}
                    disabled={reenviandoId === u.id}
                    style={{ background: 'none', border: 'none', color: '#1A3C5E', fontWeight: 'bold', fontSize: '13px', cursor: reenviandoId === u.id ? 'wait' : 'pointer', padding: 0 }}
                  >
                    {reenviandoId === u.id ? 'Enviando...' : 'Reenviar recuperación'}
                  </button>
                  <button
                    onClick={() => revocarAcceso(u)}
                    disabled={revocandoId === u.id}
                    style={{ background: 'none', border: 'none', color: '#C62828', fontWeight: 'bold', fontSize: '13px', cursor: revocandoId === u.id ? 'wait' : 'pointer', padding: 0 }}
                  >
                    {revocandoId === u.id ? 'Revocando...' : '🚫 Revocar acceso'}
                  </button>
                </div>
              </div>
            ))
          )}

          <p style={{ fontSize: '13px', fontWeight: '700', color: '#1A3C5E', margin: '18px 0 8px' }}>
            Crear nuevo acceso
          </p>
          <input
            type="email"
            placeholder="correo@ejemplo.com"
            value={nuevoEmail}
            onChange={(e) => setNuevoEmail(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Contraseña (mínimo 6 caracteres)"
            value={nuevoPassword}
            onChange={(e) => setNuevoPassword(e.target.value)}
            style={inputStyle}
          />
          <button
            onClick={crearAcceso}
            disabled={creandoAcceso}
            style={{ ...primaryButtonStyle, backgroundColor: '#1A3C5E', marginTop: '4px' }}
          >
            {creandoAcceso ? 'Creando...' : '+ Crear acceso'}
          </button>
          <p style={{ fontSize: '11px', color: '#999', marginTop: '10px' }}>
            Al revocar un acceso se quita de inmediato en la plataforma. La cuenta de Firebase
            Authentication no se elimina automáticamente — bórrala aparte en la consola de
            Firebase si ya no la quieres.
          </p>
        </div>

        {/* Plan y estado */}
        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Plan y estado</h2>

          <p style={labelStyle}>Plan</p>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            {['freemium', 'premium'].map(p => (
              <button key={p} onClick={() => setPlan(p)} style={{
                flex: 1, padding: '12px', borderRadius: '10px', border: '2px solid',
                borderColor: plan === p ? (p === 'premium' ? '#E8720C' : '#1A3C5E') : '#ddd',
                backgroundColor: plan === p ? (p === 'premium' ? '#FEF3EC' : '#EEF2F7') : '#F8F9FA',
                color: plan === p ? '#1A3C5E' : '#888', fontWeight: '700', cursor: 'pointer', fontSize: '14px',
              }}>
                {p === 'premium' ? '⭐ Premium' : '🆓 Básico'}
              </button>
            ))}
          </div>

          {plan === 'premium' && (
            <>
              <p style={labelStyle}>Premium vence el</p>
              <input
                type="date"
                value={premiumHasta}
                onChange={(e) => setPremiumHasta(e.target.value)}
                style={inputStyle}
              />
            </>
          )}

          <p style={labelStyle}>Estado</p>
          <div style={{ display: 'flex', gap: '10px' }}>
            {[true, false].map(v => (
              <button key={String(v)} onClick={() => setActivo(v)} style={{
                flex: 1, padding: '12px', borderRadius: '10px', border: '2px solid',
                borderColor: activo === v ? (v ? '#2E7D32' : '#C62828') : '#ddd',
                backgroundColor: activo === v ? (v ? '#E8F5E9' : '#FDECEA') : '#F8F9FA',
                color: activo === v ? (v ? '#2E7D32' : '#C62828') : '#888',
                fontWeight: '700', cursor: 'pointer', fontSize: '14px',
              }}>
                {v ? '✓ Activo' : '✗ Inactivo'}
              </button>
            ))}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={verificado}
              onChange={(e) => setVerificado(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: '#2E7D32', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '14px', color: '#333', fontWeight: '600' }}>
              🛡️ Yonke verificado
            </span>
          </label>
          <p style={{ fontSize: '12px', color: '#999', marginTop: '4px', marginLeft: '28px' }}>
            Marca esto solo si confirmaste presencialmente que el negocio es real. Se muestra
            como sello de confianza en su ficha y en su página.
          </p>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={entregaInmediata}
              onChange={(e) => setEntregaInmediata(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: '#E8720C', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '14px', color: '#333', fontWeight: '600' }}>
              ⚡ Entrega inmediata disponible
            </span>
          </label>
          <p style={{ fontSize: '12px', color: '#999', marginTop: '4px', marginLeft: '28px' }}>
            Solo yonkes de confianza que ya coordinaste tú directamente. Los talleres podrán
            pedirte que les lleves la pieza — el pedido te llega a ti, no al yonke.
          </p>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={capturaADomicilio}
              onChange={(e) => setCapturaADomicilio(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: '#1A3C5E', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '14px', color: '#333', fontWeight: '600' }}>
              🚗 Captura a domicilio activa
            </span>
          </label>
          <p style={{ fontSize: '12px', color: '#999', marginTop: '4px', marginLeft: '28px' }}>
            Complemento de $800 MXN/mes — visitas tú el yonke ~1 vez al mes para capturar su
            inventario nuevo. El control de visitas está en{' '}
            <a href="/admin/captura-domicilio" style={{ color: '#1A3C5E', fontWeight: '700' }}>
              Captura a domicilio
            </a>.
          </p>

          <div style={{ marginTop: '16px' }}>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '6px' }}>Subdominio</p>
            {subdominio ? (
              <p style={{ fontSize: '14px', fontWeight: '700', color: '#1A3C5E', margin: 0 }}>
                {subdominio}.mecanixyonkevirtual.com
              </p>
            ) : (
              <button
                type="button"
                onClick={generarSubdominioAdmin}
                disabled={generandoSubdominio}
                style={{
                  padding: '8px 14px', borderRadius: '8px', border: 'none',
                  backgroundColor: '#1A3C5E', color: '#fff', fontWeight: '600',
                  fontSize: '13px', cursor: generandoSubdominio ? 'wait' : 'pointer',
                }}
              >
                {generandoSubdominio ? 'Generando...' : '🌐 Generar subdominio automático'}
              </button>
            )}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={subdominioActivo}
              onChange={(e) => setSubdominioActivo(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: '#1A3C5E', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '14px', color: '#333', fontWeight: '600' }}>
              🌐 Subdominio activo
            </span>
          </label>
          <p style={{ fontSize: '12px', color: '#999', marginTop: '4px', marginLeft: '28px' }}>
            Solo aplica si este yonke tiene un subdominio configurado (Plan Premium/Élite).
            Desmárcalo para apagarlo sin borrar su configuración — por ejemplo, si dejó de pagar.
            Quien entre a su subdominio será redirigido al sitio principal.
          </p>
        </div>

        {/* Métodos de pago */}
        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Métodos de pago</h2>
          {METODOS_PAGO.map(m => {
            const actv = metodosPago.includes(m.key);
            return (
              <label key={m.key} style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F4F5F5', cursor: 'pointer' }}>
                <input type="checkbox" checked={actv} onChange={() => toggleMetodo(m.key)}
                  style={{ width: '18px', height: '18px', marginRight: '12px', accentColor: '#E8720C' }} />
                <span style={{ fontSize: '15px', color: '#333' }}>{m.label}</span>
              </label>
            );
          })}
        </div>

        {/* Horario */}
        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Horario de atención</h2>
          {DIAS.map(({ key, label }) => {
            const diaData = horario[key] || { abierto: false, apertura: '08:00', cierre: '17:00' };
            return (
              <div key={key} style={{ borderBottom: '1px solid #F4F5F5', paddingTop: '10px', paddingBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '15px', fontWeight: '700', color: diaData.abierto ? '#1A3C5E' : '#bbb' }}>{label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '12px', color: '#888' }}>{diaData.abierto ? 'Abierto' : 'Cerrado'}</span>
                    <input type="checkbox" checked={diaData.abierto} onChange={() => toggleDia(key)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#1A3C5E' }} />
                  </div>
                </div>
                {diaData.abierto && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>Apertura</p>
                      <input type="text" value={diaData.apertura} onChange={(e) => actualizarHora(key, 'apertura', e.target.value)}
                        placeholder="08:00" maxLength={5} style={{ ...inputStyle, textAlign: 'center', fontWeight: '700', color: '#1A3C5E', marginBottom: 0 }} />
                    </div>
                    <span style={{ fontSize: '18px', color: '#ccc', marginTop: '16px' }}>—</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>Cierre</p>
                      <input type="text" value={diaData.cierre} onChange={(e) => actualizarHora(key, 'cierre', e.target.value)}
                        placeholder="17:00" maxLength={5} style={{ ...inputStyle, textAlign: 'center', fontWeight: '700', color: '#1A3C5E', marginBottom: 0 }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button onClick={guardar} disabled={guardando} style={{ ...primaryButtonStyle, marginTop: '8px' }}>
          {guardando ? 'Guardando...' : '💾 Guardar cambios'}
        </button>

      </div>
    </main>
  );
}

const sectionStyle = { backgroundColor: '#fff', borderRadius: '16px', padding: '18px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(26,60,94,0.06)' };
const sectionTitleStyle = { fontSize: '16px', fontWeight: '700', color: '#1A3C5E', marginBottom: '14px' };
const labelStyle = { fontSize: '13px', color: '#666', marginBottom: '6px', marginTop: '12px' };
const inputStyle = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '15px', backgroundColor: '#F8F9FA', color: '#333', boxSizing: 'border-box', marginBottom: '4px', fontFamily: "'Inter', sans-serif" };
const primaryButtonStyle = { width: '100%', padding: '16px', borderRadius: '10px', border: 'none', backgroundColor: '#E8720C', color: '#fff', fontWeight: '700', fontSize: '16px', cursor: 'pointer', fontFamily: "'Inter', sans-serif" };