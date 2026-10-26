'use client';

// "Vehículos completos": los vehículos que el yonke confirmó al responder alertas
// (yonkes/{id}/vehiculosAlerta). Cada uno dura 30 días; mientras está vigente, los clientes que
// buscan una pieza de ese vehículo ven al yonke como "Vehículo disponible, pregunta por la pieza".
// - Unidades: "+1 / Tengo otro igual" (también renueva 30 días) y "−1" (no baja de 1 ni de las
//   ventas ya marcadas).
// - "Ya lo vendí": un toque suma una venta de esa pieza ("alternador (1 de 3)"); los clientes la
//   dejan de ver cuando se vendió en todas las unidades. "Deshacer" resta una venta.
// - "Quitar vehículo": se vendió o se desbarató todo.
// - "Sigo manteniendo mis vehículos": Premium renueva 30 días los vigentes con un toque; en el
//   plan Básico se ve en gris y al tocarlo explica que es del plan Premium.
// Sin config/pedidosClientes.inventarioVehiculos esta sección no se muestra ni lee nada más.
import { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { BotonQuieroPremium } from './CandadoPremium';
import {
  deshacerVentaPieza, escucharVehiculosAlerta, leerConfigPedidosClientes, marcarPiezaVendida, quitarVehiculoAlerta, renovarVehiculosVigentes,
  restarUnidad, sumarUnidad,
} from './pedidosClientesDatos';
import {
  MENSAJES_VEHICULO_ALERTA, diasRestantes, estaVigente, inventarioVehiculosActivo, piezasDelVehiculo, unidadesDe,
} from '../../lib/vehiculosAlerta';

export const TEXTO_BOTON_RENOVAR = 'Sigo manteniendo mis vehículos';

export default function VehiculosCompletosYonke({ yonkeId }) {
  const { premiumVigente } = useAuth();
  const [activo, setActivo] = useState(false);
  const [vehiculos, setVehiculos] = useState([]);
  const [mensaje, setMensaje] = useState('');
  const [avisoPremium, setAvisoPremium] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!yonkeId) return;
    let cancelado = false;
    leerConfigPedidosClientes()
      .then((c) => { if (!cancelado) setActivo(inventarioVehiculosActivo(c)); })
      .catch(() => {});
    return () => { cancelado = true; };
  }, [yonkeId]);

  useEffect(() => {
    if (!yonkeId || !activo) return undefined;
    return escucharVehiculosAlerta(yonkeId, setVehiculos);
  }, [yonkeId, activo]);

  if (!activo || vehiculos.length === 0) return null;

  const ahora = new Date();
  const vigentes = vehiculos.filter((v) => estaVigente(v, ahora)).sort((a, b) => diasRestantes(a, ahora) - diasRestantes(b, ahora));
  const vencidos = vehiculos.filter((v) => !estaVigente(v, ahora));

  async function ejecutar(accion, textoError) {
    setOcupado(true);
    setMensaje('');
    try {
      await accion();
    } catch (error) {
      console.error(error);
      setMensaje(error?.codigo === 'ventas' ? error.message : textoError);
    } finally {
      setOcupado(false);
    }
  }

  async function renovar() {
    if (!premiumVigente) { setAvisoPremium(true); return; }
    await ejecutar(async () => {
      const n = await renovarVehiculosVigentes(yonkeId, vehiculos);
      setMensaje(n > 0 ? `Listo. Renovamos ${n} vehículo(s) 30 días más.` : 'No tienes vehículos vigentes para renovar.');
    }, 'No se pudo renovar. Revisa tu conexión e intenta de nuevo.');
  }

  function quitar(v) {
    if (!window.confirm(`¿Quitar ${v.marca} ${v.modelo} ${v.ano} de tu inventario?`)) return;
    ejecutar(() => quitarVehiculoAlerta(yonkeId, v.id), 'No se pudo quitar el vehículo. Intenta de nuevo.');
  }

  return (
    <div style={seccion}>
      <p style={titulo}>🚗 Vehículos completos ({vigentes.length})</p>
      <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#666', lineHeight: '1.4' }}>
        Mientras un vehículo esté vigente, los clientes que busquen una pieza de él te ven disponible. Marca lo que ya vendiste.
      </p>

      <button
        type="button" onClick={renovar} disabled={ocupado}
        aria-disabled={!premiumVigente}
        style={{ ...botonRenovar, ...(premiumVigente ? {} : botonRenovarBasico) }}
      >
        {premiumVigente ? '🔄' : '🔒'} {TEXTO_BOTON_RENOVAR}
      </button>
      {avisoPremium && !premiumVigente && (
        <div role="note" style={avisoPremiumStyle}>
          <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#1A3C5E', fontWeight: '600' }}>⭐ {MENSAJES_VEHICULO_ALERTA.funcionPremium}</p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <BotonQuieroPremium ubicacion="renovar_vehiculos_alerta" compacto />
            <button type="button" onClick={() => setAvisoPremium(false)} style={botonCerrar}>Cerrar</button>
          </div>
        </div>
      )}
      {mensaje && <p role="status" style={{ margin: '8px 0 0', fontSize: '13px', color: '#1A3C5E' }}>{mensaje}</p>}

      {vigentes.map((v) => (
        <TarjetaVehiculo key={v.id} v={v} ahora={ahora} ocupado={ocupado}
          onVendida={(pieza) => ejecutar(() => marcarPiezaVendida(yonkeId, v.id, pieza), 'No se pudo guardar. Intenta de nuevo.')}
          onDeshacer={(pieza) => ejecutar(() => deshacerVentaPieza(yonkeId, v.id, pieza), 'No se pudo guardar. Intenta de nuevo.')}
          onMas={() => ejecutar(async () => {
            await sumarUnidad(yonkeId, v.id);
            setMensaje(`Listo. ${v.marca} ${v.modelo} ${v.ano}: ${unidadesDe(v) + 1} unidades, vigente 30 días más.`);
          }, 'No se pudo sumar la unidad. Intenta de nuevo.')}
          onMenos={() => ejecutar(() => restarUnidad(yonkeId, v.id), 'No se pudo restar la unidad. Intenta de nuevo.')}
          onQuitar={() => quitar(v)}
        />
      ))}

      {vencidos.length > 0 && (
        <>
          <p style={{ ...titulo, fontSize: '13px', color: '#888', margin: '14px 0 6px' }}>Vencidos ({vencidos.length})</p>
          <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#888' }}>
            Ya no se muestran a los clientes. Se reactivan cuando contestes una búsqueda activa de ese vehículo y digas que sí lo tienes completo.
          </p>
          {vencidos.map((v) => (
            <div key={v.id} style={{ ...tarjeta, opacity: 0.7 }}>
              <p style={{ margin: 0, fontWeight: 'bold', color: '#555' }}>{v.marca} {v.modelo} {v.ano}</p>
              <button type="button" onClick={() => quitar(v)} disabled={ocupado} style={botonQuitar}>Quitar vehículo</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function TarjetaVehiculo({ v, ahora, ocupado, onVendida, onDeshacer, onMas, onMenos, onQuitar }) {
  const [otra, setOtra] = useState('');
  const dias = diasRestantes(v, ahora);
  const unidades = unidadesDe(v);
  const piezas = piezasDelVehiculo(v);
  return (
    <div style={tarjeta}>
      <p style={{ margin: 0, fontWeight: 'bold', color: '#1A3C5E' }}>
        {v.marca} {v.modelo} {v.ano} · {unidades === 1 ? '1 unidad' : `${unidades} unidades`}
      </p>
      <p style={{ margin: '2px 0 8px', fontSize: '12px', color: dias <= 5 ? '#B3261E' : '#666' }}>
        Vigente {dias === 1 ? '1 día más' : `${dias} días más`}
      </p>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
        <button type="button" onClick={onMas} disabled={ocupado} style={{ ...botonUnidad, flex: 1 }}>+1 / Tengo otro igual</button>
        <button type="button" onClick={onMenos} disabled={ocupado} aria-label={`Restar una unidad de ${v.marca} ${v.modelo} ${v.ano}`} style={botonUnidad}>−1</button>
      </div>
      {piezas.map((p) => {
        const agotada = p.vendidas >= p.unidades;
        return (
          <div key={p.nombre} style={filaPieza}>
            <span style={{ fontSize: '14px', color: agotada ? '#999' : '#333' }}>
              {p.nombre}{p.vendidas > 0 && ` (${p.vendidas} de ${p.unidades})`}
            </span>
            <span style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              {p.vendidas > 0 && (
                <button type="button" onClick={() => onDeshacer(p.nombre)} disabled={ocupado} style={botonDeshacer}>Deshacer</button>
              )}
              <button
                type="button" onClick={() => onVendida(p.nombre)} disabled={ocupado || agotada}
                style={{ ...botonVendi, ...(agotada ? { backgroundColor: '#BDBDBD', cursor: 'default' } : {}) }}
              >
                Ya lo vendí
              </button>
            </span>
          </div>
        );
      })}
      <div style={{ ...filaPieza, borderBottom: 'none' }}>
        <input
          value={otra} maxLength={100} onChange={(e) => setOtra(e.target.value)}
          placeholder="¿Vendiste otra pieza? Ej. Faro derecho" aria-label={`Otra pieza vendida de ${v.marca} ${v.modelo} ${v.ano}`}
          style={inputOtra}
        />
        <button
          type="button" disabled={ocupado || otra.trim() === ''}
          onClick={() => { onVendida(otra); setOtra(''); }}
          style={{ ...botonVendi, opacity: otra.trim() === '' ? 0.5 : 1 }}
        >
          Ya lo vendí
        </button>
      </div>
      <button type="button" onClick={onQuitar} disabled={ocupado} style={botonQuitar}>Quitar vehículo</button>
    </div>
  );
}

const seccion = { backgroundColor: '#fff', borderRadius: '14px', padding: '14px', marginBottom: '12px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' };
const titulo = { margin: '0 0 6px', fontWeight: 'bold', color: '#1A3C5E' };
const tarjeta = { border: '1px solid #EEE', borderRadius: '12px', padding: '12px', marginTop: '10px' };
const filaPieza = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '6px 0', borderBottom: '1px solid #F2F2F2' };
const botonVendi = { flexShrink: 0, minHeight: '36px', padding: '0 12px', borderRadius: '10px', border: 'none', backgroundColor: '#1A3C5E', color: '#fff', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' };
const botonUnidad = { minHeight: '36px', padding: '0 12px', borderRadius: '10px', border: '1px solid #1A3C5E', backgroundColor: '#fff', color: '#1A3C5E', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' };
const botonDeshacer = { minHeight: '36px', padding: '0 10px', borderRadius: '10px', border: '1px solid #CCC', backgroundColor: '#fff', color: '#555', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' };
const botonQuitar = { marginTop: '10px', minHeight: '36px', padding: '0 12px', borderRadius: '10px', border: '1px solid #E0B4B4', backgroundColor: '#fff', color: '#B3261E', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' };
const botonRenovar = { width: '100%', minHeight: '44px', borderRadius: '10px', border: 'none', backgroundColor: '#2E7D32', color: '#fff', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' };
// Básico: gris pero claramente tocable (candado), no "descompuesto".
const botonRenovarBasico = { backgroundColor: '#E0E0E0', color: '#555' };
const avisoPremiumStyle = { marginTop: '10px', backgroundColor: '#FFF4E8', border: '1px solid #E8720C', borderRadius: '12px', padding: '12px' };
const botonCerrar = { minHeight: '34px', padding: '0 12px', borderRadius: '10px', border: 'none', backgroundColor: '#EEF1F5', color: '#333', fontWeight: 'bold', cursor: 'pointer' };
const inputOtra = { flex: 1, minWidth: 0, padding: '9px', fontSize: '14px', borderRadius: '10px', border: '1px solid #CCC' };
