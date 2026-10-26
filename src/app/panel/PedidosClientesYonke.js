'use client';

// "Pedidos de clientes": pedidos de pieza de clientes sin cuenta del mismo estado del yonke,
// junto a "Piezas en pedido" (talleres) en Pedidos. Mismo diseño y misma regla de una sola
// respuesta, pero el pedido viene de un "Cliente particular": el yonke nunca ve su WhatsApp,
// el cliente es quien escribe al yonke. Con ?pedido={id} en la dirección (viene del registro o
// de /pedidos-abiertos) se abre ese pedido, o se explica por qué no se puede responder.
// Con config/pedidosClientes.otrosEstados, un yonke activo, Verificado y con envíos nacionales
// ve el interruptor "Ver también alertas de otros estados con envío"; encendido, también ve las
// alertas de otros estados cuyo cliente aceptó envíos. Sin eso, todo queda exactamente igual.
// Con config/pedidosClientes.limiteRespuestasDiarias, el plan Básico responde hasta ese número de
// alertas por día (día de Tijuana); al llegar sigue viéndolas pero no puede responder. Con
// config/pedidosClientes.inventarioVehiculos, tras "La tengo" se pregunta si tiene el vehículo
// completo (ver VehiculosCompletosYonke y lib/vehiculosAlerta.ts).
import { useEffect, useRef, useState } from 'react';
import { MENSAJES_RESPUESTA, NOTA_MAX, PRECIO_MAX, validarRespuesta } from '../../lib/solicitudesPiezas';
import { esIdPedido, puedeVerOtrosEstados } from '../../lib/pedidosClientes';
import { leerYonkeEstadoActivo } from './solicitudesPiezasDatos';
import {
  descontarPiezaDePedido, escucharPedidosClientesAbiertos, escucharPedidosClientesOtrosEstados, guardarVehiculoCompleto, guardarVerOtrosEstados,
  leerConfigPedidosClientes, leerRespuestasHoy, leerVehiculoAlertaDePedido, responderPedido, sumarUnidadDePedido, yaRespondioPedido,
} from './pedidosClientesDatos';
import {
  MENSAJES_VEHICULO_ALERTA, despuesDeLaTengo, inventarioVehiculosActivo, limiteRespuestasDiarias, llegoAlLimite,
} from '../../lib/vehiculosAlerta';
import { BotonQuieroPremium } from './CandadoPremium';
import { cargarEstados } from '../lib/estados';
import { useAuth } from './AuthContext';
import { MensajeBloqueoTerminos } from './BloqueoTerminos';

function fechaCorta(ts) {
  return ts?.toDate ? ts.toDate().toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '';
}

// Solo pasa si el admin lo desactivó: un yonke nace activo al registrarse.
export const TEXTO_YONKE_DESACTIVADO = 'Tu yonke está desactivado. Escríbenos para revisarlo.';

export const TEXTO_INTERRUPTOR_OTROS_ESTADOS = 'Ver también alertas de otros estados con envío';

export default function PedidosClientesYonke({ yonkeId }) {
  // Sin términos vigentes el interruptor se ve pero no se cambia; responder alertas sí se puede.
  const { puedeEditarYonke, premiumVigente } = useAuth();
  const sinTerminos = puedeEditarYonke === false;
  const [config, setConfig] = useState(null);
  const [estadoActivo, setEstadoActivo] = useState(null);
  const [verOtros, setVerOtros] = useState(false);
  const [guardandoOtros, setGuardandoOtros] = useState(false);
  const [nombresEstados, setNombresEstados] = useState({});
  const [abiertos, setAbiertos] = useState([]);
  const [respondidos, setRespondidos] = useState({}); // { [pedidoId]: true }
  const [abierto, setAbierto] = useState(null); // pedido que se está respondiendo
  const [aviso, setAviso] = useState('');
  const [respuestasHoy, setRespuestasHoy] = useState(0);
  const [preguntaVehiculo, setPreguntaVehiculo] = useState(null); // pedido tras "La tengo"
  const [preguntaOtroIgual, setPreguntaOtroIgual] = useState(null); // { pedido, vendidas, unidades }
  // ?pedido={id} de la dirección: se resuelve una sola vez, con la primera lista de pedidos.
  const pedidoBuscado = useRef(null);

  const habilitado = config?.habilitado === true;
  const puedeOtros = puedeVerOtrosEstados(config, estadoActivo);
  const conOtros = puedeOtros && verOtros;
  // Límite diario: solo plan Básico y solo si config/pedidosClientes.limiteRespuestasDiarias existe.
  const limite = premiumVigente ? null : limiteRespuestasDiarias(config);
  const sinRespuestasHoy = llegoAlLimite(respuestasHoy, limite, premiumVigente);
  const conInventario = inventarioVehiculosActivo(config);

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
        setAviso(TEXTO_YONKE_DESACTIVADO);
      }
    });
    return () => { cancelado = true; };
  }, [yonkeId, habilitado]);

  // Respuestas de hoy (solo con límite): para avisar antes de que intente responder.
  useEffect(() => {
    if (!yonkeId || !habilitado || limite === null) return;
    let cancelado = false;
    leerRespuestasHoy(yonkeId).then((n) => { if (!cancelado) setRespuestasHoy(n); }).catch(() => {});
    return () => { cancelado = true; };
  }, [yonkeId, habilitado, limite]);

  // Tras responder "La tengo" con el inventario encendido: si ya tiene el vehículo vigente, la
  // pieza se descuenta sola; si no (o venció), se pregunta si tiene el vehículo completo.
  async function despuesDeResponder(pedido) {
    try {
      const existente = await leerVehiculoAlertaDePedido(yonkeId, pedido);
      if (despuesDeLaTengo(existente, new Date()) === 'descontarPieza') {
        const agotada = await descontarPiezaDePedido(yonkeId, pedido);
        // Ya vendida en todas las unidades: no se suma otra venta; se pregunta si tiene otro igual.
        if (agotada) setPreguntaOtroIgual({ pedido, vendidas: agotada.vendidas, unidades: agotada.unidades });
        else setAviso(MENSAJES_VEHICULO_ALERTA.piezaDescontada);
      } else {
        setPreguntaVehiculo(pedido);
      }
    } catch (error) {
      console.error(error);
    }
  }

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
      if (!encontrado) {
        explicarPedidoNoDisponible(id, estadoYonke, {
          puedeOtros, verOtros: conOtros, alertasPortada: config?.alertasPortada === true,
          alertasPortadaTodos: config?.alertasPortadaTodos === true,
          yonke: { verificado: estadoActivo?.verificado === true, enviosNacionales: estadoActivo?.enviosNacionales === true },
        }).then(setAviso);
      }
      else if (ya[id]) setAviso('Ya respondiste este pedido. El cliente ya puede ver tu respuesta.');
      else setAbierto(encontrado);
    }

    const dejarPropias = escucharPedidosClientesAbiertos(estadoYonke, (lista) => { propias = lista; actualizar(); });
    const dejarOtras = conOtros ? escucharPedidosClientesOtrosEstados((lista) => { otras = lista; actualizar(); }) : null;
    return () => { cancelado = true; dejarPropias(); if (dejarOtras) dejarOtras(); };
  }, [yonkeId, habilitado, estadoActivo?.activo, estadoActivo?.estado, estadoActivo?.verificado, estadoActivo?.enviosNacionales,
    conOtros, puedeOtros, config?.alertasPortada, config?.alertasPortadaTodos]);

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
  if (!aviso && !preguntaVehiculo && !preguntaOtroIgual && !puedeOtros && (!estadoActivo?.activo || pendientes.length === 0)) return null;

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
            onClick={cambiarVerOtros} disabled={guardandoOtros || sinTerminos}
            style={{ ...interruptor, backgroundColor: verOtros ? '#2E7D32' : '#BDBDBD', opacity: guardandoOtros || sinTerminos ? 0.6 : 1 }}
          >
            <span style={{ ...perilla, left: verOtros ? '22px' : '2px' }} />
          </button>
        </div>
      )}
      {puedeOtros && sinTerminos && <MensajeBloqueoTerminos />}

      {estadoActivo?.activo && pendientes.length > 0 && (
        <div style={seccion}>
          <p style={titulo}>🙋 Pedidos de clientes ({pendientes.length})</p>
          {sinRespuestasHoy && (
            <div role="note" style={avisoLimite}>
              <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#1A3C5E', fontWeight: 'bold' }}>{MENSAJES_VEHICULO_ALERTA.limiteAlcanzado}</p>
              <BotonQuieroPremium ubicacion="limite_respuestas_alertas" compacto />
            </div>
          )}
          {pendientes.map((p) => (
            <div key={p.id} style={tarjeta}>
              <p style={{ fontWeight: 'bold', color: '#1A3C5E', margin: 0 }}>{p.pieza}</p>
              <p style={{ color: '#666', fontSize: '13px', margin: '2px 0 0' }}>
                {p.vehiculo?.marca} {p.vehiculo?.modelo} {p.vehiculo?.anio}
              </p>
              {p.deOtroEstado && <EtiquetaEnvio estado={nombresEstados[p.estado] || p.estado} />}
              <p style={{ color: '#888', fontSize: '12px', margin: '4px 0 0' }}>Cliente particular · {fechaCorta(p.creadoAt)}</p>
              <button
                type="button" onClick={() => setAbierto(p)} disabled={sinRespuestasHoy}
                style={{ ...botonResponder, ...(sinRespuestasHoy ? { backgroundColor: '#BDBDBD', cursor: 'default' } : {}) }}
              >
                Responder
              </button>
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
            try {
              const respuesta = { yonkeNombre: estadoActivo.nombre, whatsapp: estadoActivo.whatsapp, ...datos };
              // Sin límite, la misma llamada de siempre.
              if (limite === null) await responderPedido(abierto, yonkeId, respuesta);
              else await responderPedido(abierto, yonkeId, respuesta, { limite });
            } catch (error) {
              if (error?.codigo === 'limite') {
                setRespuestasHoy(limite);
                setAbierto(null);
              }
              throw error;
            }
            const pedido = abierto;
            setRespondidos((prev) => ({ ...prev, [pedido.id]: true }));
            if (limite !== null) setRespuestasHoy((n) => n + 1);
            setAbierto(null);
            if (conInventario && datos.tieneLaPieza) despuesDeResponder(pedido);
          }}
        />
      )}

      {preguntaVehiculo && (
        <ModalVehiculoCompleto
          pedido={preguntaVehiculo}
          onNo={() => setPreguntaVehiculo(null)}
          onSi={async () => {
            const accion = await guardarVehiculoCompleto(yonkeId, preguntaVehiculo);
            setPreguntaVehiculo(null);
            setAviso(accion === 'renovar' ? MENSAJES_VEHICULO_ALERTA.renovado
              : accion === 'crear' ? MENSAJES_VEHICULO_ALERTA.guardado : MENSAJES_VEHICULO_ALERTA.piezaDescontada);
          }}
        />
      )}

      {preguntaOtroIgual && (
        <ModalOtroIgual
          {...preguntaOtroIgual}
          onNo={() => setPreguntaOtroIgual(null)}
          onSi={async () => {
            await sumarUnidadDePedido(yonkeId, preguntaOtroIgual.pedido);
            setPreguntaOtroIgual(null);
            setAviso(MENSAJES_VEHICULO_ALERTA.otroIgualSumado);
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
export const TEXTO_SOLO_VERIFICADOS_CON_ENVIO = 'Esta alerta solo la pueden contestar yonkes Verificados con Envíos nacionales.';

// Con config/pedidosClientes.alertasPortadaTodos: qué le falta al yonke para contestar una alerta de
// otro estado. Verificado y Envíos nacionales los pone el admin (el yonke no puede activarlos), por
// eso los dos mensajes piden escribirnos.
export const TEXTO_FALTA_VERIFICADO = 'Esta alerta es de otro estado. Para contestarla necesitas la insignia Verificado. Escríbenos para verificar tu yonke.';
export const TEXTO_FALTA_ENVIOS = 'Esta alerta es de otro estado. Para contestarla, tu yonke necesita la insignia Envíos nacionales. Escríbenos para activarla.';
export const TEXTO_FALTAN_AMBOS = 'Esta alerta es de otro estado. Para contestarla tu yonke necesita las insignias Verificado y Envíos nacionales. Escríbenos para activarlas.';
export function textoQueLeFalta(yonke) {
  const verificado = yonke?.verificado === true;
  const envios = yonke?.enviosNacionales === true;
  if (!verificado && !envios) return TEXTO_FALTAN_AMBOS;
  if (!verificado) return TEXTO_FALTA_VERIFICADO;
  if (!envios) return TEXTO_FALTA_ENVIOS;
  return null; // tiene las dos: lo que falta es otra cosa (mensaje general)
}

async function explicarPedidoNoDisponible(id, estadoYonke, {
  puedeOtros = false, verOtros = false, alertasPortada = false, alertasPortadaTodos = false, yonke = null,
} = {}) {
  try {
    const res = await fetch(`/api/pedidos-abiertos?pedido=${id}`);
    const data = await res.json();
    if (res.ok && data.pedido && data.pedido.estado !== estadoYonke) {
      if (data.pedido.aceptaOtrosEstados && puedeOtros && !verOtros) {
        return `Esta alerta es de ${data.pedido.estadoNombre} y el cliente acepta yonkes de otros estados con envío. Enciende “${TEXTO_INTERRUPTOR_OTROS_ESTADOS}” para responderla.`;
      }
      // Enlace directo (p. ej. desde la portada) a una alerta de otro estado que acepta envíos,
      // abierto por un yonke que no es Verificado con Envíos nacionales (con alertasPortada).
      if (data.pedido.aceptaOtrosEstados && !puedeOtros && alertasPortadaTodos) {
        const falta = textoQueLeFalta(yonke);
        if (falta) return falta;
      }
      if (data.pedido.aceptaOtrosEstados && !puedeOtros && alertasPortada) return TEXTO_SOLO_VERIFICADOS_CON_ENVIO;
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
      setError(err?.codigo === 'limite' ? err.message : MENSAJES_RESPUESTA.enviarFallo);
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

// Segunda pregunta tras "La tengo": ¿tiene el vehículo completo? Sí lo guarda 30 días en su
// inventario; No solo cierra (su respuesta a la alerta ya quedó guardada).
function ModalVehiculoCompleto({ pedido, onSi, onNo }) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function si() {
    setGuardando(true);
    setError('');
    try {
      await onSi();
    } catch (err) {
      console.error(err);
      setError(MENSAJES_VEHICULO_ALERTA.guardarFallo);
      setGuardando(false);
    }
  }

  return (
    <div role="dialog" style={fondoModal}>
      <div style={cajaModal}>
        <p style={{ fontWeight: 'bold', color: '#1A3C5E', margin: '0 0 4px', fontSize: '17px' }}>{MENSAJES_VEHICULO_ALERTA.preguntaVehiculo}</p>
        <p style={{ color: '#666', fontSize: '14px', margin: '0 0 6px' }}>
          🚗 {pedido.vehiculo?.marca} {pedido.vehiculo?.modelo} {pedido.vehiculo?.anio}
        </p>
        <p style={{ color: '#888', fontSize: '12px', margin: '0 0 14px', lineHeight: '1.4' }}>
          Si dices que sí, por 30 días los clientes que busquen otra pieza de este vehículo te verán disponible, sin que te llegue otra alerta.
        </p>
        {error && <p role="alert" style={{ color: '#B3261E', fontSize: '13px', margin: '0 0 10px' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" onClick={onNo} disabled={guardando} style={{ ...botonToggle, flex: 1, backgroundColor: '#EEF1F5', color: '#333' }}>No, solo la pieza</button>
          <button type="button" onClick={si} disabled={guardando} style={{ ...botonToggle, flex: 1, backgroundColor: '#2E7D32', color: '#fff', opacity: guardando ? 0.6 : 1 }}>
            {guardando ? 'Guardando...' : 'Sí, lo tengo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// "La tengo" de una pieza ya vendida en todas las unidades. La respuesta al cliente ya quedó
// guardada; esto solo corrige el inventario. "+1" suma una unidad, renueva 30 días y cuenta la
// venta de esta alerta (3 de 3 -> 4 de 4). "No" no cambia nada.
function ModalOtroIgual({ pedido, vendidas, unidades, onSi, onNo }) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const vehiculo = `${pedido.vehiculo?.marca} ${pedido.vehiculo?.modelo} ${pedido.vehiculo?.anio}`;

  async function si() {
    setGuardando(true);
    setError('');
    try {
      await onSi();
    } catch (err) {
      console.error(err);
      setError(MENSAJES_VEHICULO_ALERTA.guardarFallo);
      setGuardando(false);
    }
  }

  return (
    <div role="dialog" style={fondoModal}>
      <div style={cajaModal}>
        <p style={{ fontWeight: 'bold', color: '#1A3C5E', margin: '0 0 6px', fontSize: '17px' }}>¿Tienes otro igual?</p>
        <p style={{ color: '#666', fontSize: '14px', margin: '0 0 14px', lineHeight: '1.4' }}>
          Ya marcaste vendidos todos los “{pedido.pieza}” de tus {vehiculo} ({vendidas} de {unidades}).
        </p>
        {error && <p role="alert" style={{ color: '#B3261E', fontSize: '13px', margin: '0 0 10px' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" onClick={onNo} disabled={guardando} style={{ ...botonToggle, flex: 1, backgroundColor: '#EEF1F5', color: '#333' }}>No</button>
          <button type="button" onClick={si} disabled={guardando} style={{ ...botonToggle, flex: 1, backgroundColor: '#2E7D32', color: '#fff', opacity: guardando ? 0.6 : 1 }}>
            {guardando ? 'Guardando...' : '+1 Tengo otro igual'}
          </button>
        </div>
      </div>
    </div>
  );
}

const avisoLimite = { backgroundColor: '#FFF4E8', border: '1px solid #E8720C', borderRadius: '12px', padding: '12px', marginBottom: '10px' };
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
