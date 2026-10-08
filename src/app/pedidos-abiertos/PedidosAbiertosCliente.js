'use client';

// Pedidos abiertos de clientes, para yonkes con o sin cuenta. Solo vehículo, pieza, estado y
// fecha (lo que devuelve /api/pedidos-abiertos), nunca datos del cliente. Falla cerrada: si la
// API dice "no disponible", no se hace ninguna otra lectura (ni siquiera la lista de estados).
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ESTADO_DEFAULT, cargarEstados } from '../lib/estados';
import { MENSAJES_PEDIDO } from '../../lib/pedidosClientes';

function fecha(iso) {
  return iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '';
}

export default function PedidosAbiertosCliente() {
  const [estado, setEstado] = useState(ESTADO_DEFAULT);
  const [estados, setEstados] = useState([{ id: ESTADO_DEFAULT, nombre: 'Baja California' }]);
  const [situacion, setSituacion] = useState('cargando'); // cargando | listo | noDisponible | error
  const [pedidos, setPedidos] = useState([]);
  const estadosPedidos = useRef(false);

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/pedidos-abiertos?estado=${encodeURIComponent(estado)}`, { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelado) return;
        if (res.status === 503) { setSituacion('noDisponible'); return; }
        if (!res.ok || !data.ok) { setSituacion('error'); return; }
        setPedidos(data.pedidos);
        setSituacion('listo');
        // La lista de estados solo se pide cuando la función sí está disponible.
        if (!estadosPedidos.current) {
          estadosPedidos.current = true;
          cargarEstados().then(setEstados).catch(() => {});
        }
      })
      .catch(() => { if (!cancelado) setSituacion('error'); });
    return () => { cancelado = true; };
  }, [estado]);

  function cambiarEstado(nuevo) {
    setSituacion('cargando');
    setEstado(nuevo);
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '16px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <Link href="/" style={{ color: '#1A3C5E', fontSize: '14px', textDecoration: 'none' }}>← Mecanix Yonke Virtual</Link>
        <h1 style={{ fontSize: '22px', color: '#1A3C5E', margin: '10px 0 6px' }}>Clientes buscando piezas</h1>

        {situacion === 'noDisponible' ? (
          <p role="alert" style={{ color: '#8A2A1A' }}>{MENSAJES_PEDIDO.noDisponible}</p>
        ) : (
          <>
            <p style={{ fontSize: '14px', color: '#555', margin: '0 0 14px', lineHeight: '1.5' }}>
              ¿Tienes un yonke? Estos clientes buscan piezas ahora mismo. Regístrate gratis para responderles con tu precio: ellos te escriben directo.
            </p>
            <select value={estado} onChange={(e) => cambiarEstado(e.target.value)} style={selector} aria-label="Estado">
              {estados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>

            {situacion === 'cargando' && <p style={{ color: '#555' }}>Cargando...</p>}
            {situacion === 'error' && <p role="alert" style={{ color: '#B3261E' }}>No pudimos cargar los pedidos. Intenta de nuevo.</p>}
            {situacion === 'listo' && pedidos.length === 0 && <p style={{ color: '#555' }}>No hay pedidos abiertos en este estado por ahora.</p>}
            {situacion === 'listo' && pedidos.map((p) => (
              <div key={p.id} style={tarjeta}>
                <p style={{ margin: 0, fontWeight: 'bold', color: '#1A3C5E', fontSize: '16px' }}>{p.pieza}</p>
                <p style={{ margin: '2px 0 0', color: '#555', fontSize: '14px' }}>{p.vehiculo.marca} {p.vehiculo.modelo} {p.vehiculo.anio}</p>
                <p style={{ margin: '4px 0 0', color: '#888', fontSize: '12px' }}>{p.estadoNombre} · {fecha(p.creadoAt)}</p>
                <a href={`/panel/registro?pedido=${p.id}`} style={botonResponder}>Responder</a>
                <a href={`/panel/reservaciones?pedido=${p.id}`} style={{ display: 'block', marginTop: '8px', fontSize: '13px', color: '#1A3C5E' }}>
                  ¿Ya tienes cuenta? Inicia sesión y responde desde tu panel
                </a>
              </div>
            ))}
          </>
        )}
      </div>
    </main>
  );
}

const selector = { width: '100%', minHeight: '48px', borderRadius: '12px', border: '1px solid #CCC', fontSize: '15px', padding: '0 12px', marginBottom: '14px', backgroundColor: '#fff' };
const tarjeta = { backgroundColor: '#fff', borderRadius: '14px', padding: '14px 16px', marginBottom: '10px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' };
const botonResponder = { display: 'block', marginTop: '10px', padding: '11px', borderRadius: '10px', backgroundColor: '#E8720C', color: '#fff', fontWeight: 'bold', fontSize: '14px', textAlign: 'center', textDecoration: 'none' };
