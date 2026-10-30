'use client';

// Piezas compartidas de las dos pestañas de /admin/pedidos (clientes y talleres):
// - RespuestaAdmin: una respuesta con su precio (o "Precio a tratar"), la marca de las sugeridas
//   por el admin y "Quitar respuesta" (no depende de la bandera; bloqueado si el taller ya la eligió).
// - SugerirYonke: el admin registra la respuesta de un yonke que le confirmó por fuera que tiene la
//   pieza. Sin campo de precio: siempre "precio a tratar". Solo yonkes activos que no han respondido,
//   leídos por estado (nunca todos).
import { useEffect, useState } from 'react';
import { TEXTO_PRECIO_A_TRATAR, TEXTO_SUGERIDA_POR_ADMIN, textoPrecioRespuesta } from '../../../lib/respuestasPedido';
import { listarYonkesActivosDeEstado, quitarRespuesta, sugerirYonke } from './datos';

export const TEXTO_ELEGIDA_NO_SE_QUITA = 'Respuesta elegida por el taller: no se puede quitar';
export const TEXTO_CONFIRMA_SUGERENCIA = 'Confirmo que este yonke me confirmó que tiene la pieza';

export function RespuestaAdmin({ coleccion, pedidoId, r, verificado = null, elegida = false, onQuitada }) {
  const [quitando, setQuitando] = useState(false);
  const [error, setError] = useState('');

  async function quitar() {
    if (!window.confirm(`¿Quitar la respuesta de ${r.yonkeNombre}? El yonke podrá volver a responder, o puedes volver a sugerirlo.`)) return;
    setQuitando(true);
    setError('');
    try {
      await quitarRespuesta(coleccion, pedidoId, r.yonkeId);
      onQuitada();
    } catch (err) {
      console.error(err);
      setError('No se pudo quitar la respuesta. Revisa tu conexión y tus permisos de admin.');
      setQuitando(false);
    }
  }

  return (
    <div style={{ fontSize: '13px', padding: '8px 0', borderBottom: '1px solid #F2F2F2' }}>
      <strong>{r.yonkeNombre}</strong>
      {verificado !== null && <> {verificado ? '✅ Verificado' : '⚠️ Sin verificar'}</>}
      {r.creadoPorAdmin === true && <span style={etiqueta}>{TEXTO_SUGERIDA_POR_ADMIN}</span>}
      <div>{r.tieneLaPieza ? `La tiene · ${textoPrecioRespuesta(r)}` : 'No la tiene'}{r.nota ? ` · ${r.nota}` : ''}</div>
      <div style={{ color: '#555' }}>WhatsApp del yonke: {r.whatsapp || '—'}</div>
      {elegida ? (
        <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#2E7D32' }}>{TEXTO_ELEGIDA_NO_SE_QUITA}</p>
      ) : (
        <button type="button" disabled={quitando} onClick={quitar} style={botonChico('#B3261E')}>Quitar respuesta</button>
      )}
      {error && <p role="alert" style={{ margin: '4px 0 0', color: '#B3261E', fontSize: '12px' }}>{error}</p>}
    </div>
  );
}

const sinAcentos = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function SugerirYonke({ coleccion, pedido, estados, permitirOtrosEstados = false, yaRespondieron, onHecho }) {
  const [abierto, setAbierto] = useState(false);
  const [otrosEstados, setOtrosEstados] = useState(false);
  const [estado, setEstado] = useState(pedido.estado);
  const [yonkes, setYonkes] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [elegidoId, setElegidoId] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!abierto) return;
    let cancelado = false;
    listarYonkesActivosDeEstado(estado)
      .then((lista) => { if (!cancelado) setYonkes(lista); })
      .catch((err) => { console.error(err); if (!cancelado) { setYonkes([]); setError('No pudimos cargar los yonkes.'); } });
    return () => { cancelado = true; };
  }, [abierto, estado]);

  const nombreEstado = (id) => estados.find((e) => e.id === id)?.nombre || id;
  const texto = sinAcentos(busqueda.trim());
  const visibles = (yonkes || [])
    .filter((y) => !yaRespondieron.includes(y.id))
    .filter((y) => texto === '' || sinAcentos(y.nombre).includes(texto))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const elegido = visibles.find((y) => y.id === elegidoId) || null;

  // Otro estado: la lista se vuelve a leer (y se suelta el yonke elegido).
  function cambiarEstado(nuevo) {
    if (nuevo === estado) return;
    setEstado(nuevo);
    setYonkes(null);
    setElegidoId('');
  }

  function cerrar() {
    setAbierto(false);
    setOtrosEstados(false);
    cambiarEstado(pedido.estado);
    setYonkes(null);
    setBusqueda('');
    setError('');
  }

  async function guardar() {
    if (!elegido) return;
    if (!window.confirm(`${elegido.nombre}\n\n${TEXTO_CONFIRMA_SUGERENCIA}.`)) return;
    setGuardando(true);
    setError('');
    try {
      await sugerirYonke(coleccion, pedido.id, elegido);
      cerrar();
      onHecho();
    } catch (err) {
      console.error(err);
      setError('No se pudo guardar. Revisa que el pedido siga abierto y que el yonke no haya respondido ya.');
    } finally {
      setGuardando(false);
    }
  }

  if (!abierto) {
    return <button type="button" onClick={() => setAbierto(true)} style={botonChico('#E8720C')}>Sugerir yonke</button>;
  }

  return (
    <div style={{ marginTop: '12px', padding: '12px', borderRadius: '10px', border: '1px solid #E0E0E0', backgroundColor: '#FAFAFA' }}>
      <p style={{ margin: '0 0 8px', fontWeight: 'bold', color: '#1A3C5E' }}>Sugerir yonke</p>
      {permitirOtrosEstados && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', marginBottom: '8px' }}>
          <input
            type="checkbox"
            checked={otrosEstados}
            onChange={(e) => { setOtrosEstados(e.target.checked); if (!e.target.checked) cambiarEstado(pedido.estado); }}
          />
          Mostrar también otros estados
        </label>
      )}
      {permitirOtrosEstados && otrosEstados && (
        <select aria-label="Estado de los yonkes" value={estado} onChange={(e) => cambiarEstado(e.target.value)} style={campo}>
          {estados.map((e) => <option key={e.id} value={e.id}>{e.nombre}{e.id === pedido.estado ? ' (el del pedido)' : ''}</option>)}
        </select>
      )}
      <input
        type="search"
        aria-label="Buscar yonke por nombre"
        placeholder="Buscar por nombre"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={campo}
      />
      {yonkes === null ? (
        <p style={{ fontSize: '13px', color: '#555' }}>Cargando yonkes...</p>
      ) : visibles.length === 0 ? (
        <p style={{ fontSize: '13px', color: '#888' }}>No hay yonkes activos sin responder en {nombreEstado(estado)}{texto ? ' con ese nombre' : ''}.</p>
      ) : (
        <div role="radiogroup" aria-label="Yonkes" style={{ maxHeight: '220px', overflowY: 'auto', marginBottom: '8px' }}>
          {visibles.map((y) => (
            <label key={y.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', fontSize: '13px', cursor: 'pointer' }}>
              <input type="radio" name={`sugerir-${pedido.id}`} checked={elegidoId === y.id} onChange={() => setElegidoId(y.id)} />
              <span>{y.nombre}{y.estado !== pedido.estado ? ` · ${nombreEstado(y.estado)}` : ''}</span>
            </label>
          ))}
        </div>
      )}
      <p style={{ margin: '0 0 8px', fontSize: '13px' }}>Precio: <strong>{TEXTO_PRECIO_A_TRATAR}</strong></p>
      {error && <p role="alert" style={{ margin: '0 0 8px', color: '#B3261E', fontSize: '13px' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button type="button" disabled={!elegido || guardando} onClick={guardar} style={{ ...botonChico('#2E7D32'), opacity: !elegido || guardando ? 0.6 : 1 }}>
          Guardar sugerencia
        </button>
        <button type="button" disabled={guardando} onClick={cerrar} style={botonChico('#888')}>Cerrar sin guardar</button>
      </div>
    </div>
  );
}

const etiqueta = { marginLeft: '6px', display: 'inline-block', backgroundColor: '#FFF3E0', color: '#8A4B00', fontSize: '11px', fontWeight: 'bold', padding: '1px 8px', borderRadius: '12px' };
const campo = { display: 'block', width: '100%', boxSizing: 'border-box', minHeight: '40px', borderRadius: '10px', border: '1px solid #CCC', padding: '0 10px', backgroundColor: '#fff', marginBottom: '8px', fontSize: '14px' };
function botonChico(color) {
  return { marginTop: '6px', minHeight: '34px', padding: '0 12px', borderRadius: '10px', border: 'none', backgroundColor: color, color: '#fff', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' };
}
