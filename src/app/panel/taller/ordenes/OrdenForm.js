'use client';

import { useState } from 'react';
import SelectorMarcaModelo from '../../../lib/SelectorMarcaModelo';
import { IVA_PORCENTAJE, formatearPesos, ivaCentavos, redondearCentavos, subtotalCentavos, totalConIvaCentavos } from '../../../../lib/cotizaciones';
import {
  ADVERTENCIA_OBSERVACIONES, ADVERTENCIA_VEHICULO, ESTADOS_ORDEN, MAX_ESTADO_RECEPCION, MAX_FALLA, MAX_GARANTIA_DIAS, MAX_OBSERVACIONES,
  MAX_PERTENENCIAS, MAX_PIEZAS, MAX_TRABAJOS, MENSAJES_ORDEN, NOMBRE_ESTADO_ORDEN, fechaBorradoPrevista, leerItems, textoPlano,
  totalOrdenCentavos, validarItem, validarOrden,
} from '../../../../lib/ordenes';

// Formulario de orden de servicio para celular. Si el guardado falla, NADA de lo escrito se borra.
// datosCliente: nombre, teléfono y placas (opcionales) SOLO si la pantalla lo permite
// (datosClienteDisponibles: bandera encendida, aviso de órdenes listo y versión vigente en la orden).
// Nunca VIN ni fotos.
// soloLectura: el taller tiene la versión vieja, está desactivado o la orden venció.
// Todo lo que viene de Firestore se lee como texto plano (leerItems/textoPlano) y React lo muestra
// como texto: nunca se interpreta como HTML.

const itemVacio = () => ({ descripcion: '', cantidad: 1, precio: '' });
const aFormulario = (lista) => leerItems(lista).map((i) => ({ descripcion: i.descripcion, cantidad: i.cantidad, precio: String(i.precioUnitario) }));

function desdeInicial(o) {
  return {
    nombre: textoPlano(o?.cliente?.nombre, 100),
    telefono: textoPlano(o?.cliente?.telefono, 20),
    placas: textoPlano(o?.vehiculo?.placas, 12),
    marca: textoPlano(o?.vehiculo?.marca, 60),
    modelo: textoPlano(o?.vehiculo?.modelo, 60),
    anio: o?.vehiculo?.anio ? String(o.vehiculo.anio) : '',
    kilometraje: o?.vehiculo?.kilometraje !== undefined ? String(o.vehiculo.kilometraje) : '',
    fallaReportada: textoPlano(o?.fallaReportada, MAX_FALLA),
    estadoRecepcion: textoPlano(o?.estadoRecepcion, MAX_ESTADO_RECEPCION),
    pertenencias: textoPlano(o?.pertenencias, MAX_PERTENENCIAS),
    observaciones: textoPlano(o?.observaciones, MAX_OBSERVACIONES),
    trabajos: aFormulario(o?.trabajos),
    piezas: aFormulario(o?.piezas),
    estado: ESTADOS_ORDEN.includes(o?.estado) ? o.estado : 'recibido',
    garantiaDias: o?.garantiaDias !== undefined ? String(o.garantiaDias) : '',
  };
}

const aItems = (lista) => lista.map((i) => ({
  descripcion: i.descripcion.trim(),
  cantidad: Number(i.cantidad),
  precioUnitario: i.precio.trim() === '' ? Number.NaN : redondearCentavos(Number(i.precio)),
}));

// Convierte lo escrito en datos para la lógica compartida. Campos vacíos quedan NaN (y fallan).
// Sin datosCliente, el cliente va vacío y sin placas (igual que en cotizaciones con la bandera apagada).
function construir(f, datosCliente) {
  const cliente = {};
  const vehiculo = { marca: f.marca.trim(), modelo: f.modelo.trim(), anio: f.anio.trim() === '' ? Number.NaN : Number(f.anio) };
  if (datosCliente) {
    if (f.nombre.trim()) cliente.nombre = f.nombre.trim();
    if (f.telefono.trim()) cliente.telefono = f.telefono.trim();
    if (f.placas.trim()) vehiculo.placas = f.placas.trim().toUpperCase();
  }
  if (f.kilometraje.trim() !== '') vehiculo.kilometraje = Number(f.kilometraje);
  const datos = {
    cliente,
    vehiculo,
    fallaReportada: f.fallaReportada.trim(),
    estadoRecepcion: f.estadoRecepcion.trim(),
    pertenencias: f.pertenencias.trim(),
    observaciones: f.observaciones.trim(),
    trabajos: aItems(f.trabajos),
    piezas: aItems(f.piezas),
    estado: f.estado,
  };
  if (f.estado === 'entregado') datos.garantiaDias = f.garantiaDias.trim() === '' ? Number.NaN : Number(f.garantiaDias);
  return datos;
}

const formatoFecha = (d) => d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

const inputBase = {
  width: '100%', boxSizing: 'border-box', padding: '14px', fontSize: '16px', borderRadius: '10px',
  border: '1px solid #CCC', backgroundColor: '#fff', marginBottom: '10px',
};
const etiqueta = { display: 'block', fontSize: '13px', color: '#555', marginBottom: '4px', fontWeight: 'bold' };
const advertencia = { fontSize: '13px', color: '#8A2A1A', margin: '0 0 6px' };
const seccion = { backgroundColor: '#fff', borderRadius: '14px', padding: '16px', marginBottom: '14px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' };
const botonGrande = { minHeight: '52px', padding: '0 18px', borderRadius: '12px', border: 'none', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' };
const sinBorde = { border: 0, padding: 0, margin: 0, minWidth: 0 };

function CampoTexto({ id, titulo, valor, onChange, max, aviso }) {
  return (
    <>
      <label htmlFor={id} style={etiqueta}>{titulo}</label>
      <p style={advertencia}>{aviso}</p>
      <textarea id={id} rows={3} maxLength={max} value={valor} onChange={onChange} style={{ ...inputBase, resize: 'vertical' }} />
    </>
  );
}

function ListaItems({ titulo, nombreSingular, lista, max, datos, onCambiar, onQuitar, onAgregar }) {
  return (
    <div style={seccion}>
      <p style={{ margin: '0 0 10px', fontWeight: 'bold', color: '#1A3C5E' }}>{titulo} ({lista.length} de {max})</p>
      {lista.map((r, i) => {
        const subtotal = validarItem(datos[i]) === null ? formatearPesos(subtotalCentavos(datos[i])) : '—';
        return (
          <div key={i} style={{ border: '1px solid #EEE', borderRadius: '12px', padding: '12px', marginBottom: '12px' }}>
            <label htmlFor={`${nombreSingular}-${i}`} style={etiqueta}>Descripción</label>
            <input id={`${nombreSingular}-${i}`} maxLength={200} value={r.descripcion} onChange={(e) => onCambiar(i, 'descripcion', e.target.value)} style={inputBase} />
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
              <div>
                <span style={etiqueta}>Cantidad</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button type="button" aria-label="Menos" onClick={() => onCambiar(i, 'cantidad', Math.max(1, Number(r.cantidad) - 1))} style={{ ...botonGrande, minWidth: '48px', backgroundColor: '#EEF1F5' }}>−</button>
                  <span style={{ minWidth: '32px', textAlign: 'center', fontSize: '18px' }}>{r.cantidad}</span>
                  <button type="button" aria-label="Más" onClick={() => onCambiar(i, 'cantidad', Math.min(999, Number(r.cantidad) + 1))} style={{ ...botonGrande, minWidth: '48px', backgroundColor: '#EEF1F5' }}>+</button>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor={`${nombreSingular}-precio-${i}`} style={etiqueta}>Precio unitario ($)</label>
                <input id={`${nombreSingular}-precio-${i}`} type="number" inputMode="decimal" step="0.01" min="0" value={r.precio} onChange={(e) => onCambiar(i, 'precio', e.target.value)} style={{ ...inputBase, marginBottom: 0 }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
              <span style={{ fontSize: '15px', color: '#333' }}>Subtotal: <strong>{subtotal}</strong></span>
              <button type="button" onClick={() => onQuitar(i)} style={{ ...botonGrande, minHeight: '44px', backgroundColor: '#fff', color: '#B3261E', border: '1px solid #E5B8B3' }}>
                Quitar
              </button>
            </div>
          </div>
        );
      })}
      <button type="button" disabled={lista.length >= max} onClick={onAgregar} style={{ ...botonGrande, width: '100%', backgroundColor: '#E8720C', color: '#fff', opacity: lista.length >= max ? 0.5 : 1 }}>
        + {nombreSingular === 'trabajo' ? 'Trabajo' : 'Pieza'}
      </button>
    </div>
  );
}

export default function OrdenForm({
  inicial = null, tallerActivo = true, soloLectura = false, puedeEliminar = false, datosCliente = false,
  onGuardar, onQuitarDatos, onEliminar, onCancelar,
}) {
  const [f, setF] = useState(() => desdeInicial(inicial));
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const set = (campo) => (e) => setF((prev) => ({ ...prev, [campo]: e.target.value }));
  const cambiarItem = (lista) => (i, campo, valor) => setF((prev) => ({
    ...prev, [lista]: prev[lista].map((r, j) => (j === i ? { ...r, [campo]: valor } : r)),
  }));
  const quitarItem = (lista) => (i) => setF((prev) => ({ ...prev, [lista]: prev[lista].filter((_, j) => j !== i) }));
  const agregarItem = (lista) => () => setF((prev) => ({ ...prev, [lista]: [...prev[lista], itemVacio()] }));

  const datos = construir(f, datosCliente);
  const itemsValidos = [...datos.trabajos, ...datos.piezas].every((i) => validarItem(i) === null);
  // Precios sin IVA: el IVA se calcula aquí para mostrarlo, no se guarda.
  const subtotal = itemsValidos ? totalOrdenCentavos(datos) : null;
  const entregando = f.estado === 'entregado';
  // Fecha de borrado que tendrá la orden AL GUARDAR (misma fórmula que exigen las reglas).
  const borradoPrevisto = fechaBorradoPrevista(inicial, datos.estado, datos.garantiaDias);
  const garantiaFalta = entregando && borradoPrevisto === null;

  async function guardar() {
    setError('');
    const problema = validarOrden(datos);
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
      setError(MENSAJES_ORDEN.guardarFallo);
    } finally {
      setGuardando(false);
    }
  }

  const deshabilitarGuardar = guardando || !tallerActivo || soloLectura || garantiaFalta;
  const tieneDatosCliente = Boolean(inicial && (Object.keys(inicial.cliente ?? {}).length > 0 || inicial.vehiculo?.placas));

  return (
    <div style={{ paddingBottom: '130px' }}>
      {!tallerActivo && (
        <div role="alert" style={{ ...seccion, backgroundColor: '#FDECEA', color: '#8A2A1A', fontSize: '14px' }}>
          {MENSAJES_ORDEN.tallerDesactivado}
        </div>
      )}

      <fieldset disabled={soloLectura} style={sinBorde}>
        {datosCliente && (
          <div style={seccion}>
            <p style={{ margin: '0 0 10px', fontWeight: 'bold', color: '#1A3C5E' }}>Cliente (opcional)</p>
            <label htmlFor="orden-nombre" style={etiqueta}>Nombre</label>
            <input id="orden-nombre" maxLength={100} value={f.nombre} onChange={set('nombre')} style={inputBase} autoComplete="off" />
            <label htmlFor="orden-telefono" style={etiqueta}>Teléfono</label>
            <input id="orden-telefono" type="tel" inputMode="tel" maxLength={20} value={f.telefono} onChange={set('telefono')} style={inputBase} autoComplete="off" />
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
          <label htmlFor="orden-anio" style={etiqueta}>Año</label>
          <input id="orden-anio" type="number" inputMode="numeric" value={f.anio} onChange={set('anio')} style={inputBase} />
          {datosCliente && (
            <>
              <label htmlFor="orden-placas" style={etiqueta}>Placas (opcional)</label>
              <input id="orden-placas" maxLength={12} value={f.placas} onChange={set('placas')} style={inputBase} autoComplete="off" />
            </>
          )}
          <label htmlFor="orden-km" style={etiqueta}>Kilometraje (opcional)</label>
          <input id="orden-km" type="number" inputMode="numeric" value={f.kilometraje} onChange={set('kilometraje')} style={inputBase} />
        </div>

        <div style={seccion}>
          <CampoTexto id="orden-falla" titulo="Falla reportada" valor={f.fallaReportada} onChange={set('fallaReportada')} max={MAX_FALLA} aviso={ADVERTENCIA_VEHICULO} />
          <CampoTexto id="orden-recepcion" titulo="Estado del vehículo al recibirlo" valor={f.estadoRecepcion} onChange={set('estadoRecepcion')} max={MAX_ESTADO_RECEPCION} aviso={ADVERTENCIA_VEHICULO} />
          <CampoTexto id="orden-pertenencias" titulo="Pertenencias dentro del vehículo" valor={f.pertenencias} onChange={set('pertenencias')} max={MAX_PERTENENCIAS} aviso={ADVERTENCIA_VEHICULO} />
        </div>

        <ListaItems
          titulo="Trabajos" nombreSingular="trabajo" lista={f.trabajos} max={MAX_TRABAJOS} datos={datos.trabajos}
          onCambiar={cambiarItem('trabajos')} onQuitar={quitarItem('trabajos')} onAgregar={agregarItem('trabajos')}
        />
        <ListaItems
          titulo="Piezas" nombreSingular="pieza" lista={f.piezas} max={MAX_PIEZAS} datos={datos.piezas}
          onCambiar={cambiarItem('piezas')} onQuitar={quitarItem('piezas')} onAgregar={agregarItem('piezas')}
        />

        <div style={seccion}>
          <CampoTexto id="orden-observaciones" titulo="Observaciones del vehículo" valor={f.observaciones} onChange={set('observaciones')} max={MAX_OBSERVACIONES} aviso={ADVERTENCIA_OBSERVACIONES} />
          <label htmlFor="orden-estado" style={etiqueta}>Estado</label>
          <select id="orden-estado" value={f.estado} onChange={set('estado')} style={inputBase}>
            {ESTADOS_ORDEN.map((e) => <option key={e} value={e}>{NOMBRE_ESTADO_ORDEN[e]}</option>)}
          </select>
          {entregando && (
            <>
              <label htmlFor="orden-garantia" style={etiqueta}>Días de garantía (de 0 a {MAX_GARANTIA_DIAS}) — obligatorio para entregar</label>
              <input
                id="orden-garantia" type="number" inputMode="numeric" min="0" max={MAX_GARANTIA_DIAS} step="1"
                value={f.garantiaDias} onChange={set('garantiaDias')} style={{ ...inputBase, borderColor: garantiaFalta ? '#B3261E' : '#CCC' }}
              />
              {garantiaFalta && <p role="alert" style={{ fontSize: '13px', color: '#B3261E', margin: '0 0 10px' }}>{MENSAJES_ORDEN.garantia}</p>}
            </>
          )}
          {!soloLectura && borradoPrevisto && (
            <p data-testid="borrado-previsto" style={{ fontSize: '14px', color: '#1A3C5E', backgroundColor: '#EEF4FA', borderRadius: '10px', padding: '10px', margin: 0 }}>
              {entregando
                ? `Al guardar como entregada, esta orden se eliminará el ${formatoFecha(borradoPrevisto)} (al terminar la garantía).`
                : `Al guardar, esta orden se eliminará el ${formatoFecha(borradoPrevisto)}. Cada vez que la guardes se vuelve a contar el plazo.`}
            </p>
          )}
        </div>
      </fieldset>

      {inicial && (tieneDatosCliente || puedeEliminar) && (
        <div style={{ ...seccion, display: 'grid', gap: '10px' }}>
          {tallerActivo && tieneDatosCliente && onQuitarDatos && (
            <button type="button" onClick={onQuitarDatos} style={{ ...botonGrande, backgroundColor: '#fff', color: '#B3261E', border: '1px solid #E5B8B3' }}>
              Quitar datos del cliente
            </button>
          )}
          {puedeEliminar && onEliminar && (
            <button type="button" onClick={onEliminar} style={{ ...botonGrande, backgroundColor: '#B3261E', color: '#fff' }}>
              Eliminar orden
            </button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" style={{ ...seccion, color: '#B3261E', fontSize: '14px', margin: '0 0 14px' }}>{error}</p>
      )}

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTop: '1px solid #E5E5E5', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 -4px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {subtotal === null ? (
            <>
              <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>Total</p>
              <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#1A3C5E' }}>Revisa trabajos y piezas</p>
            </>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: '13px', color: '#555' }}>Subtotal: {formatearPesos(subtotal)}</p>
              <p style={{ margin: 0, fontSize: '13px', color: '#555' }}>IVA ({IVA_PORCENTAJE} %): {formatearPesos(ivaCentavos(subtotal))}</p>
              <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#1A3C5E' }}>Total: {formatearPesos(totalConIvaCentavos(subtotal))}</p>
            </>
          )}
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
