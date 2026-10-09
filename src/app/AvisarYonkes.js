'use client';

// "Avisar a los yonkes": cuando la búsqueda no da resultados, el cliente (sin cuenta) deja
// vehículo, pieza, estado y su WhatsApp; /api/pedir-pieza crea el pedido y le devuelve un enlace
// para ver las respuestas. Falla cerrada: si config/pedidosClientes no está encendida, este
// componente no muestra NADA (la página se ve igual que antes). La bandera se lee una sola vez
// por carga de página (lib/banderaPedidosClientes.js, compartida con el campo de WhatsApp).
import { useEffect, useState } from 'react';
import SelectorMarcaModelo from './lib/SelectorMarcaModelo';
import { ESTADO_DEFAULT, cargarEstados } from './lib/estados';
import { leerBanderaPedidosClientes } from './lib/banderaPedidosClientes';
import { MENSAJES_PEDIDO, enlaceGuardarPorWhatsapp, validarPedidoCliente } from '../lib/pedidosClientes';
import { URL_PRIVACIDAD, URL_TERMINOS } from '../lib/versionesLegales';

export default function AvisarYonkes({ marcaInicial = '', modeloInicial = '', anioInicial = '', piezaInicial = '', estadoInicial = '' }) {
  const [habilitado, setHabilitado] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [estados, setEstados] = useState([{ id: ESTADO_DEFAULT, nombre: 'Baja California' }]);
  const [marca, setMarca] = useState(marcaInicial);
  const [modelo, setModelo] = useState(modeloInicial);
  const [anio, setAnio] = useState(anioInicial ? String(anioInicial) : '');
  const [pieza, setPieza] = useState(piezaInicial);
  const [estado, setEstado] = useState(estadoInicial || ESTADO_DEFAULT);
  const [whatsapp, setWhatsapp] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enlace, setEnlace] = useState('');

  useEffect(() => {
    let cancelado = false;
    leerBanderaPedidosClientes().then((v) => { if (!cancelado) setHabilitado(v); });
    return () => { cancelado = true; };
  }, []);

  function abrir() {
    setAbierto(true);
    cargarEstados().then(setEstados).catch(() => {});
  }

  async function enviar() {
    setError('');
    const datos = {
      vehiculo: { marca: marca.trim(), modelo: modelo.trim(), anio: anio.trim() === '' ? Number.NaN : Number(anio) },
      pieza: pieza.trim(),
      estado,
      whatsapp: whatsapp.trim(),
    };
    const problema = validarPedidoCliente(datos, estados.map((e) => e.id));
    if (problema) { setError(problema); return; }
    setEnviando(true);
    try {
      const res = await fetch('/api/pedir-pieza', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        if (data.disponible === false) setHabilitado(false);
        setError(data.mensaje || MENSAJES_PEDIDO.guardarFallo);
        return;
      }
      setEnlace(data.enlace);
    } catch (err) {
      console.error(err);
      setError(MENSAJES_PEDIDO.guardarFallo);
    } finally {
      setEnviando(false);
    }
  }

  if (!habilitado) return null;

  if (enlace) {
    const nombreEstado = estados.find((e) => e.id === estado)?.nombre || estado;
    return (
      <div style={caja}>
        <p style={{ margin: '0 0 6px', fontWeight: 'bold', color: '#2E7D32', fontSize: '15px' }}>✅ ¡Listo! Los yonkes de {nombreEstado} ya ven tu pedido.</p>
        <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#1A3C5E', lineHeight: '1.5' }}>
          Guarda este enlace: ahí verás las respuestas con precio, y tú decides a quién escribirle. Vence en 5 días.
        </p>
        <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#555', wordBreak: 'break-all', backgroundColor: '#F4F5F5', padding: '8px', borderRadius: '8px' }}>{enlace}</p>
        <a href={enlaceGuardarPorWhatsapp(whatsapp, enlace)} target="_blank" rel="noopener noreferrer" style={{ ...boton, backgroundColor: '#25D366', display: 'block', textAlign: 'center', textDecoration: 'none' }}>
          💬 Guardar mi enlace por WhatsApp
        </a>
        <a href={enlace} style={{ display: 'block', textAlign: 'center', marginTop: '10px', color: '#1A3C5E', fontWeight: 'bold', fontSize: '14px' }}>
          Ver mi pedido
        </a>
      </div>
    );
  }

  if (!abierto) {
    return (
      <div style={caja}>
        <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#1A3C5E', lineHeight: '1.5' }}>
          ¿No la encontraste? Avísale a los yonkes de tu estado y te responden con precio.
        </p>
        <button type="button" onClick={abrir} style={{ ...boton, backgroundColor: '#E8720C' }}>📣 Avisar a los yonkes</button>
      </div>
    );
  }

  return (
    <div style={caja}>
      <p style={{ margin: '0 0 10px', fontWeight: 'bold', color: '#1A3C5E' }}>📣 Avisar a los yonkes</p>
      <SelectorMarcaModelo marca={marca} modelo={modelo} onMarca={setMarca} onModelo={setModelo} inputStyle={input} selectStyle={input} />
      <label style={etiqueta} htmlFor="avisar-anio">Año</label>
      <input id="avisar-anio" type="number" inputMode="numeric" value={anio} onChange={(e) => setAnio(e.target.value)} style={input} />
      <label style={etiqueta} htmlFor="avisar-pieza">Pieza que buscas</label>
      <input id="avisar-pieza" value={pieza} maxLength={100} onChange={(e) => setPieza(e.target.value)} placeholder="Ej. Alternador" style={input} />
      <label style={etiqueta} htmlFor="avisar-estado">¿En qué estado la buscas?</label>
      <select id="avisar-estado" value={estado} onChange={(e) => setEstado(e.target.value)} style={input}>
        {estados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
      </select>
      <label style={etiqueta} htmlFor="avisar-whatsapp">Tu WhatsApp</label>
      <input id="avisar-whatsapp" type="tel" inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="10 dígitos" autoComplete="tel" style={input} />
      <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#555', lineHeight: '1.5' }}>
        Tu WhatsApp solo lo usa Mecanix para avisarte y no se comparte con los yonkes.{' '}
        <a href="/privacidad" target="_blank" rel="noopener noreferrer" style={{ color: '#1A3C5E' }}>Aviso de privacidad</a>
      </p>
      {error && <p role="alert" style={{ margin: '0 0 10px', fontSize: '13px', color: '#B3261E' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="button" onClick={() => setAbierto(false)} style={{ ...boton, flex: 1, backgroundColor: '#EEF1F5', color: '#333' }}>Cancelar</button>
        <button type="button" onClick={enviar} disabled={enviando} style={{ ...boton, flex: 1, backgroundColor: '#1A3C5E', opacity: enviando ? 0.6 : 1 }}>
          {enviando ? 'Enviando...' : 'Enviar pedido'}
        </button>
      </div>
      {/* Solo enlaces, no una casilla de aceptación. URLs absolutas igual que en el registro de yonkes. */}
      <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#777', textAlign: 'center', lineHeight: '1.5' }}>
        Al enviar aceptas los{' '}
        <a href={URL_TERMINOS} target="_blank" rel="noopener noreferrer" style={{ color: '#1A3C5E' }}>términos</a>
        {' '}y el{' '}
        <a href={`${URL_PRIVACIDAD}#pedidos-clientes`} target="_blank" rel="noopener noreferrer" style={{ color: '#1A3C5E' }}>aviso de privacidad</a>.
      </p>
    </div>
  );
}

const caja = { marginTop: '12px', padding: '14px', borderRadius: '12px', backgroundColor: '#fff', border: '1px solid #C5D8EC' };
const boton = { width: '100%', padding: '12px', borderRadius: '50px', border: 'none', color: '#fff', fontWeight: '700', fontSize: '14px', cursor: 'pointer' };
const etiqueta = { display: 'block', fontSize: '12px', color: '#555', margin: '0 0 4px', fontWeight: 'bold' };
const input = { width: '100%', boxSizing: 'border-box', padding: '11px', fontSize: '15px', borderRadius: '10px', border: '1px solid #CCC', marginBottom: '10px', backgroundColor: '#fff' };
