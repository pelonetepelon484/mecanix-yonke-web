'use client';

// Alerta de búsqueda en UN paso (config/pedidosClientes.alertaUnPaso): el vehículo, la pieza y el
// estado vienen de la búsqueda; solo se pide el WhatsApp (y, si faltan, la pieza, el estado o el
// vehículo). Sin cuenta. Crea la MISMA alerta que AvisarYonkes (enviarAlertaCliente ->
// /api/pedir-pieza): mismos datos, mismas validaciones, mismos límites.
// - variante="protagonista": bloque grande "No tenemos ese vehículo todavía" (sin resultados). Con
//   titulo/texto (opcionales) se cambian SOLO ese título y ese texto (p. ej. cuando abajo hay
//   resultados de otros estados); el botón y el formulario de la alerta no cambian.
// - variante="discreta": "¿No encontraste la pieza exacta? Activa una alerta" (debajo de resultados).
// - variante="compacta": "¿No era lo que buscabas? Activa una alerta aquí", chica pero a la vista,
//   ARRIBA de los resultados (config/pedidosClientes.alertaSiempre).
// - abiertoDeEntrada (config/pedidosClientes.formularioAbierto, lo decide HomeClient): el formulario
//   sale abierto, sin tocar el botón; en la protagonista, su título y su texto quedan encima.
// - modoNumero (con abiertoDeEntrada, misma bandera, solo en los 4 casos sin resultado): pantalla sin
//   la palabra "alerta" y sin promesas de aviso — TEXTO_MODO_NUMERO encima (debajo del título de
//   otros estados, si lo hay), "Nunca ven tu número de WhatsApp." (aviso de privacidad, sección 14)
//   y sin "Cancelar". Casilla, consentimiento y "Al enviar aceptas…" no cambian.
// Sin la bandera (o sin config/pedidosClientes.habilitado) no muestra NADA.
import { useEffect, useState } from 'react';
import SelectorMarcaModelo from './lib/SelectorMarcaModelo';
import { cargarEstados } from './lib/estados';
import { leerBanderaAlertaUnPaso, leerBanderaFormularioAbierto, leerBanderaOtrosEstados } from './lib/banderaPedidosClientes';
import {
  CASILLA_OTROS_ESTADOS_INICIAL, CasillaOtrosEstados, ConfirmacionConsulta, TEXTO_BOTON_ALERTA, TEXTO_BOTON_ENVIAR, TEXTO_ENVIAR_ALERTA, enviarAlertaCliente,
} from './AvisarYonkes';
import { enlaceGuardarPorWhatsapp } from '../lib/pedidosClientes';
import { URL_PRIVACIDAD, URL_TERMINOS } from '../lib/versionesLegales';

export const TITULO_SIN_RESULTADOS = 'No tenemos ese vehículo todavía';
export const TEXTO_DISCRETO = '¿No encontraste la pieza exacta? Activa una alerta';
export const TEXTO_COMPACTO = '¿No era lo que buscabas? Activa una alerta aquí';
export const textoSinResultados = (estadoNombre) =>
  `Activa una alerta: los yonkes de ${estadoNombre || 'tu estado'} la verán y te responderán con su precio.`;
export const textoConfirmacion = (estadoNombre) =>
  `✅ Listo, los yonkes de ${estadoNombre} ya pueden ver tu búsqueda. Aquí verás sus respuestas:`;
// Con config/pedidosClientes.formularioAbierto ("consulta" en lugar de "alerta").
export const TEXTO_DISCRETO_CONSULTA = '¿No encontraste la pieza exacta? Consulta con los yonkes';
export const TEXTO_COMPACTO_CONSULTA = '¿No era lo que buscabas? Consulta con los yonkes aquí';
export const textoSinResultadosConsulta = (estadoNombre) =>
  `Consulta con los yonkes de ${estadoNombre || 'tu estado'}: verán tu búsqueda y te responderán con su precio.`;

// Modo número (config/pedidosClientes.formularioAbierto).
export const TEXTO_MODO_NUMERO = 'Deja tu número y revisa en tu link si algún yonke tiene tu pieza. Guarda tu link: ahí verás las respuestas.';
export const TEXTO_NUNCA_VEN_NUMERO = 'Nunca ven tu número de WhatsApp.';

const anioValido = (a) => /^\d{4}$/.test(String(a ?? '').trim());

export default function AlertaUnPaso({
  variante = 'protagonista', marca: marcaInicial = '', modelo: modeloInicial = '', anio: anioInicial = '', pieza: piezaInicial = '',
  estado: estadoInicial = '', estados: estadosProp = null, titulo = null, texto = null, abiertoDeEntrada = false, modoNumero = false,
}) {
  const [activa, setActiva] = useState(false);
  const [otrosEstadosActivo, setOtrosEstadosActivo] = useState(false);
  // config/pedidosClientes.formularioAbierto: textos de "consulta" en lugar de "alerta". El modo
  // número (que solo llega con esa bandera) los usa siempre.
  const [banderaConsulta, setBanderaConsulta] = useState(false);
  const consulta = modoNumero || banderaConsulta;
  const [estadosCargados, setEstadosCargados] = useState(null);
  const estados = estadosProp && estadosProp.length > 0 ? estadosProp : (estadosCargados || []);
  const estadoConocido = estadoInicial && estadoInicial !== 'todos' ? estadoInicial : '';

  // Lo que ya se sabe de la búsqueda decide qué campos se piden.
  const faltaVehiculo = !String(marcaInicial).trim() || !String(modeloInicial).trim() || !anioValido(anioInicial);
  const faltaPieza = !String(piezaInicial).trim();
  const faltaEstado = !estadoConocido;

  const [abierto, setAbierto] = useState(abiertoDeEntrada);
  const [corregir, setCorregir] = useState(false);
  const [marca, setMarca] = useState(marcaInicial);
  const [modelo, setModelo] = useState(modeloInicial);
  const [anio, setAnio] = useState(anioInicial ? String(anioInicial) : '');
  const [pieza, setPieza] = useState(piezaInicial);
  const [estado, setEstado] = useState(estadoConocido);
  const [whatsapp, setWhatsapp] = useState('');
  const [aceptaOtrosEstados, setAceptaOtrosEstados] = useState(CASILLA_OTROS_ESTADOS_INICIAL);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enlace, setEnlace] = useState('');

  useEffect(() => {
    let cancelado = false;
    leerBanderaAlertaUnPaso().then((v) => { if (!cancelado) setActiva(v); });
    leerBanderaOtrosEstados().then((v) => { if (!cancelado) setOtrosEstadosActivo(v); });
    leerBanderaFormularioAbierto().then((v) => { if (!cancelado) setBanderaConsulta(v); });
    return () => { cancelado = true; };
  }, []);

  // Nombres de estados: los que ya cargó la portada; si no llegaron, se piden una vez.
  useEffect(() => {
    if (!activa || (estadosProp && estadosProp.length > 0)) return undefined;
    let cancelado = false;
    cargarEstados().then((lista) => { if (!cancelado) setEstadosCargados(lista); }).catch(() => {});
    return () => { cancelado = true; };
  }, [activa, estadosProp]);

  if (!activa) return null;
  const nombreDe = (id) => estados.find((e) => e.id === id)?.nombre || '';

  async function enviar() {
    setError('');
    const datos = {
      vehiculo: { marca: marca.trim(), modelo: modelo.trim(), anio: String(anio).trim() === '' ? Number.NaN : Number(anio) },
      pieza: pieza.trim(),
      estado,
      whatsapp: whatsapp.trim(),
    };
    setEnviando(true);
    const r = await enviarAlertaCliente(datos, estados.map((e) => e.id), { otrosEstadosActivo, aceptaOtrosEstados, consulta });
    setEnviando(false);
    if (!r.ok) {
      if (r.disponible === false) setActiva(false);
      setError(r.mensaje);
      return;
    }
    setEnlace(r.enlace);
  }

  if (enlace && consulta) {
    return <ConfirmacionConsulta enlace={enlace} whatsapp={whatsapp} />;
  }

  if (enlace) {
    return (
      <div style={cajaConfirmacion}>
        <p style={{ margin: '0 0 6px', fontWeight: 'bold', color: '#2E7D32', fontSize: '15px', lineHeight: '1.4' }}>
          {textoConfirmacion(nombreDe(estado) || estado)}
          {otrosEstadosActivo && aceptaOtrosEstados && ' También la pueden ver yonkes Verificados de otros estados con Envíos nacionales.'}
        </p>
        <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#555', wordBreak: 'break-all', backgroundColor: '#F4F5F5', padding: '8px', borderRadius: '8px' }}>{enlace}</p>
        <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#1A3C5E', lineHeight: '1.5' }}>Guárdalo: ahí verás las respuestas con precio y tú decides a quién escribirle. Tu alerta dura 5 días.</p>
        <a href={enlaceGuardarPorWhatsapp(whatsapp, enlace)} target="_blank" rel="noopener noreferrer" style={{ ...botonBase, backgroundColor: '#25D366', display: 'block', textAlign: 'center', textDecoration: 'none' }}>
          💬 Guardar mi enlace por WhatsApp
        </a>
        <a href={enlace} style={{ display: 'block', textAlign: 'center', marginTop: '10px', color: '#1A3C5E', fontWeight: 'bold', fontSize: '14px' }}>Ver mi alerta</a>
      </div>
    );
  }

  const textoBoton = consulta ? TEXTO_BOTON_ENVIAR : TEXTO_BOTON_ALERTA;

  // Título y texto del recuadro grande: arriba del botón o, abierto de entrada, arriba del formulario.
  const encabezadoProtagonista = (
    <>
      <p style={{ margin: '0 0 6px', fontSize: '19px', fontWeight: '800', color: '#1A3C5E', lineHeight: '1.3' }}>{titulo || TITULO_SIN_RESULTADOS}</p>
      <p style={{ margin: '0 0 14px', fontSize: '14px', color: '#1A3C5E', lineHeight: '1.5' }}>{texto || (consulta ? textoSinResultadosConsulta : textoSinResultados)(nombreDe(estadoConocido))}</p>
    </>
  );

  if (!abierto) {
    if (variante === 'compacta') {
      return (
        <button type="button" onClick={() => setAbierto(true)} style={botonCompacto}>
          🔔 {consulta ? TEXTO_COMPACTO_CONSULTA : TEXTO_COMPACTO}
        </button>
      );
    }
    if (variante === 'discreta') {
      return (
        <button type="button" onClick={() => setAbierto(true)} style={botonDiscreto}>
          🔔 {consulta ? TEXTO_DISCRETO_CONSULTA : TEXTO_DISCRETO}
        </button>
      );
    }
    return (
      <div style={cajaProtagonista}>
        {encabezadoProtagonista}
        <button type="button" onClick={() => setAbierto(true)} style={botonGrande}>{textoBoton}</button>
      </div>
    );
  }

  const verVehiculo = faltaVehiculo || corregir;
  const verPieza = faltaPieza || corregir;
  const verEstado = faltaEstado || corregir;
  const resumen = [
    !verVehiculo && `🚗 ${marca} ${modelo} ${anio}`,
    !verPieza && `🔧 ${pieza}`,
    !verEstado && `📍 ${nombreDe(estado) || estado}`,
  ].filter(Boolean);

  return (
    <div style={variante === 'protagonista' ? cajaProtagonista : caja}>
      {modoNumero ? (
        <>
          {titulo && <p style={{ margin: '0 0 6px', fontSize: '19px', fontWeight: '800', color: '#1A3C5E', lineHeight: '1.3' }}>{titulo}</p>}
          <p style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: '700', color: '#1A3C5E', lineHeight: '1.45' }}>{TEXTO_MODO_NUMERO}</p>
        </>
      ) : (
        <>
          {abiertoDeEntrada && variante === 'protagonista' && encabezadoProtagonista}
          <p style={{ margin: '0 0 10px', fontWeight: 'bold', color: '#1A3C5E', fontSize: '16px' }}>{textoBoton}</p>
        </>
      )}
      {resumen.length > 0 && (
        <div style={resumenStyle}>
          {resumen.map((r) => <p key={r} style={{ margin: '2px 0' }}>{r}</p>)}
          {!corregir && <button type="button" onClick={() => setCorregir(true)} style={botonCorregir}>Corregir</button>}
        </div>
      )}
      {verVehiculo && (
        <>
          <SelectorMarcaModelo marca={marca} modelo={modelo} onMarca={setMarca} onModelo={setModelo} inputStyle={input} selectStyle={input} />
          <label style={etiqueta} htmlFor="alerta-anio">Año</label>
          <input id="alerta-anio" type="number" inputMode="numeric" value={anio} onChange={(e) => setAnio(e.target.value)} style={input} />
        </>
      )}
      {verPieza && (
        <>
          <label style={etiqueta} htmlFor="alerta-pieza">Pieza que buscas</label>
          <input id="alerta-pieza" value={pieza} maxLength={100} onChange={(e) => setPieza(e.target.value)} placeholder="Ej. Alternador" style={input} />
        </>
      )}
      {verEstado && (
        <>
          <label style={etiqueta} htmlFor="alerta-estado">¿En qué estado la buscas?</label>
          <select id="alerta-estado" value={estado} onChange={(e) => setEstado(e.target.value)} style={input}>
            {!estado && <option value="">Elige tu estado</option>}
            {estados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </>
      )}
      <label style={etiqueta} htmlFor="alerta-whatsapp">Tu WhatsApp</label>
      <input id="alerta-whatsapp" type="tel" inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="10 dígitos" autoComplete="tel" style={input} />
      {otrosEstadosActivo && <CasillaOtrosEstados id="alerta-otros-estados" marcada={aceptaOtrosEstados} onCambiar={setAceptaOtrosEstados} />}
      <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#555', lineHeight: '1.5' }}>
        {modoNumero ? TEXTO_NUNCA_VEN_NUMERO : 'Tu WhatsApp solo lo usa Mecanix para avisarte y no se comparte con los yonkes.'}{' '}
        <a href="/privacidad" target="_blank" rel="noopener noreferrer" style={{ color: '#1A3C5E' }}>Aviso de privacidad</a>
      </p>
      {error && <p role="alert" style={{ margin: '0 0 10px', fontSize: '13px', color: '#B3261E' }}>{error}</p>}
      <button type="button" onClick={enviar} disabled={enviando} style={{ ...botonGrande, opacity: enviando ? 0.6 : 1 }}>
        {enviando ? 'Enviando...' : (consulta ? TEXTO_BOTON_ENVIAR : TEXTO_ENVIAR_ALERTA)}
      </button>
      {!modoNumero && <button type="button" onClick={() => setAbierto(false)} style={botonCancelar}>Cancelar</button>}
      <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#777', textAlign: 'center', lineHeight: '1.5' }}>
        Al enviar aceptas los{' '}
        <a href={URL_TERMINOS} target="_blank" rel="noopener noreferrer" style={{ color: '#1A3C5E' }}>términos</a>
        {' '}y el{' '}
        <a href={`${URL_PRIVACIDAD}#pedidos-clientes`} target="_blank" rel="noopener noreferrer" style={{ color: '#1A3C5E' }}>aviso de privacidad</a>.
      </p>
    </div>
  );
}

// Mismos colores del sitio: azul #1A3C5E, naranja #E8720C y el recuadro naranja destacado de la
// alerta (AvisarYonkes, variante destacada).
const botonBase = { width: '100%', padding: '12px', borderRadius: '50px', border: 'none', color: '#fff', fontWeight: '700', fontSize: '14px', cursor: 'pointer' };
// Más alto y con sombra; la letra crece hasta 18 px en pantallas anchas y en celulares de 320 px
// baja a la del botón de siempre (12 px), para que el texto completo quepa en una sola línea
// dentro de la tarjeta del buscador con IA (el lugar más angosto).
const cajaConfirmacion = { margin: '14px 0', padding: '16px', borderRadius: '16px', backgroundColor: '#fff', border: '2px solid #2E7D32' };
const botonGrande = { ...botonBase, backgroundColor: '#E8720C', padding: '16px 6px', fontSize: 'clamp(12px, 3.7vw, 18px)', whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(232,114,12,0.35)' };
const cajaProtagonista = { margin: '14px 0', padding: '16px 12px', borderRadius: '16px', backgroundColor: '#FFF4E8', border: '2px solid #E8720C' };
const caja = { marginTop: '12px', padding: '14px', borderRadius: '12px', backgroundColor: '#fff', border: '1px solid #C5D8EC' };
const resumenStyle = { backgroundColor: '#fff', border: '1px solid #F2C9A0', borderRadius: '10px', padding: '8px 12px', marginBottom: '12px', fontSize: '14px', color: '#1A3C5E', fontWeight: '600' };
const botonCorregir = { marginTop: '4px', padding: 0, border: 'none', background: 'none', color: '#E8720C', fontSize: '12px', fontWeight: '700', textDecoration: 'underline', cursor: 'pointer' };
const botonCancelar = { display: 'block', width: '100%', marginTop: '8px', padding: '8px', border: 'none', background: 'none', color: '#555', fontSize: '13px', cursor: 'pointer' };
const botonCompacto = { display: 'block', width: '100%', margin: '0 0 14px', padding: '12px 14px', borderRadius: '12px', border: '1.5px solid #E8720C', backgroundColor: '#FFF4E8', color: '#1A3C5E', fontSize: '14px', fontWeight: '700', cursor: 'pointer', textAlign: 'center' };
const botonDiscreto = { display: 'block', width: '100%', margin: '16px 0', padding: '12px', borderRadius: '12px', border: '1px dashed #C5D8EC', backgroundColor: '#fff', color: '#1A3C5E', fontSize: '14px', fontWeight: '600', cursor: 'pointer' };
const etiqueta = { display: 'block', fontSize: '12px', color: '#555', margin: '0 0 4px', fontWeight: 'bold' };
const input = { width: '100%', boxSizing: 'border-box', padding: '11px', fontSize: '15px', borderRadius: '10px', border: '1px solid #CCC', marginBottom: '10px', backgroundColor: '#fff' };
