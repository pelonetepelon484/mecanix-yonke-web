'use client';

import { useState } from 'react';
import SelectorMarcaModelo from '../../../lib/SelectorMarcaModelo';
import { ESTADOS_COTIZACION, MAX_RENGLONES, MAX_VIGENCIA_DIAS, MENSAJES_COTIZACION, formatearPesos, redondearCentavos, subtotalCentavos, totalCentavos, validarCotizacion, validarRenglon } from '../../../../lib/cotizaciones';

// Formulario de cotización para celular. Si el guardado falla, NADA de lo escrito se borra.
// soloLectura: el taller tiene la versión vieja o está desactivado. Todo queda deshabilitado,
// excepto "Quitar datos del cliente", que es la única acción permitida.
// datosClienteHabilitados: si está apagada la bandera, no hay campos de nombre, teléfono ni placas.

function desdeInicial(c) {
  return {
    nombre: c?.cliente?.nombre ?? '',
    telefono: c?.cliente?.telefono ?? '',
    marca: c?.vehiculo?.marca ?? '',
    modelo: c?.vehiculo?.modelo ?? '',
    anio: c?.vehiculo?.anio ? String(c.vehiculo.anio) : '',
    placas: c?.vehiculo?.placas ?? '',
    kilometraje: c?.vehiculo?.kilometraje !== undefined ? String(c.vehiculo.kilometraje) : '',
    renglones: c?.renglones?.length
      ? c.renglones.map((r) => ({ tipo: r.tipo, descripcion: r.descripcion, cantidad: r.cantidad, precio: String(r.precioUnitario) }))
      : [{ tipo: 'pieza', descripcion: '', cantidad: 1, precio: '' }],
    observaciones: c?.observaciones ?? '',
    vigenciaDias: c?.vigenciaDias ? String(c.vigenciaDias) : '15',
    estado: c?.estado ?? 'borrador',
  };
}

// Convierte lo escrito en datos para la lógica compartida. Campos vacíos quedan NaN (y fallan).
function construir(f, archivada, datosClienteHabilitados) {
  const cliente = {};
  if (datosClienteHabilitados) {
    if (f.nombre.trim()) cliente.nombre = f.nombre.trim();
    if (f.telefono.trim()) cliente.telefono = f.telefono.trim();
  }
  const vehiculo = { marca: f.marca.trim(), modelo: f.modelo.trim(), anio: f.anio.trim() === '' ? Number.NaN : Number(f.anio) };
  if (datosClienteHabilitados && f.placas.trim()) vehiculo.placas = f.placas.trim().toUpperCase();
  if (f.kilometraje.trim() !== '') vehiculo.kilometraje = Number(f.kilometraje);
  const renglones = f.renglones.map((r) => ({
    tipo: r.tipo,
    descripcion: r.descripcion.trim(),
    cantidad: Number(r.cantidad),
    precioUnitario: r.precio.trim() === '' ? Number.NaN : redondearCentavos(Number(r.precio)),
  }));
  return {
    cliente, vehiculo, renglones,
    observaciones: f.observaciones.trim(),
    vigenciaDias: f.vigenciaDias.trim() === '' ? Number.NaN : Number(f.vigenciaDias),
    estado: f.estado,
    archivada,
  };
}

const inputBase = {
  width: '100%', boxSizing: 'border-box', padding: '14px', fontSize: '16px', borderRadius: '10px',
  border: '1px solid #CCC', backgroundColor: '#fff', marginBottom: '10px',
};
const etiqueta = { display: 'block', fontSize: '13px', color: '#555', marginBottom: '4px', fontWeight: 'bold' };
const seccion = { backgroundColor: '#fff', borderRadius: '14px', padding: '16px', marginBottom: '14px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' };
const botonGrande = { minHeight: '52px', padding: '0 18px', borderRadius: '12px', border: 'none', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' };
const sinBorde = { border: 0, padding: 0, margin: 0, minWidth: 0 };

export default function CotizacionForm({
  inicial = null, tallerActivo = true, soloLectura = false, datosClienteHabilitados = true, fechaEliminacion = null,
  onGuardar, onQuitarDatos, onArchivar, onDuplicar, onCancelar,
}) {
  const [f, setF] = useState(() => desdeInicial(inicial));
  const [archivada] = useState(inicial?.archivada ?? false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const set = (campo) => (e) => setF((prev) => ({ ...prev, [campo]: e.target.value }));
  const setRenglon = (i, campo, valor) => setF((prev) => ({
    ...prev,
    renglones: prev.renglones.map((r, j) => (j === i ? { ...r, [campo]: valor } : r)),
  }));
  const agregarRenglon = (tipo) => setF((prev) => ({
    ...prev,
    renglones: [...prev.renglones, { tipo, descripcion: '', cantidad: 1, precio: '' }],
  }));
  const quitarRenglon = (i) => setF((prev) => ({ ...prev, renglones: prev.renglones.filter((_, j) => j !== i) }));

  const datos = construir(f, archivada, datosClienteHabilitados);
  const renglonesValidos = datos.renglones.every((r) => validarRenglon(r) === null);
  const totalTexto = renglonesValidos ? formatearPesos(totalCentavos(datos.renglones)) : 'Revisa los renglones';

  async function guardar() {
    setError('');
    const problema = validarCotizacion(datos);
    if (problema) {
      setError(problema);
      return;
    }
    setGuardando(true);
    try {
      await onGuardar(datos);
    } catch (err) {
      console.error(err);
      // No se borra nada de lo escrito: solo se muestra el aviso.
      setError(MENSAJES_COTIZACION.guardarFallo);
    } finally {
      setGuardando(false);
    }
  }

  const deshabilitarGuardar = guardando || !tallerActivo || soloLectura;

  return (
    <div style={{ paddingBottom: '110px' }}>
      {!tallerActivo && (
        <div role="alert" style={{ ...seccion, backgroundColor: '#FDECEA', color: '#8A2A1A', fontSize: '14px' }}>
          {MENSAJES_COTIZACION.tallerDesactivado}
        </div>
      )}
      {fechaEliminacion && (
        <p style={{ fontSize: '13px', color: '#555', margin: '0 0 12px' }}>
          Se eliminará automáticamente el {fechaEliminacion.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}.
        </p>
      )}

      <fieldset disabled={soloLectura} style={sinBorde}>
        {datosClienteHabilitados && (
          <div style={seccion}>
            <p style={{ margin: '0 0 10px', fontWeight: 'bold', color: '#1A3C5E' }}>Cliente (opcional)</p>
            <label style={etiqueta}>Nombre</label>
            <input value={f.nombre} onChange={set('nombre')} style={inputBase} autoComplete="off" />
            <label style={etiqueta}>Teléfono</label>
            <input type="tel" inputMode="tel" value={f.telefono} onChange={set('telefono')} style={inputBase} autoComplete="off" />
          </div>
        )}

        <div style={seccion}>
          <p style={{ margin: '0 0 10px', fontWeight: 'bold', color: '#1A3C5E' }}>Vehículo</p>
          <SelectorMarcaModelo
            marca={f.marca}
            modelo={f.modelo}
            onMarca={(v) => setF((p) => ({ ...p, marca: v }))}
            onModelo={(v) => setF((p) => ({ ...p, modelo: v }))}
            inputStyle={inputBase}
            selectStyle={inputBase}
          />
          <label style={etiqueta}>Año</label>
          <input type="number" inputMode="numeric" value={f.anio} onChange={set('anio')} style={inputBase} />
          {datosClienteHabilitados && (
            <>
              <label style={etiqueta}>Placas (opcional)</label>
              <input value={f.placas} onChange={set('placas')} style={inputBase} autoComplete="off" />
            </>
          )}
          <label style={etiqueta}>Kilometraje (opcional)</label>
          <input type="number" inputMode="numeric" value={f.kilometraje} onChange={set('kilometraje')} style={inputBase} />
        </div>

        <div style={seccion}>
          <p style={{ margin: '0 0 10px', fontWeight: 'bold', color: '#1A3C5E' }}>Renglones ({f.renglones.length} de {MAX_RENGLONES})</p>

          {f.renglones.map((r, i) => {
            const subtotal = validarRenglon(datos.renglones[i]) === null ? formatearPesos(subtotalCentavos(datos.renglones[i])) : '—';
            return (
              <div key={i} style={{ border: '1px solid #EEE', borderRadius: '12px', padding: '12px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                  {[['pieza', 'Pieza'], ['manoObra', 'Mano de obra']].map(([valor, texto]) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => setRenglon(i, 'tipo', valor)}
                      style={{ ...botonGrande, flex: 1, minHeight: '48px', backgroundColor: r.tipo === valor ? '#1A3C5E' : '#EEF1F5', color: r.tipo === valor ? '#fff' : '#333' }}
                    >
                      {texto}
                    </button>
                  ))}
                </div>
                <label style={etiqueta}>Descripción</label>
                <input value={r.descripcion} onChange={(e) => setRenglon(i, 'descripcion', e.target.value)} style={inputBase} />
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                  <div>
                    <label style={etiqueta}>Cantidad</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button type="button" onClick={() => setRenglon(i, 'cantidad', Math.max(1, Number(r.cantidad) - 1))} style={{ ...botonGrande, minWidth: '48px', backgroundColor: '#EEF1F5' }}>−</button>
                      <span style={{ minWidth: '32px', textAlign: 'center', fontSize: '18px' }}>{r.cantidad}</span>
                      <button type="button" onClick={() => setRenglon(i, 'cantidad', Math.min(999, Number(r.cantidad) + 1))} style={{ ...botonGrande, minWidth: '48px', backgroundColor: '#EEF1F5' }}>+</button>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={etiqueta}>Precio unitario ($)</label>
                    <input type="number" inputMode="decimal" step="0.01" min="0" value={r.precio} onChange={(e) => setRenglon(i, 'precio', e.target.value)} style={{ ...inputBase, marginBottom: 0 }} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                  <span style={{ fontSize: '15px', color: '#333' }}>Subtotal: <strong>{subtotal}</strong></span>
                  <button type="button" onClick={() => quitarRenglon(i)} style={{ ...botonGrande, minHeight: '44px', backgroundColor: '#fff', color: '#B3261E', border: '1px solid #E5B8B3' }}>
                    Quitar
                  </button>
                </div>
              </div>
            );
          })}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" disabled={f.renglones.length >= MAX_RENGLONES} onClick={() => agregarRenglon('pieza')} style={{ ...botonGrande, flex: 1, backgroundColor: '#E8720C', color: '#fff', opacity: f.renglones.length >= MAX_RENGLONES ? 0.5 : 1 }}>
              + Pieza
            </button>
            <button type="button" disabled={f.renglones.length >= MAX_RENGLONES} onClick={() => agregarRenglon('manoObra')} style={{ ...botonGrande, flex: 1, backgroundColor: '#E8720C', color: '#fff', opacity: f.renglones.length >= MAX_RENGLONES ? 0.5 : 1 }}>
              + Mano de obra
            </button>
          </div>
        </div>

        <div style={seccion}>
          <label style={etiqueta}>Observaciones</label>
          <textarea rows={3} value={f.observaciones} onChange={set('observaciones')} style={{ ...inputBase, resize: 'vertical' }} />
          <label style={etiqueta}>Vigencia (días, de 1 a {MAX_VIGENCIA_DIAS})</label>
          <input type="number" inputMode="numeric" min="1" max={MAX_VIGENCIA_DIAS} value={f.vigenciaDias} onChange={set('vigenciaDias')} style={inputBase} />
          <label style={etiqueta}>Estado</label>
          <select value={f.estado} onChange={set('estado')} style={inputBase}>
            {ESTADOS_COTIZACION.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
      </fieldset>

      {inicial && (
        <div style={{ ...seccion, display: 'grid', gap: '10px' }}>
          {!soloLectura && (
            <>
              <button type="button" onClick={onArchivar} style={{ ...botonGrande, backgroundColor: '#EEF1F5', color: '#1A3C5E' }}>
                {inicial.archivada ? 'Desarchivar' : 'Archivar'}
              </button>
              <button type="button" onClick={onDuplicar} style={{ ...botonGrande, backgroundColor: '#EEF1F5', color: '#1A3C5E' }}>
                Duplicar cotización
              </button>
            </>
          )}
          <button type="button" onClick={onQuitarDatos} style={{ ...botonGrande, backgroundColor: '#fff', color: '#B3261E', border: '1px solid #E5B8B3' }}>
            Quitar datos del cliente
          </button>
        </div>
      )}

      {error && (
        <p role="alert" style={{ ...seccion, color: '#B3261E', fontSize: '14px', margin: '0 0 14px' }}>{error}</p>
      )}

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTop: '1px solid #E5E5E5', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 -4px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>Total</p>
          <p style={{ margin: 0, fontSize: '22px', fontWeight: 'bold', color: '#1A3C5E' }}>{totalTexto}</p>
        </div>
        <button type="button" onClick={onCancelar} style={{ ...botonGrande, backgroundColor: '#EEF1F5', color: '#333' }}>Volver</button>
        {!soloLectura && (
          <button type="button" onClick={guardar} disabled={deshabilitarGuardar} style={{ ...botonGrande, backgroundColor: '#1A3C5E', color: '#fff', opacity: deshabilitarGuardar ? 0.6 : 1 }}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        )}
      </div>
    </div>
  );
}
