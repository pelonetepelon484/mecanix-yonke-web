'use client';

// Registro ligero: una sola pantalla para contestar la búsqueda activa de la que viene. Solo pide
// nombre, WhatsApp y contraseña; el estado sale de la alerta y lo decide el servidor. El navegador
// no escribe nada en Firestore: /api/yonkes/registro-ligero crea todo y aquí solo se inicia sesión.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useAuth } from '../AuthContext';
import { DECLARACION_LIGERO } from '../../../lib/constanciasLegales';
import CasillasLegales, { CASILLAS_VACIAS } from './CasillasLegales';
import { MENSAJES_LIGERO, NOMBRE_MAX, PASSWORD_MAX, PASSWORD_MIN, RUTA_LIGERO, TEXTO_AVISO_NUMERO, correoInterno, validarRegistroLigero, whatsappDiezDigitos } from '../../../lib/yonkeLigero';

export const TEXTO_BOTON_LIGERO = 'Crear cuenta y responder';
export const textoOtroEstado = (estadoNombre) => `Esta búsqueda es solo para yonkes de ${estadoNombre}. Para contestar búsquedas de tu estado, haz tu registro y elige dónde está tu yonke.`;

const formatoWhatsapp = (n) => `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;

export default function RegistroLigero({ pedido }) {
  const router = useRouter();
  const { recargarRol } = useAuth();
  const [nombre, setNombre] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [casillas, setCasillas] = useState(CASILLAS_VACIAS);
  const [otroEstado, setOtroEstado] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [error, setError] = useState('');
  const [motivo, setMotivo] = useState('');

  const numero = whatsappDiezDigitos(whatsapp);
  const rutaCompleto = `/panel/registro?pedido=${pedido.id}&completo=1`;
  const rutaEntrar = `/panel?pedido=${pedido.id}`;

  async function registrar() {
    setError('');
    setMotivo('');
    const { error: invalido, datos } = validarRegistroLigero({ nombre, whatsapp, password, aceptaTerminos: casillas.terminos, aceptaPrivacidad: casillas.privacidad, declaraAutorizacion: casillas.autorizacion, pedidoId: pedido.id });
    if (invalido) {
      setError(invalido);
      return;
    }
    setRegistrando(true);
    try {
      const res = await fetch('/api/yonkes/registro-ligero', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: datos.nombre, whatsapp: datos.whatsapp, password: datos.password, pedidoId: datos.pedidoId, aceptaTerminos: true, aceptaPrivacidad: true, declaraAutorizacion: true }),
      });
      const respuesta = await res.json().catch(() => null);
      if (!res.ok || !respuesta?.ok) {
        setError(respuesta?.mensaje || MENSAJES_LIGERO.noDisponible);
        setMotivo(respuesta?.motivo || 'noDisponible');
        return;
      }
    } catch (err) {
      console.error(err);
      setError(MENSAJES_LIGERO.noDisponible);
      setMotivo('noDisponible');
      return;
    } finally {
      setRegistrando(false);
    }

    // La cuenta ya existe: si entrar falla, que lo intente con su WhatsApp, sin perder la alerta.
    try {
      await signInWithEmailAndPassword(auth, correoInterno(datos.whatsapp), datos.password);
      await recargarRol?.();
      router.replace(`${RUTA_LIGERO}?pedido=${pedido.id}`);
    } catch (err) {
      console.error(err);
      router.replace(rutaEntrar);
    }
  }

  if (otroEstado) {
    return (
      <Marco>
        <div style={seccion}>
          <p style={{ margin: '0 0 14px', fontSize: '15px', color: '#333', lineHeight: '1.5' }}>{textoOtroEstado(pedido.estadoNombre)}</p>
          <a href="/panel/registro?completo=1" style={botonEnlace}>Hacer mi registro</a>
          <button type="button" onClick={() => setOtroEstado(false)} style={enlaceDiscreto}>Regresar</button>
        </div>
      </Marco>
    );
  }

  return (
    <Marco>
      <div style={{ ...seccion, backgroundColor: '#FFF4E8', border: '1px solid #E8720C' }}>
        <p style={{ margin: 0, fontSize: '15px', color: '#1A3C5E', fontWeight: 'bold' }}>
          🙋 {pedido.pieza} · {pedido.vehiculo.marca} {pedido.vehiculo.modelo} {pedido.vehiculo.anio}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#555' }}>Crea tu cuenta y contesta esta búsqueda ahora mismo.</p>
      </div>

      <div style={seccion}>
        <label htmlFor="ligero-nombre" style={etiqueta}>Nombre de tu yonke</label>
        <input id="ligero-nombre" type="text" autoComplete="organization" placeholder="Ej. Yonke El Tigre" maxLength={NOMBRE_MAX} value={nombre} onChange={(e) => setNombre(e.target.value)} style={campo} />

        <label htmlFor="ligero-whatsapp" style={etiqueta}>Tu WhatsApp</label>
        <input id="ligero-whatsapp" type="tel" inputMode="tel" autoComplete="tel" placeholder="664 000 0000" maxLength={20} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} style={campo} />
        {numero && <p style={{ margin: '0 0 10px', fontSize: '18px', fontWeight: 'bold', color: '#1A3C5E', textAlign: 'center' }}>{formatoWhatsapp(numero)}</p>}
        <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#555', lineHeight: '1.5' }}>{TEXTO_AVISO_NUMERO}</p>

        <label htmlFor="ligero-password" style={etiqueta}>Contraseña (mínimo {PASSWORD_MIN} caracteres)</label>
        <div style={{ position: 'relative' }}>
          <input
            id="ligero-password" type={verPassword ? 'text' : 'password'} autoComplete="new-password" maxLength={PASSWORD_MAX}
            value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...campo, paddingRight: '64px' }}
          />
          <button type="button" onClick={() => setVerPassword(!verPassword)} style={botonVer}>{verPassword ? 'Ocultar' : 'Ver'}</button>
        </div>

        <p style={{ margin: '4px 0 0', fontSize: '15px', color: '#1A3C5E', fontWeight: 'bold' }}>📍 Mi yonke está en {pedido.estadoNombre}</p>
        <button type="button" onClick={() => setOtroEstado(true)} style={{ ...enlaceDiscreto, textAlign: 'left', margin: '2px 0 0' }}>Estoy en otro estado</button>
      </div>

      <CasillasLegales valores={casillas} onChange={setCasillas} declaracion={DECLARACION_LIGERO} />

      {error && (
        <div role="alert" style={cajaError}>
          <p style={{ margin: 0, fontSize: '13px', color: '#D85A30' }}>{error}</p>
          {motivo === 'yaRegistrado' && <a href={rutaEntrar} style={{ ...botonEnlace, marginTop: '10px' }}>Iniciar sesión</a>}
          {(motivo === 'alerta' || motivo === 'limite') && <a href="/panel/registro?completo=1" style={{ ...botonEnlace, marginTop: '10px' }}>Ir al registro completo</a>}
        </div>
      )}

      <button type="button" onClick={registrar} disabled={registrando} style={{ ...botonPrincipal, opacity: registrando ? 0.7 : 1 }}>
        {registrando ? 'Creando tu cuenta...' : TEXTO_BOTON_LIGERO}
      </button>

      <p style={{ textAlign: 'center', fontSize: '13px', color: '#888', marginTop: '16px' }}>
        ¿Ya tienes cuenta? <a href={rutaEntrar} style={{ color: '#E8720C', fontWeight: 'bold' }}>Iniciar sesión</a>
      </p>
      <p style={{ textAlign: 'center', fontSize: '12px', marginTop: '8px' }}>
        <a href={rutaCompleto} style={{ color: '#888' }}>Prefiero hacer el registro completo</a>
      </p>
    </Marco>
  );
}

function Marco({ children }) {
  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '24px 16px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <img src="/logo-mecanix-solo.webp" alt="Mecanix" style={{ width: '160px', maxWidth: '100%', margin: '0 auto', display: 'block' }} />
        </div>
        {children}
      </div>
    </main>
  );
}

const seccion = { backgroundColor: '#fff', borderRadius: '12px', padding: '16px', marginBottom: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' };
const etiqueta = { display: 'block', fontSize: '13px', color: '#666', marginBottom: '6px' };
const campo = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px', backgroundColor: '#F4F5F5', color: '#333', boxSizing: 'border-box', marginBottom: '12px' };
const botonVer = { position: 'absolute', right: '6px', top: '6px', minHeight: '32px', padding: '0 10px', border: 'none', borderRadius: '6px', background: 'none', color: '#1A3C5E', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' };
const botonPrincipal = { width: '100%', padding: '16px', borderRadius: '10px', border: 'none', backgroundColor: '#E8720C', color: '#fff', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' };
const botonEnlace = { display: 'block', padding: '13px', borderRadius: '10px', backgroundColor: '#1A3C5E', color: '#fff', fontWeight: 'bold', fontSize: '15px', textAlign: 'center', textDecoration: 'none' };
const enlaceDiscreto = { display: 'block', width: '100%', marginTop: '12px', padding: 0, border: 'none', background: 'none', color: '#1A3C5E', fontSize: '13px', textAlign: 'center', textDecoration: 'underline', cursor: 'pointer' };
const cajaError = { backgroundColor: '#FEF0EC', border: '1px solid #F5C6B8', borderRadius: '8px', padding: '12px', marginBottom: '12px' };
