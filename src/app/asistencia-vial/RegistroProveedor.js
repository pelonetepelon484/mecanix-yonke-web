'use client';

// Botón "Regístrate" para proveedores de asistencia vial (config/portada.asistenciaVialRegistro).
// Sale en la tarjeta de la portada y en /asistencia-vial. No guarda nada: abre WhatsApp con el
// mensaje escrito hacia Red Mecanix (ver src/lib/registroAsistencia.js).
import { useState } from 'react';
import { CIUDADES_ASISTENCIA, TIPOS_SERVICIO } from '../../lib/asistenciaVial';
import {
  TELEFONO_RED_MECANIX_TEXTO, TEXTO_BOTON_REGISTRO, TEXTO_PERMISO, enlaceLlamarRedMecanix, enlaceRegistro, validarRegistro,
} from '../../lib/registroAsistencia';

const VACIO = { nombre: '', servicios: [], ciudades: [], telefono: '', atiende24h: false, horario: '', permiso: false };

function Casillas({ titulo, opciones, elegidas, alCambiar }) {
  return (
    <fieldset style={grupo}>
      <legend style={etiqueta}>{titulo}</legend>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '6px' }}>
        {opciones.map((o) => (
          <label key={o.key} style={casilla}>
            <input
              type="checkbox"
              checked={elegidas.includes(o.key)}
              onChange={(e) => alCambiar(e.target.checked ? [...elegidas, o.key] : elegidas.filter((k) => k !== o.key))}
              style={cuadro}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function RegistroProveedor() {
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState(VACIO);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);
  const cambiar = (campo) => (valor) => { setF((x) => ({ ...x, [campo]: valor })); setError(''); };

  function enviar(e) {
    e.preventDefault();
    const r = validarRegistro(f);
    if (!r.ok) { setError(r.mensaje); return; }
    window.open(enlaceRegistro(r.datos), '_blank', 'noopener,noreferrer');
    setEnviado(true);
  }

  if (!abierto) {
    return <button type="button" onClick={() => setAbierto(true)} style={botonAbrir}>🚛 {TEXTO_BOTON_REGISTRO}</button>;
  }

  return (
    <form onSubmit={enviar} noValidate style={caja} aria-label="Registro de proveedor de asistencia vial">
      <p style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: '800', color: '#1A3C5E' }}>Registra tu servicio</p>
      <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#555', lineHeight: 1.5 }}>
        Al enviar se abre WhatsApp con tus datos para Red Mecanix. Te contestamos y te damos de alta como colaborador de la red Mecanix. No tiene costo.
      </p>

      <label style={etiqueta} htmlFor="rp-nombre">Nombre del negocio</label>
      <input id="rp-nombre" value={f.nombre} onChange={(e) => cambiar('nombre')(e.target.value)} maxLength={80} style={campo} autoComplete="organization" />

      <Casillas titulo="¿Qué servicios das?" opciones={TIPOS_SERVICIO} elegidas={f.servicios} alCambiar={cambiar('servicios')} />
      <Casillas titulo="¿En qué ciudades?" opciones={CIUDADES_ASISTENCIA} elegidas={f.ciudades} alCambiar={cambiar('ciudades')} />

      <label style={etiqueta} htmlFor="rp-telefono">Teléfono (10 dígitos)</label>
      <input id="rp-telefono" type="tel" inputMode="numeric" value={f.telefono} onChange={(e) => cambiar('telefono')(e.target.value)} maxLength={14} style={campo} autoComplete="tel-national" />

      <label style={{ ...casilla, marginTop: '10px' }}>
        <input type="checkbox" checked={f.atiende24h} onChange={(e) => cambiar('atiende24h')(e.target.checked)} style={cuadro} />
        Atiendo 24 horas
      </label>
      {!f.atiende24h && (
        <>
          <label style={etiqueta} htmlFor="rp-horario">Horario</label>
          <input id="rp-horario" value={f.horario} onChange={(e) => cambiar('horario')(e.target.value)} maxLength={80} placeholder="Ej. lunes a sábado de 8 a 8" style={campo} />
        </>
      )}

      <label style={{ ...casilla, alignItems: 'flex-start', marginTop: '12px', fontWeight: '600' }}>
        <input type="checkbox" checked={f.permiso} onChange={(e) => cambiar('permiso')(e.target.checked)} style={{ ...cuadro, marginTop: '2px' }} />
        {TEXTO_PERMISO}
      </label>

      {error && <p role="alert" style={{ color: '#B3261E', fontSize: '14px', margin: '10px 0 0' }}>{error}</p>}
      {enviado && !error && (
        <p role="status" style={{ color: '#1E6B34', fontSize: '14px', margin: '10px 0 0', fontWeight: '600' }}>
          ✅ Se abrió WhatsApp. Solo falta que toques &quot;Enviar&quot; en el chat.
        </p>
      )}
      <button type="submit" style={botonEnviar}>💬 Enviar por WhatsApp</button>
      <p style={{ margin: '10px 0 0', fontSize: '13px', color: '#555' }}>
        ¿No tienes WhatsApp? Llámanos al <a href={enlaceLlamarRedMecanix} style={{ color: '#E8720C', fontWeight: '700' }}>{TELEFONO_RED_MECANIX_TEXTO}</a>.
      </p>
    </form>
  );
}

const caja = { marginTop: '12px', backgroundColor: '#fff', border: '1px solid #E3EAF2', borderRadius: '16px', padding: '14px 16px 16px', textAlign: 'left' };
const botonAbrir = { width: '100%', marginTop: '12px', minHeight: '52px', borderRadius: '14px', border: '2px solid #E8720C', backgroundColor: '#fff', color: '#1A3C5E', fontSize: '15px', fontWeight: '800', cursor: 'pointer', padding: '10px 14px', lineHeight: 1.35 };
const botonEnviar = { width: '100%', marginTop: '14px', minHeight: '52px', borderRadius: '14px', border: 'none', backgroundColor: '#25D366', color: '#fff', fontSize: '17px', fontWeight: '800', cursor: 'pointer' };
const etiqueta = { display: 'block', fontSize: '13px', color: '#555', fontWeight: '700', margin: '10px 0 4px', padding: 0 };
const campo = { width: '100%', boxSizing: 'border-box', padding: '11px', fontSize: '16px', borderRadius: '10px', border: '1px solid #CCC', backgroundColor: '#fff', color: '#1A3C5E' };
const grupo = { border: 'none', margin: 0, padding: 0, minWidth: 0 };
const casilla = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#1A3C5E', cursor: 'pointer', lineHeight: 1.4 };
const cuadro = { width: '20px', height: '20px', flexShrink: 0 };
