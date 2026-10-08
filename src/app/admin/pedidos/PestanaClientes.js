'use client';

// Pestaña "Pedidos de clientes" del panel admin: lista con filtros y, al abrir un pedido, el
// WhatsApp del cliente (privado/contacto, solo admin), sus respuestas y las acciones.
import { useEffect, useState } from 'react';
import { ESTADOS_PEDIDO, estadoVisible } from '../../../lib/pedidosClientes';
import {
  borrarPedidoCliente, cancelarPedidoCliente, cerrarPedidoCliente, leerDetallePedidoCliente, reabrirPedidoCliente,
} from './datos';

export function fecha(ts) {
  const f = ts?.toDate ? ts.toDate() : null;
  return f ? f.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}

export function pesos(n) {
  return typeof n === 'number' ? `$${n.toLocaleString('es-MX', { maximumFractionDigits: 2 })}` : '';
}

const COLOR_ESTADO = { abierta: '#2E7D32', vencido: '#8A6D00', cerrada: '#1A3C5E', cancelada: '#B3261E' };

export default function PestanaClientes({ pedidos, conteos, estados, onCambio }) {
  const [filtroEstadoPedido, setFiltroEstadoPedido] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [abierto, setAbierto] = useState(null);

  if (pedidos === null) return <p style={{ color: '#555' }}>Cargando...</p>;

  const nombreEstado = (id) => estados.find((e) => e.id === id)?.nombre || id;
  const visibles = pedidos.filter((p) => (filtroEstadoPedido === 'todos' || p.estadoPedido === filtroEstadoPedido)
    && (filtroEstado === 'todos' || p.estado === filtroEstado));
  const ahora = new Date();

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <select aria-label="Filtrar por estado del pedido" value={filtroEstadoPedido} onChange={(e) => setFiltroEstadoPedido(e.target.value)} style={selector}>
          <option value="todos">Todos los estados del pedido</option>
          {ESTADOS_PEDIDO.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select aria-label="Filtrar por estado de la República" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={selector}>
          <option value="todos">Todos los estados de la República</option>
          {estados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
      </div>

      {visibles.length === 0 && <p style={{ color: '#555' }}>No hay pedidos de clientes con esos filtros.</p>}
      {visibles.map((p) => {
        const visible = estadoVisible(p, ahora);
        return (
          <div key={p.id} style={tarjeta}>
            <button type="button" onClick={() => setAbierto(abierto === p.id ? null : p.id)} style={filaBoton}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ fontWeight: 'bold', color: '#1A3C5E' }}>{p.pieza}</span>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: COLOR_ESTADO[visible] || '#555' }}>{visible}</span>
              </div>
              <div style={{ fontSize: '13px', color: '#555', marginTop: '2px' }}>
                {p.vehiculo?.marca} {p.vehiculo?.modelo} {p.vehiculo?.anio} · {nombreEstado(p.estado)}
                {p.id in conteos ? ` · ${conteos[p.id]} respuesta${conteos[p.id] === 1 ? '' : 's'}` : ''}
              </div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>Creado: {fecha(p.creadoAt)} · Vence: {fecha(p.expiraAt)}</div>
            </button>
            {abierto === p.id && <DetallePedido pedido={p} onCambio={() => { setAbierto(null); onCambio(); }} />}
          </div>
        );
      })}
    </div>
  );
}

function DetallePedido({ pedido, onCambio }) {
  const [detalle, setDetalle] = useState(null);
  const [error, setError] = useState('');
  const [trabajando, setTrabajando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    leerDetallePedidoCliente(pedido.id)
      .then((d) => { if (!cancelado) setDetalle(d); })
      .catch((err) => { console.error(err); if (!cancelado) setError('No pudimos abrir el pedido.'); });
    return () => { cancelado = true; };
  }, [pedido.id]);

  async function accion(pregunta, fn) {
    if (!window.confirm(pregunta)) return;
    setTrabajando(true);
    setError('');
    try {
      await fn(pedido.id);
      onCambio();
    } catch (err) {
      console.error(err);
      setError('No se pudo completar la acción. Revisa tu conexión y tus permisos de admin.');
    } finally {
      setTrabajando(false);
    }
  }

  if (error && !detalle) return <p role="alert" style={{ color: '#B3261E', fontSize: '13px' }}>{error}</p>;
  if (!detalle) return <p style={{ color: '#555', fontSize: '13px' }}>Cargando...</p>;

  const vehiculo = `${pedido.vehiculo?.marca} ${pedido.vehiculo?.modelo} ${pedido.vehiculo?.anio}`;
  const textoCliente = `Hola, te escribimos de Mecanix Yonke Virtual sobre tu pedido de ${pedido.pieza} para ${vehiculo}.`;

  return (
    <div style={{ borderTop: '1px solid #EEE', marginTop: '10px', paddingTop: '10px' }}>
      <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#555' }}>WhatsApp del cliente (solo admin):</p>
      {detalle.clienteWhatsapp ? (
        <a
          href={`https://wa.me/52${detalle.clienteWhatsapp}?text=${encodeURIComponent(textoCliente)}`}
          target="_blank"
          rel="noopener noreferrer"
          style={botonWhatsapp}
        >
          💬 {detalle.clienteWhatsapp}
        </a>
      ) : (
        <p style={{ margin: 0, fontSize: '13px', color: '#888' }}>Sin contacto (ya se borró).</p>
      )}

      <p style={{ margin: '14px 0 6px', fontWeight: 'bold', color: '#1A3C5E' }}>Respuestas ({detalle.respuestas.length})</p>
      {detalle.respuestas.length === 0 && <p style={{ margin: 0, fontSize: '13px', color: '#888' }}>Ningún yonke ha respondido.</p>}
      {detalle.respuestas.map((r) => (
        <div key={r.yonkeId} style={{ fontSize: '13px', padding: '8px 0', borderBottom: '1px solid #F2F2F2' }}>
          <strong>{r.yonkeNombre}</strong> {r.verificado ? '✅ Verificado' : '⚠️ Sin verificar'}
          <div>{r.tieneLaPieza ? `La tiene · ${pesos(r.precio)}` : 'No la tiene'}{r.nota ? ` · ${r.nota}` : ''}</div>
          <div style={{ color: '#555' }}>WhatsApp del yonke: {r.whatsapp || '—'}</div>
        </div>
      ))}

      {error && <p role="alert" style={{ color: '#B3261E', fontSize: '13px' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
        {pedido.estadoPedido === 'abierta' && (
          <>
            <button type="button" disabled={trabajando} style={boton('#1A3C5E')}
              onClick={() => accion('¿Cerrar este pedido? Los yonkes dejan de verlo y ya no pueden responder.', cerrarPedidoCliente)}>
              Cerrar
            </button>
            <button type="button" disabled={trabajando} style={boton('#8A6D00')}
              onClick={() => accion('¿Cancelar este pedido (por ejemplo, spam)? Los yonkes dejan de verlo.', cancelarPedidoCliente)}>
              Cancelar
            </button>
          </>
        )}
        <button type="button" disabled={trabajando} style={boton('#2E7D32')}
          onClick={() => accion('¿Reabrir este pedido? Vuelve a estar abierto y vence en 5 días a partir de hoy.', reabrirPedidoCliente)}>
          Reabrir 5 días
        </button>
        <button type="button" disabled={trabajando} style={boton('#B3261E')}
          onClick={() => accion('¿Borrar este pedido, todas sus respuestas y el WhatsApp del cliente? Esto no se puede deshacer.', borrarPedidoCliente)}>
          Borrar
        </button>
      </div>
    </div>
  );
}

const selector = { flex: 1, minWidth: '200px', minHeight: '42px', borderRadius: '10px', border: '1px solid #CCC', padding: '0 10px', backgroundColor: '#fff' };
const tarjeta = { backgroundColor: '#fff', borderRadius: '12px', padding: '12px 14px', marginBottom: '10px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' };
const filaBoton = { display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' };
const botonWhatsapp = { display: 'inline-block', padding: '8px 14px', borderRadius: '20px', backgroundColor: '#25D366', color: '#fff', fontWeight: 'bold', textDecoration: 'none', fontSize: '14px' };
const boton = (color) => ({ minHeight: '38px', padding: '0 14px', borderRadius: '10px', border: 'none', backgroundColor: color, color: '#fff', fontWeight: 'bold', cursor: 'pointer' });
