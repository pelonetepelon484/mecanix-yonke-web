'use client';

// "Pedidos de clientes": pedidos de pieza de clientes sin cuenta del mismo estado del yonke,
// junto a "Piezas en pedido" (talleres) en Pedidos. Mismo diseño y misma regla de una sola
// respuesta, pero el pedido viene de un "Cliente particular": el yonke nunca ve su WhatsApp,
// el cliente es quien escribe al yonke. Con ?pedido={id} en la dirección (viene del registro o
// de /pedidos-abiertos) se abre ese pedido, o se explica por qué no se puede responder.
// Con config/pedidosClientes.otrosEstados, un yonke activo, Verificado y con envíos nacionales
// ve el interruptor "Ver también alertas de otros estados con envío"; encendido, también ve las
// alertas de otros estados cuyo cliente aceptó envíos. Sin eso, todo queda exactamente igual.
import { useEffect, useRef, useState } from 'react';
import { MENSAJES_RESPUESTA, NOTA_MAX, PRECIO_MAX, validarRespuesta } from '../../lib/solicitudesPiezas';
import { esIdPedido, puedeVerOtrosEstados } from '../../lib/pedidosClientes';
import { leerYonkeEstadoActivo } from './solicitudesPiezasDatos';
import {
  escucharPedidosClientesAbiertos, escucharPedidosClientesOtrosEstados, guardarVerOtrosEstados, leerConfigPedidosClientes,
  responderPedido, yaRespondioPedido,
} from './pedidosClientesDatos';
import { cargarEstados } from '../lib/estados';

function fechaCorta(ts) {
  return ts?.toDate ? ts.toDate().toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '';
}

export const TEXTO_INTERRUPTOR_OTROS_ESTADOS = 'Ver también alertas de otros estados con envío';

export default function PedidosClientesYonke({ yonkeId }) {
  const [config, setConfig] = useState(null);
  const [estadoActivo, setEstadoActivo] = useState(null);
  const [verOtros, setVerOtros] = useState(false);
  const [guardandoOtros, setGuardandoOtros] = useState(false);
  const [nombresEstados, setNombresEstados] = useState({});
  const [abiertos, setAbiertos] = useState([]);
  const [respondidos, setRespondidos] = useState({}); // { [pedidoId]: true }
  const [abierto, setAbierto] = useState(null); // pedido que se está respondiendo
  const [aviso, setAviso] = useState('');
  // ?pedido={id} de la dirección: se resuelve una sola vez, con la primera lista de pedidos.
  const pedidoBuscado = useRef(null);

  const habilitado = config?.habilitado === true;
  const puedeOtros = puedeVerOtrosEstados(config, estadoActivo);
  const conOtros = puedeOtros && verOtros;

  // Sin config/pedidosClientes (función apagada), esta sección no hace NINGUNA otra lectura.
  useEffect(() => {
    if (!yonkeId) return;
    let cancelado = false;
    leerConfigPedidosClientes()
      .then((c) => {
        if (cancelado) return;
        const id = new URLSearchParams(window.location.search).get('pedido');
        pedidoBuscado.current = esIdPedido(id) ? id : null;
        setConfig(c);
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
      setVerOtros(d.verAlertasOtrosEstados === true);
      if (pedidoBuscado.current && (!d.activo || !d.estado)) {
        pedidoBuscado.current = null;
        setAviso('Tu yonke no está activo, por eso todavía no puedes responder pedidos. Escríbenos para revisarlo.');
      }
    });
    return () => { cancelado = true; };
  }, [yonkeId, habilitado]);

  // Nombres de estados para la etiqueta "Desde ..." (solo si puede ver otros estados).
  useEffect(() => {
    if (!puedeOtros) return;
    let cancelado = false;
    cargarEstados()
      .then((lista) => { if (!cancelado) setNombresEstados(Object.fromEntries(lista.map((e) => [e.id, e.nombre]))); })
      .catch(() => {});
    return () => { cancelado = true; };
  }, [puedeOtros]);

  // Alertas de su estado (como siempre) y, con el interruptor encendido, las de otros estados que
  // aceptan envío. Las dos listas se juntan; ?pedido={id} se resuelve cuando llegan las dos.
  useEffect(() => {
    if (!yonkeId || !habilitado || !estadoActivo?.activo || !estadoActivo?.estado) return;
    const estadoYonke = estadoActivo.estado;
    let propias = null;
    let otras = conOtros ? null : [];
    let cancelado = false;

    async function actualizar() {
      if (propias === null || otras === null) return;
      const lista = [...propias, ...otras.filter((p) => p.estado !== estadoYonke).map((p) => ({ ...p, deOtroEstado: true }))];
      const marcas = await Promise.all(lista.map((p) => yaRespondioPedido(p.id, yonkeId)));
      if (cancelado) return;
      const ya = Object.fromEntries(lista.map((p, i) => [p.id, marcas[i] !== null]));
      setRespondidos(ya);
      setAbiertos(lista);

      const id = pedidoBuscado.current;
      if (!id) return;
      pedidoBuscado.current = null;
      const encontrado = lista.find((p) => p.id === id);
      if (!encontrado) explicarPedidoNoDisponible(id, estadoYonke, { puedeOtros, verOtros: conOtros }).then(setAviso);
      else if (ya[id]) setAviso('Ya respondiste este pedido. El cliente ya puede ver tu respuesta.');
      else setAbierto(encontrado);
    }

    const dejarPropias = escucharPedidosClientesAbiertos(estadoYonke, (lista) => { propias = lista; actualizar(); });
    const dejarOtras = conOtros ? escucharPedidosClientesOtrosEstados((lista) => { otras = lista; actualizar(); }) : null;
    return () => { cancelado = true; dejarPropias(); if (dejarOtras) dejarOtras(); };
  }, [yonkeId, habilitado, estadoActivo?.activo, estadoActivo?.estado, conOtros, puedeOtros]);

  async function cambiarVerOtros() {
    const nuevo = !verOtros;
    setGuardandoOtros(true);
    try {
      await guardarVerOtrosEstados(yonkeId, nuevo);
      setVerOtros(nuevo);
    } catch (error) {
      console.error(error);
      setAviso('No se pudo guardar el cambio. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setGuardandoOtros(false);
    }
  }

  const pendientes = abiertos.filter((p) => !respondidos[p.id]);

  if (!habilitado) return null;
  if (!aviso && !puedeOtros && (!estadoActivo?.activo || pendientes.length === 0)) return null;

  return (
    <div style={{ marginBottom: '16px' }}>
      {aviso && (
        <div role="status" style={{ ...seccion, backgroundColor: '#FFF8E1', border: '1px solid #FFD54F' }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#1A3C5E' }}>{aviso}</p>
          <button type="button" onClick={() => setAviso('')} style={{ ...botonResponder, backgroundColor: '#EEF1F5', color: '#333' }}>Entendido</button>
        </div>
      )}

      {puedeOtros && (
        <div style={{ ...seccion, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <p style={{ margin: 0, fontWeight: 'bold', color: '#1A3C5E', fontSize: '14px' }}>📦 {TEXTO_INTERRUPTOR_OTROS_ESTADOS}</p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#666' }}>Solo las de clientes que aceptan envío. Tú acuerdas el envío y el pago con el cliente.</p>
          </div>
          <button
            type="button" role="switch" aria-checked={verOtros} aria-label={TEXTO_INTERRUPTOR_OTROS_ESTADOS}
            onClick={cambiarVerOtros} disabled={guardandoOtros}
            style={{ ...interruptor, backgroundColor: verOtros ? '#2E7D32' : '#BDBDBD', opacity: guardandoOtros ? 0.6 : 1 }}
          >
            <span style={{ ...perilla, left: verOtros ? '22px' : '2px' }} />
          </button>
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
              {p.deOtroEstado && <EtiquetaEnvio estado={nombresEstados[p.estado] || p.estado} />}
              <p style={{ color: '#888', fontSize: '12px', margin: '4px 0 0' }}>Cliente particular · {fechaCorta(p.creadoAt)}</p>
              <button type="button" onClick={() => setAbierto(p)} style={botonResponder}>Responder</button>
            </div>
          ))}
        </div>
      )}

      {abierto && (
        <ModalResponderPedido
          pedido={abierto}
          estadoNombre={abierto.deOtroEstado ? nombresEstados[abierto.estado] || abierto.estado : ''}
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

function EtiquetaEnvio({ estado }) {
  return (
    <p style={{ margin: '6px 0 0' }}>
      <span style={{ display: 'inline-block', backgroundColor: '#E3F2FD', color: '#1565C0', fontSize: '12px', fontWeight: 'bold', padding: '3px 9px', borderRadius: '12px' }}>
        📦 Acepta envío · Desde {estado}
      </span>
    </p>
  );
}

// El pedido no está entre los que ve el yonke: ¿es de otro estado o ya no está?
async function explicarPedidoNoDisponible(id, estadoYonke, { puedeOtros = false, verOtros = false } = {}) {
  try {
    const res = await fetch(`/api/pedidos-abiertos?pedido=${id}`);
    const data = await res.json();
    if (res.ok && data.pedido && data.pedido.estado !== estadoYonke) {
      if (data.pedido.aceptaOtrosEstados && puedeOtros && !verOtros) {
        return `Esta alerta es de ${data.pedido.estadoNombre} y el cliente acepta yonkes de otros estados con envío. Enciende “${TEXTO_INTERRUPTOR_OTROS_ESTADOS}” para responderla.`;
      }
      const estados = await cargarEstados();
      const tuEstado = estados.find((e) => e.id === estadoYonke)?.nombre || estadoYonke;
      return `Este pedido es de ${data.pedido.estadoNombre} y tu yonke está registrado en ${tuEstado}. Solo los yonkes de ${data.pedido.estadoNombre} pueden responderlo.`;
    }
  } catch (error) {
    console.error(error);
  }
  return 'Este pedido ya venció o ya no está disponible.';
}

function ModalResponderPedido({ pedido, estadoNombre = '', onCerrar, onResponder }) {
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
        {estadoNombre && <EtiquetaEnvio estado={estadoNombre} />}
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
const interruptor = { position: 'relative', flexShrink: 0, width: '46px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer', padding: 0 };
const perilla = { position: 'absolute', top: '2px', width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#fff', transition: 'left 0.15s' };
const etiqueta = { display: 'block', fontSize: '13px', color: '#555', marginBottom: '4px', fontWeight: 'bold' };
const inputBase = { width: '100%', boxSizing: 'border-box', padding: '12px', fontSize: '15px', borderRadius: '10px', border: '1px solid #CCC', marginBottom: '10px' };
