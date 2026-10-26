'use client';

// Página del cliente con su pedido y las respuestas de los yonkes. Lee /api/mi-pedido/{id}?c=...
// (el servidor compara el hash del código) y se actualiza sola cada 15 s mientras la pestaña
// está a la vista, hasta 30 min; después queda un botón "Actualizar" (cuida la cuota de Firestore).
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { CONSEJOS_ENVIO, DURACION_RECARGA_MS, INTERVALO_RECARGA_MS, MENSAJES_PEDIDO, avisoRespuestaOtroEstado } from '../../../lib/pedidosClientes';

export const TEXTO_AVISO_PAGO = '🛡️ Antes de pagar, confirma la pieza directamente con el yonke. Con yonkes sin verificar, evita pagos por adelantado. Mecanix no participa en la venta ni en el pago.';

function pesos(n) {
  return `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fecha(iso) {
  return iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';
}

function enlaceWhatsappYonke(r, pedido) {
  const vehiculo = `${pedido.vehiculo.marca} ${pedido.vehiculo.modelo} ${pedido.vehiculo.anio}`;
  const texto = `Hola, vi en Mecanix que tienes ${pedido.pieza} para ${vehiculo}${r.precio != null ? ` en ${pesos(r.precio)}` : ''}. ¿Sigue disponible?`;
  return `https://wa.me/52${r.whatsapp.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(texto)}`;
}

async function consultarMiPedido(id, codigo) {
  try {
    const res = await fetch(`/api/mi-pedido/${encodeURIComponent(id)}?c=${encodeURIComponent(codigo)}`, { cache: 'no-store' });
    return { status: res.status, ok: res.ok, data: await res.json().catch(() => ({})) };
  } catch {
    return { status: 0, ok: false, data: {} };
  }
}

export default function MiPedidoCliente() {
  const { id } = useParams();
  const codigo = useSearchParams().get('c') || '';
  const [estado, setEstado] = useState('cargando'); // cargando | listo | noDisponible | noEncontrado | error
  const [datos, setDatos] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [enPausa, setEnPausa] = useState(false);
  const inicio = useRef(0);

  // Aplica el resultado de una consulta. Un error pasajero no borra lo que ya se mostraba.
  const aplicar = useCallback(({ status, ok, data }) => {
    if (status === 503) { setEstado('noDisponible'); return; }
    if (status === 404) { setEstado('noEncontrado'); return; }
    if (!ok || !data.ok) { setMensaje(data.mensaje || ''); setEstado((e) => (e === 'listo' ? e : 'error')); return; }
    setDatos(data);
    setMensaje('');
    setEstado('listo');
  }, []);

  const cargar = useCallback(() => consultarMiPedido(id, codigo).then(aplicar), [id, codigo, aplicar]);

  useEffect(() => {
    inicio.current = Date.now();
    cargar();
    const intervalo = setInterval(() => {
      if (Date.now() - inicio.current > DURACION_RECARGA_MS) { setEnPausa(true); return; }
      if (document.visibilityState === 'visible') cargar();
    }, INTERVALO_RECARGA_MS);
    return () => clearInterval(intervalo);
  }, [cargar]);

  function actualizar() {
    inicio.current = Date.now();
    setEnPausa(false);
    cargar();
  }

  if (estado === 'cargando') return <Marco><p style={{ color: '#555' }}>Cargando tu búsqueda activa...</p></Marco>;
  if (estado === 'noDisponible') return <Marco><p role="alert" style={{ color: '#8A2A1A' }}>{MENSAJES_PEDIDO.noDisponible}</p></Marco>;
  if (estado === 'noEncontrado') return <Marco><p role="alert" style={{ color: '#8A2A1A' }}>{MENSAJES_PEDIDO.noEncontrado}</p></Marco>;
  if (estado === 'error') return <Marco><p role="alert" style={{ color: '#8A2A1A' }}>{mensaje || 'No pudimos cargar tu búsqueda activa. Intenta de nuevo.'}</p><button type="button" onClick={actualizar} style={botonSecundario}>Intentar de nuevo</button></Marco>;

  const { pedido, respuestas } = datos;
  const conPieza = respuestas.filter((r) => r.tieneLaPieza);
  const sinPieza = respuestas.length - conPieza.length;

  return (
    <Marco>
      <div style={seccion}>
        <p style={{ margin: 0, fontSize: '13px', color: '#888' }}>Tu búsqueda activa</p>
        <p style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 'bold', color: '#1A3C5E' }}>{pedido.pieza}</p>
        <p style={{ margin: '2px 0 0', fontSize: '14px', color: '#555' }}>
          {pedido.vehiculo.marca} {pedido.vehiculo.modelo} {pedido.vehiculo.anio} · {pedido.estadoNombre}
        </p>
        <p style={{ margin: '8px 0 0', fontSize: '13px', color: pedido.vencido || pedido.estadoPedido !== 'abierta' ? '#8A2A1A' : '#2E7D32', fontWeight: 'bold' }}>
          {pedido.vencido ? 'Esta búsqueda activa ya venció: los yonkes ya no la ven.'
            : pedido.estadoPedido === 'cerrada' ? 'Esta búsqueda activa ya se cerró: los yonkes ya no la ven.'
            : pedido.estadoPedido !== 'abierta' ? 'Esta búsqueda activa fue dada de baja.'
              : `Abierto · los yonkes pueden responder hasta el ${fecha(pedido.vence)}`}
        </p>
      </div>

      <div style={seccion}>
        {/* Con config/pedidosClientes.avisoPagoCliente (el servidor manda avisoPago): advertencia de
            pago arriba de las respuestas. Sin la bandera, la página queda como siempre. */}
        {datos.avisoPago === true && (
          <div role="note" style={avisoPago}>
            <p style={{ margin: 0 }}>{TEXTO_AVISO_PAGO}</p>
            <a href="/compra-segura" style={{ display: 'inline-block', marginTop: '6px', color: '#1A3C5E', fontWeight: 'bold' }}>Ver consejos de compra segura →</a>
          </div>
        )}
        <p style={{ margin: '0 0 10px', fontWeight: 'bold', color: '#1A3C5E' }}>
          Respuestas ({conPieza.length} la tienen{sinPieza > 0 ? `, ${sinPieza} no` : ''})
        </p>
        {respuestas.length === 0 && (
          <p style={{ margin: 0, fontSize: '14px', color: '#555' }}>Todavía no responde ningún yonke. Esta página se actualiza sola; también puedes volver más tarde con tu enlace.</p>
        )}
        {respuestas.map((r, i) => (
          <div key={i} style={{ ...tarjeta, opacity: r.tieneLaPieza ? 1 : 0.6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
              <p style={{ margin: 0, fontWeight: 'bold', color: '#1A3C5E' }}>{r.yonkeNombre}</p>
              {r.tieneLaPieza && <p style={{ margin: 0, fontWeight: 'bold', color: '#E8720C', fontSize: '17px' }}>{pesos(r.precio)}</p>}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', fontWeight: 'bold', color: r.verificado ? '#2E7D32' : '#8A6D00' }}>
              {r.verificado ? '✅ Verificado' : `⚠️ Yonke nuevo, sin verificar${datos.avisoPago === true ? ' · confirma antes de pagar' : ''}`}
            </p>
            {r.estadoYonkeNombre && (
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#555' }}>
                📍 {r.estadoYonkeNombre}
                {/* La insignia solo si el yonke de verdad tiene Envíos nacionales (no contradice el aviso). */}
                {r.otroEstado && r.enviosNacionales && (
                  <span style={{ marginLeft: '6px', display: 'inline-block', backgroundColor: '#E3F2FD', color: '#1565C0', fontWeight: 'bold', padding: '2px 8px', borderRadius: '12px' }}>📦 Envíos nacionales</span>
                )}
              </p>
            )}
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#555' }}>{r.tieneLaPieza ? 'La tiene' : 'No la tiene'}{r.nota ? ` · ${r.nota}` : ''}</p>
            {r.tieneLaPieza && r.whatsapp && (
              <a href={enlaceWhatsappYonke(r, pedido)} target="_blank" rel="noopener noreferrer" style={botonWhatsapp}>💬 Escribirle por WhatsApp</a>
            )}
            {/* Yonke de otro estado que tiene la pieza: de dónde es, si hace envíos y que lo confirme. */}
            {r.otroEstado && r.tieneLaPieza && (
              <div data-testid="aviso-otro-estado" style={{ margin: '8px 0 0', fontSize: '12px', color: '#1565C0', backgroundColor: '#F1F7FD', borderRadius: '8px', padding: '8px', lineHeight: '1.5' }}>
                <p style={{ margin: 0 }}>{avisoRespuestaOtroEstado(r.estadoYonkeNombre, r.enviosNacionales === true)}</p>
                <p style={{ margin: '4px 0 0' }}>{CONSEJOS_ENVIO}</p>
              </div>
            )}
          </div>
        ))}
        {conPieza.length > 0 && (
          <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#8A2A1A', lineHeight: '1.5' }}>
            Confirma con el yonke antes de pagar o ir. Mecanix no vende ni cobra: no des anticipos a un yonke sin verificar.
          </p>
        )}
      </div>

      {enPausa ? (
        <button type="button" onClick={actualizar} style={botonSecundario}>Actualizar respuestas</button>
      ) : (
        <p style={{ fontSize: '12px', color: '#888', textAlign: 'center' }}>Esta página se actualiza sola cada pocos segundos.</p>
      )}
    </Marco>
  );
}

function Marco({ children }) {
  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '16px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <Link href="/" style={{ color: '#1A3C5E', fontSize: '14px', textDecoration: 'none' }}>← Mecanix Yonke Virtual</Link>
        <h1 style={{ fontSize: '22px', color: '#1A3C5E', margin: '10px 0 14px' }}>Mi búsqueda activa</h1>
        {children}
      </div>
    </main>
  );
}

const seccion = { backgroundColor: '#fff', borderRadius: '14px', padding: '16px', marginBottom: '14px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' };
const avisoPago = { backgroundColor: '#FFF9F2', border: '1px solid #F2C9A0', borderRadius: '10px', padding: '10px 12px', marginBottom: '12px', fontSize: '13px', color: '#5C3D00', lineHeight: '1.5' };
const tarjeta = { border: '1px solid #EEE', borderRadius: '12px', padding: '12px', marginBottom: '10px' };
const botonWhatsapp = { display: 'block', marginTop: '10px', padding: '11px', borderRadius: '50px', backgroundColor: '#25D366', color: '#fff', fontWeight: 'bold', fontSize: '14px', textAlign: 'center', textDecoration: 'none' };
const botonSecundario = { width: '100%', minHeight: '48px', borderRadius: '12px', border: '1px solid #1A3C5E', backgroundColor: '#fff', color: '#1A3C5E', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' };
