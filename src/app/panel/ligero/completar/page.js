'use client';

// "Completar mi registro": el yonke ligero agrega ciudad, dirección y teléfono (y correo, opcional)
// y pasa a yonke completo. Nombre, WhatsApp y estado no se cambian aquí. Lo guarda el servidor.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '../../../lib/firebase';
import { useAuth } from '../../AuthContext';
import { cargarEstados } from '../../../lib/estados';
import { CIUDADES_BC } from '../../../lib/ciudades';
import { leerYonkeEstadoActivo } from '../../solicitudesPiezasDatos';
import { leerConfigPedidosClientes } from '../../pedidosClientesDatos';
import {
  CIUDAD_MAX, CORREO_MAX, DIRECCION_MAX, ESTADO_CON_CIUDADES, MENSAJES_COMPLETAR, RUTA_LIGERO, TELEFONO_MAX, TEXTO_COMPLETAR, validarCompletarRegistro,
} from '../../../../lib/yonkeLigero';

export default function CompletarRegistro() {
  const router = useRouter();
  const { user, yonkeId, loading, esLigero, recargarRol } = useAuth();
  const [yonke, setYonke] = useState(null);
  const [estadoNombre, setEstadoNombre] = useState('');
  const [limite, setLimite] = useState(null);
  const [ciudad, setCiudad] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (loading || listo) return;
    if (!user) router.replace('/panel');
    else if (!esLigero) router.replace('/panel/inventario');
  }, [user, loading, esLigero, listo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!yonkeId) return undefined;
    let vigente = true;
    leerYonkeEstadoActivo(yonkeId).then(async (d) => {
      if (!vigente) return;
      setYonke(d);
      setTelefono(d.whatsapp);
      if (d.estado === ESTADO_CON_CIUDADES) setCiudad(CIUDADES_BC[0].key);
      const estados = await cargarEstados();
      if (vigente) setEstadoNombre(estados.find((e) => e.id === d.estado)?.nombre || d.estado);
    }).catch(console.error);
    leerConfigPedidosClientes().then((c) => { if (vigente) setLimite(c?.limiteRespuestasDiarias ?? null); }).catch(() => {});
    return () => { vigente = false; };
  }, [yonkeId]);

  async function completar() {
    setError('');
    const { error: invalido, datos } = validarCompletarRegistro({ ciudad, direccion, telefono, correo }, yonke.estado);
    if (invalido) {
      setError(invalido);
      return;
    }
    setGuardando(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/yonkes/completar-registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(datos),
      });
      const respuesta = await res.json().catch(() => null);
      if (!res.ok || !respuesta?.ok) {
        setError(respuesta?.mensaje || MENSAJES_COMPLETAR.noDisponible);
        return;
      }
      setListo(true);
      await recargarRol?.();
    } catch (err) {
      console.error(err);
      setError(MENSAJES_COMPLETAR.noDisponible);
    } finally {
      setGuardando(false);
    }
  }

  if (listo) {
    return (
      <Marco>
        <div style={{ ...seccion, textAlign: 'center' }}>
          <p style={{ fontSize: '48px', margin: '0 0 8px' }}>🎉</p>
          <p style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 'bold', color: '#1A3C5E' }}>¡Listo!</p>
          <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#555', lineHeight: '1.5' }}>
            Ya puedes subir tu inventario{limite ? ` y responder hasta ${limite} búsquedas al día` : ''}.
          </p>
          <a href="/panel/inventario" style={botonEnlace}>Ir a mi panel</a>
        </div>
      </Marco>
    );
  }

  if (loading || !esLigero || !yonke) {
    return <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '48px 16px', textAlign: 'center', color: '#555' }}>Cargando...</main>;
  }

  return (
    <Marco>
      <a href={RUTA_LIGERO} style={{ display: 'inline-block', marginBottom: '12px', fontSize: '14px', color: '#1A3C5E' }}>← Regresar</a>
      <h1 style={{ fontSize: '20px', color: '#1A3C5E', margin: '0 0 6px' }}>{TEXTO_COMPLETAR}</h1>
      <p style={{ margin: '0 0 14px', fontSize: '14px', color: '#555', lineHeight: '1.5' }}>
        Con tu registro completo respondes {limite ? `hasta ${limite} búsquedas al día` : 'más búsquedas al día'}, subes tu inventario y apareces en las búsquedas de los clientes.
      </p>

      <div style={seccion}>
        <p style={{ margin: 0, fontSize: '14px', color: '#333' }}><strong>{yonke.nombre}</strong></p>
        <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#666' }}>WhatsApp: {yonke.whatsapp}{estadoNombre ? ` · ${estadoNombre}` : ''}</p>
        <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#888' }}>Para cambiar estos datos, escríbenos.</p>
      </div>

      <div style={seccion}>
        <label htmlFor="completar-ciudad" style={etiqueta}>Ciudad</label>
        {yonke.estado === ESTADO_CON_CIUDADES ? (
          <select id="completar-ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} style={campo}>
            {CIUDADES_BC.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        ) : (
          <input id="completar-ciudad" type="text" maxLength={CIUDAD_MAX} value={ciudad} onChange={(e) => setCiudad(e.target.value)} style={campo} />
        )}
        <label htmlFor="completar-direccion" style={etiqueta}>Dirección</label>
        <input id="completar-direccion" type="text" autoComplete="street-address" placeholder="Calle, colonia, referencias" maxLength={DIRECCION_MAX} value={direccion} onChange={(e) => setDireccion(e.target.value)} style={campo} />
        <label htmlFor="completar-telefono" style={etiqueta}>Teléfono</label>
        <input id="completar-telefono" type="tel" autoComplete="tel" maxLength={TELEFONO_MAX} value={telefono} onChange={(e) => setTelefono(e.target.value)} style={campo} />
        <label htmlFor="completar-correo" style={etiqueta}>Correo (opcional)</label>
        <input id="completar-correo" type="email" autoComplete="email" maxLength={CORREO_MAX} value={correo} onChange={(e) => setCorreo(e.target.value)} style={campo} />
        <p style={{ margin: '-6px 0 0', fontSize: '12px', color: '#888' }}>Solo para contactarte. Sigues entrando con tu WhatsApp.</p>
      </div>

      {error && <p role="alert" style={{ backgroundColor: '#FEF0EC', border: '1px solid #F5C6B8', borderRadius: '8px', padding: '12px', margin: '0 0 12px', fontSize: '13px', color: '#D85A30' }}>{error}</p>}

      <button type="button" onClick={completar} disabled={guardando} style={{ width: '100%', padding: '16px', borderRadius: '10px', border: 'none', backgroundColor: '#E8720C', color: '#fff', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', opacity: guardando ? 0.7 : 1 }}>
        {guardando ? 'Guardando...' : TEXTO_COMPLETAR}
      </button>
    </Marco>
  );
}

function Marco({ children }) {
  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '20px 16px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>{children}</div>
    </main>
  );
}

const seccion = { backgroundColor: '#fff', borderRadius: '12px', padding: '16px', marginBottom: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' };
const etiqueta = { display: 'block', fontSize: '13px', color: '#666', marginBottom: '6px' };
const campo = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px', backgroundColor: '#F4F5F5', color: '#333', boxSizing: 'border-box', marginBottom: '12px' };
const botonEnlace = { display: 'block', padding: '14px', borderRadius: '10px', backgroundColor: '#E8720C', color: '#fff', fontWeight: 'bold', fontSize: '15px', textAlign: 'center', textDecoration: 'none' };
