'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { auth } from '../../../lib/firebase';
import { cargarEstados } from '../../../lib/estados';
import { useAuth } from '../../AuthContext';
import {
  MENSAJES_REFACCIONARIA, TEXTOS_PROVISIONALES, URL_PRIVACIDAD_REFACCIONARIAS, URL_TERMINOS_REFACCIONARIAS, validarRegistroRefaccionaria,
} from '../../../../lib/refaccionarias';
import { ErrorRegistro, registrarRefaccionaria } from '../../../../lib/registrarRefaccionaria';
import {
  aceptarVersionRefaccionaria, borrarRefaccionaria, crearRefaccionaria, crearUsuarioRefaccionaria, leerConfigRefaccionarias, nuevoIdRefaccionaria,
} from '../datos';

function mensajeDeError(codigo) {
  if (codigo === 'correo-existe') return MENSAJES_REFACCIONARIA.correoExiste;
  if (codigo === 'a-medias') return MENSAJES_REFACCIONARIA.cuentaAMedias;
  return MENSAJES_REFACCIONARIA.errorGeneral;
}

// Registro de refaccionaria. Con config/refaccionarias.habilitado apagada (o sin el documento) solo
// muestra que el registro está cerrado, sin ninguna otra lectura (las reglas tampoco dejan crear).
export default function RegistroRefaccionaria() {
  const router = useRouter();
  const { recargarRol } = useAuth();
  const [config, setConfig] = useState(null); // null = cargando
  const [estados, setEstados] = useState([]);
  const [campos, setCampos] = useState({
    nombre: '', whatsapp: '', estado: '', ciudad: '', zonaDescripcion: '', zonaMunicipios: '', email: '', password: '', confirmarPassword: '',
  });
  const [aceptaLegal, setAceptaLegal] = useState(false);
  const [error, setError] = useState('');
  const [registrando, setRegistrando] = useState(false);
  const cambiar = (campo) => (e) => setCampos((c) => ({ ...c, [campo]: e.target.value }));

  useEffect(() => {
    let cancelado = false;
    leerConfigRefaccionarias()
      .then((c) => {
        if (cancelado) return;
        setConfig(c);
        if (c.habilitado) cargarEstados().then((lista) => { if (!cancelado) setEstados(lista); }).catch(() => {});
      })
      .catch(() => { if (!cancelado) setConfig({ habilitado: false }); });
    return () => { cancelado = true; };
  }, []);

  async function registrar() {
    setError('');
    const validacion = validarRegistroRefaccionaria(campos, estados.map((e) => e.id));
    if (!validacion.ok) { setError(validacion.mensaje); return; }
    if (!aceptaLegal) { setError(MENSAJES_REFACCIONARIA.aceptacionLegal); return; }
    setRegistrando(true);
    try {
      const datos = validacion.datos;
      await registrarRefaccionaria(datos, {
        crearCuenta: async (email, password) => (await createUserWithEmailAndPassword(auth, email, password)).user.uid,
        generarRefaccionariaId: nuevoIdRefaccionaria,
        crearRefaccionaria: (id, uid) => crearRefaccionaria(id, uid, datos),
        crearUsuario: crearUsuarioRefaccionaria,
        borrarRefaccionaria,
        borrarCuenta: () => deleteUser(auth.currentUser),
        // Sin versión vigente en config no hay nada que aceptar todavía: se aceptará al entrar.
        aceptarVersion: (id) => (config.terminosVersion ? aceptarVersionRefaccionaria(id, config.terminosVersion) : Promise.reject(new Error('sin versión'))),
      });
      const rol = await recargarRol();
      if (rol !== 'refaccionaria') throw new ErrorRegistro('a-medias');
      router.push('/panel/refaccionaria');
    } catch (err) {
      setError(mensajeDeError(err instanceof ErrorRegistro ? err.codigo : 'general'));
    } finally {
      setRegistrando(false);
    }
  }

  if (config === null) {
    return <main style={fondo}><p style={{ color: '#555' }}>Cargando...</p></main>;
  }

  if (!config.habilitado) {
    return (
      <main style={fondo}>
        <div style={{ ...tarjeta, textAlign: 'center' }}>
          <h1 style={{ fontSize: '20px', color: '#1A3C5E', margin: '0 0 12px' }}>Registro de refaccionarias: próximamente</h1>
          <p style={{ fontSize: '15px', color: '#555', margin: '0 0 20px' }}>{TEXTOS_PROVISIONALES.registroCerrado}</p>
          <button onClick={() => router.push('/panel')} style={enlace}>Volver al inicio de sesión</button>
        </div>
      </main>
    );
  }

  return (
    <main style={fondo}>
      <div style={{ maxWidth: '420px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img src="/logo-mecanix-solo.webp" alt="Mecanix" style={{ width: '220px', maxWidth: '100%', margin: '0 auto', display: 'block' }} />
          <p style={{ fontSize: '14px', color: '#E8720C', letterSpacing: '2px', marginTop: '8px', fontWeight: 'bold' }}>REGISTRO DE REFACCIONARIA</p>
        </div>
        <div style={tarjeta}>
          <label style={etiqueta} htmlFor="r-nombre">Nombre de la refaccionaria</label>
          <input id="r-nombre" value={campos.nombre} onChange={cambiar('nombre')} style={campo} />
          <label style={etiqueta} htmlFor="r-whatsapp">WhatsApp (10 dígitos)</label>
          <input id="r-whatsapp" type="tel" value={campos.whatsapp} onChange={cambiar('whatsapp')} placeholder="6641234567" style={campo} />
          <label style={etiqueta} htmlFor="r-estado">Estado</label>
          <select id="r-estado" value={campos.estado} onChange={cambiar('estado')} style={campo}>
            <option value="">Elige tu estado</option>
            {estados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
          <label style={etiqueta} htmlFor="r-ciudad">Ciudad</label>
          <input id="r-ciudad" value={campos.ciudad} onChange={cambiar('ciudad')} style={campo} />
          <label style={etiqueta} htmlFor="r-zona">Zona de entrega local (opcional)</label>
          <input id="r-zona" value={campos.zonaDescripcion} onChange={cambiar('zonaDescripcion')} maxLength={300} placeholder="Ej. Entregamos en Tijuana centro y Otay" style={campo} />
          <label style={etiqueta} htmlFor="r-municipios">Municipios de entrega (opcional, separados por coma)</label>
          <input id="r-municipios" value={campos.zonaMunicipios} onChange={cambiar('zonaMunicipios')} style={campo} />
          <label style={etiqueta} htmlFor="r-email">Correo electrónico</label>
          <input id="r-email" type="email" value={campos.email} onChange={cambiar('email')} style={campo} />
          <label style={etiqueta} htmlFor="r-password">Contraseña (mínimo 8 caracteres)</label>
          <input id="r-password" type="password" value={campos.password} onChange={cambiar('password')} style={campo} />
          <label style={etiqueta} htmlFor="r-confirmar">Confirmar contraseña</label>
          <input id="r-confirmar" type="password" value={campos.confirmarPassword} onChange={cambiar('confirmarPassword')} style={campo} />

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', margin: '12px 0 14px', cursor: 'pointer' }}>
            <input type="checkbox" checked={aceptaLegal} onChange={(e) => setAceptaLegal(e.target.checked)}
              style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: '#E8720C', cursor: 'pointer', flexShrink: 0 }} />
            <span style={{ fontSize: '14px', color: '#555', lineHeight: '1.5' }}>
              {TEXTOS_PROVISIONALES.aceptacionRegistro}{' '}
              (<a href={URL_TERMINOS_REFACCIONARIAS} target="_blank" rel="noopener noreferrer" style={{ color: '#E8720C', fontWeight: 'bold' }}>Términos</a>
              {' · '}
              <a href={URL_PRIVACIDAD_REFACCIONARIAS} target="_blank" rel="noopener noreferrer" style={{ color: '#E8720C', fontWeight: 'bold' }}>Aviso de Privacidad</a>)
            </span>
          </label>

          {error && <p role="alert" style={{ color: '#D85A30', fontSize: '13px', margin: '4px 0 12px' }}>{error}</p>}
          <button onClick={registrar} disabled={registrando} style={boton}>{registrando ? 'Registrando...' : 'Registrar refaccionaria'}</button>
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <button onClick={() => router.push('/panel')} style={enlace}>Ya tengo cuenta: iniciar sesión</button>
          </div>
        </div>
      </div>
    </main>
  );
}

const fondo = { minHeight: '100vh', backgroundColor: '#F4F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' };
const tarjeta = { maxWidth: '420px', width: '100%', boxSizing: 'border-box', backgroundColor: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' };
const etiqueta = { display: 'block', fontSize: '13px', color: '#555', marginBottom: '4px', marginTop: '10px' };
const campo = { width: '100%', padding: '12px 14px', fontSize: '15px', borderRadius: '10px', border: '1px solid #DDD', marginBottom: '6px', boxSizing: 'border-box', backgroundColor: '#fff' };
const boton = { width: '100%', padding: '14px', fontSize: '16px', fontWeight: 'bold', color: '#fff', backgroundColor: '#E8720C', border: 'none', borderRadius: '10px', cursor: 'pointer', marginTop: '8px' };
const enlace = { background: 'none', border: 'none', color: '#1A3C5E', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' };
