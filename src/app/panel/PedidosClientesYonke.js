'use client';

// "Pedidos de clientes": pedidos de pieza de clientes sin cuenta del mismo estado del yonke,
// junto a "Piezas en pedido" (talleres) en Pedidos. Mismo diseño y misma regla de una sola
// respuesta, pero el pedido viene de un "Cliente particular": el yonke nunca ve su WhatsApp,
// el cliente es quien escribe al yonke. Con ?pedido={id} en la dirección (viene del registro o
// de /pedidos-abiertos) se abre ese pedido, o se explica por qué no se puede responder.
import { useEffect, useRef, useState } from 'react';
import { MENSAJES_RESPUESTA, NOTA_MAX, PRECIO_MAX, validarRespuesta } from '../../lib/solicitudesPiezas';
import { esIdPedido } from '../../lib/pedidosClientes';
import { leerYonkeEstadoActivo } from './solicitudesPiezasDatos';
import { escucharPedidosClientesAbiertos, leerConfigPedidosClientes, responderPedido, yaRespondioPedido } from './pedidosClientesDatos';
import { cargarEstados } from '../lib/estados';

function fechaCorta(ts) {
  return ts?.toDate ? ts.toDate().toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '';
}

export default function PedidosClientesYonke({ yonkeId }) {
  const [habilitado, setHabilitado] = useState(false);
  const [estadoActivo, setEstadoActivo] = useState(null);
  const [abiertos, setAbiertos] = useState([]);
  const [respondidos, setRespondidos] = useState({}); // { [pedidoId]: true }
  const [abierto, setAbierto] = useState(null); // pedido que se está respondiendo
  const [aviso, setAviso] = useState('');
  // ?pedido={id} de la dirección: se resuelve una sola vez, con la primera lista de pedidos.
  const pedidoBuscado = useRef(null);

  // Sin config/pedidosClientes (función apagada), esta sección no hace NINGUNA otra lectura.
  useEffect(() => {
    if (!yonkeId) return;
    let cancelado = false;
    leerConfigPedidosClientes()
      .then((config) => {
        if (cancelado) return;
        const id = new URLSearchParams(window.location.search).get('pedido');
        pedidoBuscado.current = esIdPedido(id) ? id : null;
        setHabilitado(config?.habilitado === true);
      })
      .catch(() => {});
    return () => { cancelado = true; };
  }, [yonkeId]);

  useEffect(() => {
    if (!yonkeId || !habilitado) return;
    let cancelado = false;
    leerYonkeEstadoActivo(yonkeId).then((d) => {
      if (cancelado) return;
      setEstadoActivo(d);
      if (pedidoBuscado.current && (!d.activo || !d.estado)) {
        pedidoBuscado.current = null;
        setAviso('Tu yonke no está activo, por eso todavía no puedes responder pedidos. Escríbenos para revisarlo.');
      }
    });
    return () => { cancelado = true; };
  }, [yonkeId, habilitado]);

  useEffect(() => {
    if (!yonkeId || !habilitado || !estadoActivo?.activo || !estadoActivo?.estado) return;
    const estadoYonke = estadoActivo.estado;
    return escucharPedidosClientesAbiertos(estadoYonke, async (lista) => {
      const marcas = await Promise.all(lista.map((p) => yaRespondioPedido(p.id, yonkeId)));
      const ya = Object.fromEntries(lista.map((p, i) => [p.id, marcas[i] !== null]));
      setRespondidos(ya);
      setAbiertos(lista);

      const id = pedidoBuscado.current;
      if (!id) return;
      pedidoBuscado.current = null;
      const encontrado = lista.find((p) => p.id === id);
      if (!encontrado) explicarPedidoNoDisponible(id, estadoYonke).then(setAviso);
      else if (ya[id]) setAviso('Ya respondiste este pedido. El cliente ya puede ver tu respuesta.');
      else setAbierto(encontrado);
    });
  }, [yonkeId, habilitado, estadoActivo?.activo, estadoActivo?.estado]);

  const pendientes = abiertos.filter((p) => !respondidos[p.id]);

  if (!habilitado) return null;
  if (!aviso && (!estadoActivo?.activo || pendientes.length === 0)) return null;

  return (
    <div style={{ marginBottom: '16px' }}>
      {aviso && (
        <div role="status" style={{ ...seccion, backgroundColor: '#FFF8E1', border: '1px solid #FFD54F' }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#1A3C5E' }}>{aviso}</p>
          <button type="button" onClick={() => setAviso('')} style={{ ...botonResponder, backgroundColor: '#EEF1F5', color: '#333' }}>Entendido</button>
        </div>
      )}

      {estadoActivo?.activo && pendientes.length > 0 && (
        <div style={seccion}>
          <p style={titulo}>🙋 Pedidos de clientes ({pendientes.length})</p>
          {pendientes.map((p) => (
            <div key={p.id} style={tarjeta}>
              <p style={{ fontWeight: 'bold', color: '#1A3C5E', margin: 0 }}>{p.pieza}</p>
              <p style={{ color: '#666', fontSize: '13px', margin: '2px 0 0' }}>
                {p.vehiculo?.marca} {p.vehiculo?.modelo} {p.vehiculo?.anio}
              </p>
              <p style={{ color: '#888', fontSize: '12px', margin: '4px 0 0' }}>Cliente particular · {fechaCorta(p.creadoAt)}</p>
              <button type="button" onClick={() => setAbierto(p)} style={botonResponder}>Responder</button>
            </div>
          ))}
        </div>
      )}

      {abierto && (
        <ModalResponderPedido
          pedido={abierto}
          onCerrar={() => setAbierto(null)}
          onResponder={async (datos) => {
            await responderPedido(abierto, yonkeId, { yonkeNombre: estadoActivo.nombre, whatsapp: estadoActivo.whatsapp, ...datos });
            setRespondidos((prev) => ({ ...prev, [abierto.id]: true }));
            setAbierto(null);
          }}
        />
      )}
    </div>
  );
}

// El pedido no está entre los abiertos del estado del yonke: ¿es de otro estado o ya no está?
async function explicarPedidoNoDisponible(id, estadoYonke) {
  try {
    const res = await fetch(`/api/pedidos-abiertos?pedido=${id}`);
    const data = await res.json();
    if (res.ok && data.pedido && data.pedido.estado !== estadoYonke) {
      const estados = await cargarEstados();
      const tuEstado = estados.find((e) => e.id === estadoYonke)?.nombre || estadoYonke;
      return `Este pedido es de ${data.pedido.estadoNombre} y tu yonke está registrado en ${tuEstado}. Solo los yonkes de ${data.pedido.estadoNombre} pueden responderlo.`;
    }
  } catch (error) {
    console.error(error);
  }
  return 'Este pedido ya venció o ya no está disponible.';
}

function ModalResponderPedido({ pedido, onCerrar, onResponder }) {
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
        <p style={{ fontWeight: 'bold', color: '#1A3C5E', margin: '0 0 4px' }}>{pedido.pieza}</p>
        <p style={{ color: '#666', fontSize: '13px', margin: '0 0 6px' }}>
          {pedido.vehiculo?.marca} {pedido.vehiculo?.modelo} {pedido.vehiculo?.anio} · Cliente particular
        </p>
        <p style={{ color: '#888', fontSize: '12px', margin: '0 0 14px' }}>
          El cliente verá tu nombre, tu precio, tu nota y tu WhatsApp, y te escribirá si le interesa. Solo puedes responder una vez.
        </p>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button type="button" onClick={() => setTieneLaPieza(true)} style={{ ...botonToggle, flex: 1, backgroundColor: tieneLaPieza ? '#1A3C5E' : '#EEF1F5', color: tieneLaPieza ? '#fff' : '#333' }}>
            La tengo
          </button>
          <button type="button" onClick={() => setTieneLaPieza(false)} style={{ ...botonToggle, flex: 1, backgroundColor: !tieneLaPieza ? '#1A3C5E' : '#EEF1F5', color: !tieneLaPieza ? '#fff' : '#333' }}>
            No la tengo
          </button>
        </div>

        {tieneLaPieza && (
          <>
            <label style={etiqueta}>Precio ($)</label>
            <input type="number" inputMode="decimal" min="0" max={PRECIO_MAX} value={precio} onChange={(e) => setPrecio(e.target.value)} style={inputBase} />
          </>
        )}
        <label style={etiqueta}>Nota corta (opcional)</label>
        <input value={nota} maxLength={NOTA_MAX} onChange={(e) => setNota(e.target.value)} placeholder="Ej. Original, con garantía de 30 días" style={inputBase} />

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
