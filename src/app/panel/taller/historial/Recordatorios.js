'use client';

import { useState } from 'react';
import {
  MAX_AVISAR_DIAS_ANTES, MAX_MESES_RECORDATORIO, MAX_TIPO_RECORDATORIO, MENSAJES_RECORDATORIO, SERVICIOS_PERIODICOS,
  diasValidos, mesesValidos, sumarMeses, tipoValido, ultimoServicio,
} from '../../../../lib/historialTaller';
import { agregarRecordatorios, cambiarRecordatorioDelVehiculo, quitarRecordatorioDelVehiculo, recordatoriosDe } from './datos';
import { fechaLarga } from './formato';

// Recordatorios del vehículo (etapa 3). Con puedeEscribir (Premium vigente, términos vigentes,
// taller activo y bandera): adelantar o cambiar la fecha, cambiar los días de aviso, marcar
// atendido y quitar. Sin eso, solo se ven. Ningún cambio mueve la fecha de borrado del vehículo.
// "Agregar recordatorio" (vehículos ya existentes, o si el segundo guardado al agregar falló):
// servicio periódico u otro, con meses desde la entrega del último servicio o con fecha a mano. Un
// recordatorio por guardado, con la misma ruta "solo recordatorios" de las reglas.
const aMs = (v) => (v?.toMillis ? v.toMillis() : (v instanceof Date ? v.getTime() : Number(v)));
const OTRO = '__otro__';
const aCampo = (msFecha) => {
  const f = new Date(msFecha);
  const p = (n) => String(n).padStart(2, '0');
  return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}`;
};

function Fila({ r, puedeEscribir, onCambio, onQuitar }) {
  const [fecha, setFecha] = useState(aCampo(r.fecha));
  const [dias, setDias] = useState(String(r.avisarDiasAntes));
  const pendiente = r.estado === 'pendiente';
  return (
    <div style={tarjeta}>
      <p style={{ margin: 0, fontWeight: 'bold', color: pendiente ? '#1A3C5E' : '#888' }}>
        {r.tipo} {pendiente ? '' : '· atendido'}
      </p>
      <p style={{ margin: '2px 0', fontSize: '13px', color: '#555' }}>
        {fechaLarga(new Date(r.fecha))} · avisar {r.avisarDiasAntes} día(s) antes · orden {r.folio}
      </p>
      {puedeEscribir && pendiente && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px', alignItems: 'center' }}>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label={`Fecha de ${r.tipo}`} style={campo} />
          <button type="button" style={boton} onClick={() => onCambio(r.id, { fecha: new Date(`${fecha}T12:00:00`).getTime() })} disabled={!fecha}>
            Cambiar fecha
          </button>
          <input
            type="number" min={0} max={MAX_AVISAR_DIAS_ANTES} value={dias} onChange={(e) => setDias(e.target.value)}
            aria-label={`Días de aviso de ${r.tipo}`} style={{ ...campo, width: '64px' }}
          />
          <button type="button" style={boton} onClick={() => onCambio(r.id, { avisarDiasAntes: Number(dias) })}>Guardar días</button>
          <button type="button" style={boton} onClick={() => onCambio(r.id, { estado: 'atendido' })}>Atendido</button>
        </div>
      )}
      {puedeEscribir && (
        <button type="button" style={{ ...boton, color: '#B3261E', borderColor: '#B3261E', marginTop: '6px' }} onClick={() => onQuitar(r)}>
          Quitar
        </button>
      )}
    </div>
  );
}

function AgregarRecordatorio({ tallerId, vehiculo, onGuardado }) {
  const base = ultimoServicio(vehiculo.servicios, aMs);
  const [abierto, setAbierto] = useState(false);
  const [eleccion, setEleccion] = useState(SERVICIOS_PERIODICOS[0].tipo);
  const [otroTipo, setOtroTipo] = useState('');
  const [modo, setModo] = useState('meses');
  const [meses, setMeses] = useState(String(SERVICIOS_PERIODICOS[0].meses));
  const [fecha, setFecha] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  if (!base) return null;

  function elegir(valor) {
    setEleccion(valor);
    const p = SERVICIOS_PERIODICOS.find((s) => s.tipo === valor);
    if (p) setMeses(String(p.meses));
  }

  async function guardar() {
    setError('');
    const tipo = eleccion === OTRO ? otroTipo.trim() : eleccion;
    if (!tipoValido(tipo)) { setError(MENSAJES_RECORDATORIO.tipo); return; }
    let nuevo;
    if (modo === 'fecha') {
      if (!fecha) { setError(MENSAJES_RECORDATORIO.fecha); return; }
      nuevo = { tipo, fecha: new Date(`${fecha}T12:00:00`).getTime() };
    } else {
      if (!mesesValidos(Number(meses))) { setError(MENSAJES_RECORDATORIO.meses); return; }
      nuevo = { tipo, meses: Number(meses) };
    }
    setGuardando(true);
    try {
      await agregarRecordatorios(tallerId, vehiculo.id, [nuevo], { fechaEntrega: aMs(base.fecha), folio: base.folio });
      setAbierto(false);
      onGuardado();
    } catch (err) {
      setError(err.message || MENSAJES_RECORDATORIO.guardarFallo);
    } finally {
      setGuardando(false);
    }
  }

  if (!abierto) {
    return <button type="button" style={{ ...boton, width: '100%', marginBottom: '10px' }} onClick={() => setAbierto(true)}>+ Agregar recordatorio</button>;
  }
  const textoBase = new Date(aMs(base.fecha)).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  return (
    <div style={tarjeta}>
      <label style={etiqueta}>
        Servicio
        <select value={eleccion} onChange={(e) => elegir(e.target.value)} style={{ ...campo, display: 'block', width: '100%' }} aria-label="Servicio del recordatorio">
          {SERVICIOS_PERIODICOS.map((s) => <option key={s.tipo} value={s.tipo}>{s.tipo}</option>)}
          <option value={OTRO}>Otro servicio</option>
        </select>
      </label>
      {eleccion === OTRO && (
        <input
          value={otroTipo} maxLength={MAX_TIPO_RECORDATORIO} onChange={(e) => setOtroTipo(e.target.value)}
          placeholder="Escribe el servicio" aria-label="Otro servicio" style={{ ...campo, display: 'block', width: '100%', marginTop: '6px', boxSizing: 'border-box' }}
        />
      )}
      <div style={{ margin: '8px 0', fontSize: '14px' }}>
        <label style={{ display: 'block' }}>
          <input type="radio" name="modo" checked={modo === 'meses'} onChange={() => setModo('meses')} /> Cada{' '}
          <input
            type="number" min={1} max={MAX_MESES_RECORDATORIO} value={meses} onChange={(e) => setMeses(e.target.value)}
            aria-label="Meses del recordatorio" style={{ ...campo, width: '64px' }} disabled={modo !== 'meses'}
          />{' '}meses desde el último servicio ({textoBase})
          {modo === 'meses' && mesesValidos(Number(meses)) && (
            <span style={{ display: 'block', fontSize: '12px', color: '#555' }}>
              Fecha: {new Date(sumarMeses(aMs(base.fecha), Number(meses))).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
            </span>
          )}
        </label>
        <label style={{ display: 'block', marginTop: '6px' }}>
          <input type="radio" name="modo" checked={modo === 'fecha'} onChange={() => setModo('fecha')} /> Elegir la fecha{' '}
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha elegida" style={campo} disabled={modo !== 'fecha'} />
        </label>
      </div>
      {error && <p role="alert" style={{ color: '#B3261E', fontSize: '14px', margin: '0 0 6px' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="button" style={{ ...boton, flex: 1, backgroundColor: '#1A3C5E', color: '#fff' }} onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando...' : 'Guardar recordatorio'}
        </button>
        <button type="button" style={boton} onClick={() => setAbierto(false)}>Cancelar</button>
      </div>
    </div>
  );
}

export default function Recordatorios({ tallerId, vehiculo, puedeEscribir, onGuardado }) {
  const [error, setError] = useState('');
  const lista = recordatoriosDe(vehiculo);
  const ordenada = [...lista].sort((a, b) => (a.estado === b.estado ? a.fecha - b.fecha : a.estado === 'pendiente' ? -1 : 1));

  async function cambiar(id, cambios) {
    setError('');
    if (cambios.avisarDiasAntes !== undefined && !diasValidos(cambios.avisarDiasAntes)) { setError(MENSAJES_RECORDATORIO.dias); return; }
    try {
      await cambiarRecordatorioDelVehiculo(tallerId, vehiculo, id, cambios);
      onGuardado();
    } catch (err) {
      console.error(err);
      setError(MENSAJES_RECORDATORIO.guardarFallo);
    }
  }
  async function quitar(r) {
    if (!window.confirm(`¿Quitar el recordatorio "${r.tipo}"?`)) return;
    setError('');
    try {
      await quitarRecordatorioDelVehiculo(tallerId, vehiculo, r.id);
      onGuardado();
    } catch (err) {
      console.error(err);
      setError(MENSAJES_RECORDATORIO.guardarFallo);
    }
  }

  return (
    <section aria-label="Recordatorios">
      <h2 style={{ fontSize: '16px', color: '#1A3C5E', margin: '18px 0 8px' }}>Recordatorios</h2>
      {error && <p role="alert" style={{ color: '#B3261E', fontSize: '14px' }}>{error}</p>}
      {puedeEscribir && <AgregarRecordatorio tallerId={tallerId} vehiculo={vehiculo} onGuardado={onGuardado} />}
      {ordenada.length === 0 && <p style={{ fontSize: '14px', color: '#555' }}>Sin recordatorios.</p>}
      {ordenada.map((r) => (
        <Fila key={`${r.id}-${r.fecha}-${r.avisarDiasAntes}-${r.estado}`} r={r} puedeEscribir={puedeEscribir} onCambio={cambiar} onQuitar={quitar} />
      ))}
    </section>
  );
}

const tarjeta = { backgroundColor: '#fff', border: '1px solid #E3E3E3', borderRadius: '14px', padding: '12px 14px', marginBottom: '10px' };
const etiqueta = { display: 'block', fontSize: '14px', color: '#333' };
const campo = { minHeight: '40px', borderRadius: '10px', border: '1px solid #CCC', padding: '0 8px', fontSize: '15px' };
const boton = { minHeight: '40px', borderRadius: '10px', border: '1px solid #1A3C5E', backgroundColor: '#fff', color: '#1A3C5E', fontWeight: 'bold', cursor: 'pointer', padding: '0 12px' };
