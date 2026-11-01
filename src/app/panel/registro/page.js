'use client';

import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { ESTADO_DEFAULT, cargarEstados } from '../../lib/estados';
import { DECLARACION_COMPLETO, MENSAJE_FALTAN_CASILLAS } from '../../../lib/constanciasLegales';
import { leerTerminosYonkes, versionParaAceptar, crearYonkeConAceptacion } from '../terminosYonke';
import { leerLimitesActivos } from '../../../lib/planes';
import { conFallbackDePermisos } from '../../../lib/conFallbackDePermisos';
import { esIdPedido } from '../../../lib/pedidosClientes';
import { avisarAlAdmin } from '../../lib/avisosAdmin/avisarAlAdmin';
import { useAuth } from '../AuthContext';
import { TEXTO_REGISTRO_ALERTAS } from '../../../lib/alertasRecientes';
import CasillasLegales, { CASILLAS_VACIAS, casillasCompletas } from './CasillasLegales';
import RegistroLigero from './RegistroLigero';

const CIUDADES_BC = [
  { key: 'tijuana', label: 'Tijuana' },
  { key: 'mexicali', label: 'Mexicali' },
  { key: 'ensenada', label: 'Ensenada' },
  { key: 'tecate', label: 'Tecate' },
  { key: 'rosarito', label: 'Playas de Rosarito' },
  { key: 'sanquintin', label: 'San Quintín' },
];


// La dirección no cambia mientras se llena el registro: no hace falta escucharla.
const sinSuscripcion = () => () => {};

// Bandera y alerta para decidir la pantalla. Cualquier falla lleva al registro completo.
async function leerAlertaParaLigero(id) {
  try {
    const config = await getDoc(doc(db, 'config', 'yonkesLigeros'));
    if (!config.exists() || config.data().habilitado !== true) return null;
    const res = await fetch(`/api/pedidos-abiertos?pedido=${id}`);
    const data = await res.json();
    return res.ok && data?.ok && data.pedido ? data.pedido : null;
  } catch (error) {
    console.error('No se pudo revisar el registro ligero', error);
    return null;
  }
}

// Con config/yonkesLigeros.habilitado y una búsqueda activa abierta (?pedido={id}), el registro
// ligero. En cualquier otro caso (apagada, alerta vencida, sin alerta o ?completo=1), el de siempre.
export default function PaginaRegistroYonke() {
  // null en el servidor: se decide en el navegador, sin mostrar un instante el formulario largo.
  const busqueda = useSyncExternalStore(sinSuscripcion, () => window.location.search, () => null);
  const params = busqueda === null ? null : new URLSearchParams(busqueda);
  const pedidoParam = params?.get('pedido');
  const idPedido = esIdPedido(pedidoParam) && params.get('completo') !== '1' ? pedidoParam : null;
  const [alerta, setAlerta] = useState({ id: null, pedido: null });

  useEffect(() => {
    if (!idPedido) return undefined;
    let vigente = true;
    leerAlertaParaLigero(idPedido).then((pedido) => { if (vigente) setAlerta({ id: idPedido, pedido }); });
    return () => { vigente = false; };
  }, [idPedido]);

  if (busqueda === null || (idPedido && alerta.id !== idPedido)) {
    return <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '48px 16px', textAlign: 'center', color: '#555' }}>Cargando...</main>;
  }
  if (idPedido && alerta.pedido) return <RegistroLigero pedido={alerta.pedido} />;
  return <RegistroCompleto />;
}

function RegistroCompleto() {
  const router = useRouter();
  // Para volver a leer la cuenta al terminar: Firebase avisa la sesión nueva antes de que exista
  // usuarios/{uid}, y sin esto el panel no sabría qué yonke es (Pedidos no abriría la alerta).
  const { recargarRol } = useAuth();

  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [estados, setEstados] = useState([{ id: ESTADO_DEFAULT, nombre: 'Baja California' }]);
  const [estado, setEstado] = useState(ESTADO_DEFAULT);
  const [casillas, setCasillas] = useState(CASILLAS_VACIAS);
  // config/planes.limitesActivos: con el interruptor apagado, los textos de siempre ("Plan Gratuito").
  const [limitesPlanes, setLimitesPlanes] = useState(false);
  useEffect(() => {
    let vigente = true;
    leerLimitesActivos(db).then((activos) => { if (vigente) setLimitesPlanes(activos); });
    return () => { vigente = false; };
  }, []);
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

  // Baja California mantiene el selector de CIUDADES_BC de siempre; cualquier otro estado no
  // tiene todavía un catálogo de ciudades, así que se captura como texto libre.
  const esBC = estado === ESTADO_DEFAULT;

  useEffect(() => {
    cargarEstados().then(setEstados);
  }, []);

  // Viene de /pedidos-abiertos (?pedido={id}): se muestra qué pedido va a responder, se
  // preselecciona el estado del pedido (solo los yonkes de ese estado pueden responderlo) y,
  // al terminar, se lleva al yonke directo a responderlo en Pedidos.
  const pedidoId = useRef(null);
  const [pedidoInfo, setPedidoInfo] = useState(null);
  // Viene de la ventana de alertas de la portada o de su botón "Yo la tengo" (?desde=alertas).
  // Se lee de la dirección sin estado propio (en el servidor vale '' y no hay desajuste).
  const busqueda = useSyncExternalStore(sinSuscripcion, () => window.location.search, () => '');
  const desdeAlertas = new URLSearchParams(busqueda).get('desde') === 'alertas';
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('pedido');
    if (!esIdPedido(id)) return;
    pedidoId.current = id;
    fetch(`/api/pedidos-abiertos?pedido=${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data?.ok || !data.pedido) return;
        setPedidoInfo(data.pedido);
        setEstado(data.pedido.estado);
      })
      .catch(() => {});
  }, []);

  async function handleRegistro() {
    setError('');

    const ciudadFinal = esBC ? ciudad : ciudadLibre.trim();
    if (!nombre.trim() || !direccion.trim() || !ciudadFinal || !telefono.trim() || !email.trim() || !password || !confirmarPassword) {
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
    if (!casillasCompletas(casillas)) {
      setError(MENSAJE_FALTAN_CASILLAS);
      return;
    }

    setRegistrando(true);
    try {
      // 0. Versión de los Términos a aceptar: la de config/terminosYonkes si existe (la que exigen
      // las reglas), si no VERSION_LEGAL. Se lee antes de crear la cuenta: si falla, no queda nada a medias.
      const versionAceptada = versionParaAceptar(await leerTerminosYonkes(db));

      // 1. Crear cuenta en Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid = userCredential.user.uid;

      // 2. Crear documento del yonke en Firestore
      const datosYonke = {
        nombre: nombre.trim(),
        direccion: direccion.trim(),
        estado,
        ciudad: ciudadFinal,
        telefono: telefono.trim(),
        whatsapp: whatsapp.trim() || telefono.trim(),
        // El correo NO se guarda aquí (documento público): vive en usuarios/{uid}.
        metodosPago: [],
        plan: 'freemium',
        activo: true,
        fechaRegistro: new Date(),
        // Dueño del yonke: solo este uid podrá crear después su usuario de yonke (reglas de Firestore).
        ownerUid: uid,
      };
      // Aceptación de Términos y Aviso de Privacidad: qué versión y cuándo, con su entrada en el
      // historial (yonkes/{id}/aceptaciones/{versión}) en el mismo guardado. Si las reglas de
      // Firestore aún no conocen el historial, se guarda como antes (solo aceptacionLegal) y, si
      // tampoco ese campo, sin él: el registro no se bloquea mientras se publican las reglas.
      const yonkeRef = await conFallbackDePermisos(
        async () => {
          const ref = doc(collection(db, 'yonkes'));
          await crearYonkeConAceptacion(db, ref, datosYonke, versionAceptada);
          return ref;
        },
        () => conFallbackDePermisos(
          () => addDoc(collection(db, 'yonkes'), { ...datosYonke, aceptacionLegal: { version: versionAceptada, fecha: serverTimestamp() } }),
          () => addDoc(collection(db, 'yonkes'), datosYonke),
          'registro de yonke + aceptacionLegal',
        ),
        'registro de yonke + historial de aceptación',
      );

      // 3. Crear documento del usuario en Firestore
      await setDoc(doc(db, 'usuarios', uid), {
        rol: 'yonke',
        yonkeId: yonkeRef.id,
        email: email.trim(),
        fechaRegistro: new Date(),
      });

      // Notificación por WhatsApp — vía endpoint server-side (nunca expone la API key de
      // CallMeBot en el navegador; ver src/app/lib/notificarAdmin.js). Aquí el yonke ya tiene
      // sesión (crear la cuenta inicia sesión) y su ficha y su usuario ya están guardados: va solo
      // su pase de sesión y el servidor arma el mensaje con lo guardado. Si el aviso falla, el
      // registro sigue igual (avisarAlAdmin nunca lanza).
      await avisarAlAdmin('/api/notificar-registro', { obtenerToken: () => userCredential.user.getIdToken() });

      // Ya con usuarios/{uid} y el yonke guardados: el panel vuelve a leer la cuenta.
      try {
        await recargarRol?.();
      } catch (rolError) {
        console.error('No se pudo volver a leer la cuenta después del registro', rolError);
      }

      if (pedidoId.current) {
        router.replace(`/panel/reservaciones?pedido=${pedidoId.current}`);
        return;
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
            Tu yonke ya está registrado en la plataforma con el {limitesPlanes ? 'Plan Básico' : 'Plan Gratuito'}.
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
            src="/logo-mecanix-solo.webp"
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
            {limitesPlanes ? '🆓 Plan Básico — Sin costo' : '🆓 Plan Gratuito — Completamente gratis'}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#555' }}>
            {limitesPlanes
              ? 'Sube tu inventario con fotos, aparece en búsquedas y atiende reservaciones, pedidos de talleres y búsquedas activas de clientes sin costo.'
              : 'Sube tu inventario y aparece en búsquedas sin costo. Así de simple.'}
          </p>
        </div>

        {desdeAlertas && (
          <p style={{ ...freemiumBannerStyle, margin: '0 0 16px', fontSize: '15px', fontWeight: 'bold', color: '#1A3C5E', textAlign: 'center' }}>
            {TEXTO_REGISTRO_ALERTAS}
          </p>
        )}

        {pedidoInfo && (
          <div style={{ ...freemiumBannerStyle, backgroundColor: '#FFF4E8', borderColor: '#E8720C' }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#1A3C5E', fontWeight: 'bold' }}>
              🙋 Te registras para responder: {pedidoInfo.pieza} · {pedidoInfo.vehiculo.marca} {pedidoInfo.vehiculo.modelo} {pedidoInfo.vehiculo.anio}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#555' }}>
              Es un pedido de {pedidoInfo.estadoNombre}: solo los yonkes de ese estado pueden responderlo. Al terminar tu registro te llevamos directo a responder.
            </p>
          </div>
        )}

        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Información del negocio</h2>

          <p style={labelStyle}>Nombre del yonke *</p>
          <input
            type="text"
            placeholder="Ej. Yonke El Tigre"
            maxLength={100}
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
              maxLength={100}
              value={ciudadLibre}
              onChange={(e) => setCiudadLibre(e.target.value)}
              style={inputStyle}
            />
          )}

          <p style={labelStyle}>Dirección *</p>
          <input
            type="text"
            placeholder="Calle, colonia, referencias"
            maxLength={300}
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            style={inputStyle}
          />

          <p style={labelStyle}>Teléfono *</p>
          <input
            type="tel"
            placeholder="664 000 0000"
            maxLength={40}
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            style={inputStyle}
          />

          <p style={labelStyle}>WhatsApp (opcional — si es diferente al teléfono)</p>
          <input
            type="tel"
            placeholder="664 000 0000"
            maxLength={40}
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            style={inputStyle}
          />
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

        <CasillasLegales valores={casillas} onChange={setCasillas} declaracion={DECLARACION_COMPLETO} />

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
            onClick={() => router.push(pedidoId.current ? `/panel?pedido=${pedidoId.current}` : '/panel')}
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
