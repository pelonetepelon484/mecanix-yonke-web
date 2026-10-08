'use client';

// "Piezas en pedido": solicitudes abiertas de talleres de tu mismo estado, arriba de Pedidos.
// Responder es definitivo (la regla lo impide una segunda vez), por eso se confirma antes de enviar.
import { useEffect, useState } from 'react';
import { MENSAJES_RESPUESTA, PRECIO_MAX, validarRespuesta } from '../../lib/solicitudesPiezas';
import {
  escucharSolicitudesAbiertas, escucharSolicitudesGanadas, leerConfigSolicitudesPiezas, leerContactoTaller, leerYonkeEstadoActivo, responder, yaRespondio,
} from './solicitudesPiezasDatos';

export default function SolicitudesPiezasYonke({ yonkeId }) {
  const [habilitado, setHabilitado] = useState(false);
  const [estadoActivo, setEstadoActivo] = useState(null);
  const [abiertas, setAbiertas] = useState([]);
  const [respondidas, setRespondidas] = useState({}); // { [solicitudId]: true }
  const [ganadas, setGanadas] = useState([]);
  const [contactos, setContactos] = useState({}); // { [solicitudId]: whatsapp del taller }
  const [abierta, setAbierta] = useState(null); // solicitud que se está respondiendo

  // Sin config/solicitudesPiezas (función apagada), esta pantalla no hace NINGUNA otra lectura
  // de Firestore de este módulo: ni el documento del yonke, ni los listeners de abajo.
  useEffect(() => {
    if (!yonkeId) return;
    let cancelado = false;
    leerConfigSolicitudesPiezas().then((config) => { if (!cancelado) setHabilitado(config?.habilitado === true); });
    return () => { cancelado = true; };
  }, [yonkeId]);

  useEffect(() => {
    if (!yonkeId || !habilitado) return;
    let cancelado = false;
    leerYonkeEstadoActivo(yonkeId).then((d) => { if (!cancelado) setEstadoActivo(d); });
    return () => { cancelado = true; };
  }, [yonkeId, habilitado]);

  useEffect(() => {
    if (!yonkeId || !habilitado || !estadoActivo?.activo || !estadoActivo?.estado) return;
    const dejarAbiertas = escucharSolicitudesAbiertas(estadoActivo.estado, async (lista) => {
      setAbiertas(lista);
      const marcas = await Promise.all(lista.map((s) => yaRespondio(s.id, yonkeId)));
      setRespondidas(Object.fromEntries(lista.map((s, i) => [s.id, marcas[i] !== null])));
    });
    const dejarGanadas = escucharSolicitudesGanadas(yonkeId, async (lista) => {
      setGanadas(lista);
      const faltan = lista.filter((s) => !(s.id in contactos));
      if (faltan.length === 0) return;
      const pares = await Promise.all(faltan.map(async (s) => [s.id, await leerContactoTaller(s.id)]));
      setContactos((prev) => ({ ...prev, ...Object.fromEntries(pares) }));
    });
    return () => { dejarAbiertas(); dejarGanadas(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yonkeId, habilitado, estadoActivo?.activo, estadoActivo?.estado]);

  const pendientes = abiertas.filter((s) => !respondidas[s.id]);

  if (!habilitado || !estadoActivo?.activo) return null;
  if (pendientes.length === 0 && ganadas.length === 0) return null;

  return (
    <div style={{ marginBottom: '16px' }}>
      {pendientes.length > 0 && (
        <div style={seccion}>
          <p style={titulo}>🔧 Piezas en pedido ({pendientes.length})</p>
          {pendientes.map((s) => (
            <div key={s.id} style={tarjeta}>
              <p style={{ fontWeight: 'bold', color: '#1A3C5E', margin: 0 }}>{s.pieza}</p>
              <p style={{ color: '#666', fontSize: '13px', margin: '2px 0 0' }}>
                {s.vehiculo?.marca} {s.vehiculo?.modelo} {s.vehiculo?.anio}
              </p>
              <p style={{ color: '#888', fontSize: '12px', margin: '4px 0 0' }}>Taller: {s.tallerNombre}</p>
              {s.nota && <p style={{ color: '#888', fontSize: '12px', margin: '2px 0 0' }}>Nota: {s.nota}</p>}
              <button type="button" onClick={() => setAbierta(s)} style={botonResponder}>Responder</button>
            </div>
          ))}
        </div>
      )}

      {ganadas.length > 0 && (
        <div style={seccion}>
          <p style={titulo}>🎉 Te eligieron</p>
          {ganadas.map((s) => (
            <div key={s.id} style={tarjeta}>
              <p style={{ fontWeight: 'bold', color: '#1A3C5E', margin: 0 }}>{s.pieza}</p>
              <p style={{ color: '#666', fontSize: '13px', margin: '2px 0 0' }}>
                {s.vehiculo?.marca} {s.vehiculo?.modelo} {s.vehiculo?.anio}
              </p>
              <p style={{ color: '#2E7D32', fontSize: '13px', fontWeight: 'bold', margin: '6px 0 0' }}>
                {s.tallerNombre}: {contactos[s.id] ? `WhatsApp ${contactos[s.id]}` : 'cargando WhatsApp...'}
              </p>
            </div>
          ))}
        </div>
      )}

      {abierta && (
        <ModalResponder
          solicitud={abierta}
          onCerrar={() => setAbierta(null)}
          onResponder={async (datos) => {
            await responder(abierta.id, yonkeId, { yonkeNombre: estadoActivo.nombre, whatsapp: estadoActivo.whatsapp, ...datos });
            setRespondidas((prev) => ({ ...prev, [abierta.id]: true }));
            setAbierta(null);
          }}
        />
      )}
    </div>
  );
}

function ModalResponder({ solicitud, onCerrar, onResponder }) {
  const [tieneLaPieza, setTieneLaPieza] = useState(true);
  const [precio, setPrecio] = useState('');
  const [nota, setNota] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    const datos = { tieneLaPieza, precio: precio.trim() === '' ? Number.NaN : Number(precio), nota: nota.trim() };
    const problema = validarRespuesta(datos);
    if (problema) { setError(problema); return; }
    setEnviando(true);
    try {
      await onResponder(datos);
    } catch (err) {
      console.error(err);
      setError(MENSAJES_RESPUESTA.enviarFallo);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div role="dialog" style={fondoModal}>
      <div style={cajaModal}>
        <p style={{ fontWeight: 'bold', color: '#1A3C5E', margin: '0 0 4px' }}>{solicitud.pieza}</p>
        <p style={{ color: '#666', fontSize: '13px', margin: '0 0 14px' }}>
          {solicitud.vehiculo?.marca} {solicitud.vehiculo?.modelo} {solicitud.vehiculo?.anio} · {solicitud.tallerNombre}
        </p>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button type="button" onClick={() => setTieneLaPieza(true)} style={{ ...botonToggle, backgroundColor: tieneLaPieza ? '#1A3C5E' : '#EEF1F5', color: tieneLaPieza ? '#fff' : '#333' }}>
            La tengo
          </button>
          <button type="button" onClick={() => setTieneLaPieza(false)} style={{ ...botonToggle, backgroundColor: !tieneLaPieza ? '#1A3C5E' : '#EEF1F5', color: !tieneLaPieza ? '#fff' : '#333' }}>
            No la tengo
          </button>
        </div>

        {tieneLaPieza && (
          <>
            <label style={etiqueta}>Precio ($)</label>
            <input type="number" inputMode="decimal" min="0" max={PRECIO_MAX} value={precio} onChange={(e) => setPrecio(e.target.value)} style={inputBase} />
          </>
        )}
        <label style={etiqueta}>Nota (opcional)</label>
        <input value={nota} onChange={(e) => setNota(e.target.value)} style={inputBase} />

        {error && <p role="alert" style={{ color: '#B3261E', fontSize: '13px', margin: '0 0 10px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
          <button type="button" onClick={onCerrar} style={{ ...botonToggle, flex: 1, backgroundColor: '#EEF1F5', color: '#333' }}>Cancelar</button>
          <button type="button" onClick={enviar} disabled={enviando} style={{ ...botonToggle, flex: 1, backgroundColor: '#E8720C', color: '#fff', opacity: enviando ? 0.6 : 1 }}>
            {enviando ? 'Enviando...' : 'Enviar respuesta'}
          </button>
        </div>
      </div>
    </div>
  );
}

const seccion = { backgroundColor: '#fff', borderRadius: '14px', padding: '14px', marginBottom: '12px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' };
const titulo = { margin: '0 0 10px', fontWeight: 'bold', color: '#1A3C5E' };
const tarjeta = { border: '1px solid #EEE', borderRadius: '12px', padding: '12px', marginBottom: '10px' };
const botonResponder = { marginTop: '10px', minHeight: '40px', padding: '0 16px', borderRadius: '10px', border: 'none', backgroundColor: '#E8720C', color: '#fff', fontWeight: 'bold', cursor: 'pointer' };
const fondoModal = { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 1000 };
const cajaModal = { backgroundColor: '#fff', borderRadius: '16px', padding: '20px', width: '100%', maxWidth: '360px' };
const botonToggle = { minHeight: '44px', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer' };
const etiqueta = { display: 'block', fontSize: '13px', color: '#555', marginBottom: '4px', fontWeight: 'bold' };
const inputBase = { width: '100%', boxSizing: 'border-box', padding: '12px', fontSize: '15px', borderRadius: '10px', border: '1px solid #CCC', marginBottom: '10px' };
