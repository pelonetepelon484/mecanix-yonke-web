'use client';

import { useState } from 'react';
import { ADVERTENCIA_NOTA_CONTACTO, MAX_NOTA_CONTACTO, MAX_VEHICULOS_CONTACTO, validarContacto } from '../../../../lib/contactosTaller';

// Formulario de alta y edición. Valida en pantalla (lib/contactosTaller.js) y llama onGuardar con
// los datos limpios; si onGuardar falla, el mensaje se muestra y lo escrito sigue en pantalla.
const vehiculoVacio = () => ({ marca: '', modelo: '', anio: '', placas: '' });
const aEscrito = (v) => ({ marca: v.marca ?? '', modelo: v.modelo ?? '', anio: v.anio ? String(v.anio) : '', placas: v.placas ?? '' });

export default function ContactoForm({ inicial = null, textoBoton = 'Guardar contacto', onGuardar }) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [telefono, setTelefono] = useState(inicial?.telefono ?? '');
  const [nota, setNota] = useState(inicial?.nota ?? '');
  const [vehiculos, setVehiculos] = useState(inicial?.vehiculos?.length ? inicial.vehiculos.map(aEscrito) : [vehiculoVacio()]);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cambiarVehiculo = (i, campo, valor) => setVehiculos((lista) => lista.map((v, k) => (k === i ? { ...v, [campo]: valor } : v)));

  async function enviar(e) {
    e.preventDefault();
    const r = validarContacto({ nombre, telefono, nota, vehiculos });
    if (!r.ok) { setError(r.mensaje); return; }
    setError('');
    setGuardando(true);
    try {
      await onGuardar(r.datos);
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate>
      <label htmlFor="c-nombre" style={etiqueta}>Nombre *</label>
      <input id="c-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={100} autoComplete="off" style={campo} />
      <label htmlFor="c-telefono" style={etiqueta}>WhatsApp (10 dígitos)</label>
      <input id="c-telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" autoComplete="off" placeholder="6641234567" style={campo} />

      <p style={{ ...etiqueta, marginTop: '14px' }}>Vehículos (hasta {MAX_VEHICULOS_CONTACTO})</p>
      {vehiculos.map((v, i) => (
        <fieldset key={i} style={grupo}>
          <legend style={{ fontSize: '13px', color: '#555' }}>Vehículo {i + 1}</legend>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <input aria-label={`Marca del vehículo ${i + 1}`} placeholder="Marca" value={v.marca} onChange={(e) => cambiarVehiculo(i, 'marca', e.target.value)} maxLength={60} style={campo} />
            <input aria-label={`Modelo del vehículo ${i + 1}`} placeholder="Modelo" value={v.modelo} onChange={(e) => cambiarVehiculo(i, 'modelo', e.target.value)} maxLength={60} style={campo} />
            <input aria-label={`Año del vehículo ${i + 1}`} placeholder="Año" value={v.anio} onChange={(e) => cambiarVehiculo(i, 'anio', e.target.value)} inputMode="numeric" maxLength={4} style={campo} />
            <input aria-label={`Placas del vehículo ${i + 1}`} placeholder="Placas" value={v.placas} onChange={(e) => cambiarVehiculo(i, 'placas', e.target.value)} maxLength={14} autoCapitalize="characters" style={campo} />
          </div>
          {vehiculos.length > 1 && (
            <button type="button" onClick={() => setVehiculos((lista) => lista.filter((_, k) => k !== i))} style={quitar}>Quitar este vehículo</button>
          )}
        </fieldset>
      ))}
      {vehiculos.length < MAX_VEHICULOS_CONTACTO && (
        <button type="button" onClick={() => setVehiculos((lista) => [...lista, vehiculoVacio()])} style={secundario}>＋ Agregar otro vehículo</button>
      )}

      <label htmlFor="c-nota" style={{ ...etiqueta, marginTop: '14px' }}>Nota</label>
      <p style={{ fontSize: '12px', color: '#8A2A1A', margin: '0 0 6px' }}>⚠️ {ADVERTENCIA_NOTA_CONTACTO}</p>
      <textarea id="c-nota" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={MAX_NOTA_CONTACTO} rows={3} style={{ ...campo, resize: 'vertical' }} />

      {error && <p role="alert" style={{ color: '#B3261E', fontSize: '14px' }}>{error}</p>}
      <button type="submit" disabled={guardando} style={principal}>{guardando ? 'Guardando...' : textoBoton}</button>
    </form>
  );
}

const etiqueta = { display: 'block', fontSize: '14px', color: '#1A3C5E', fontWeight: 'bold', margin: '10px 0 4px' };
const campo = { width: '100%', boxSizing: 'border-box', padding: '12px', fontSize: '16px', borderRadius: '10px', border: '1px solid #CCC', backgroundColor: '#fff' };
const grupo = { border: '1px solid #E3E3E3', borderRadius: '12px', padding: '8px 10px 10px', margin: '0 0 8px', backgroundColor: '#fff' };
const quitar = { background: 'none', border: 'none', color: '#B3261E', fontSize: '13px', cursor: 'pointer', padding: '8px 0 0' };
const secundario = { width: '100%', minHeight: '44px', borderRadius: '12px', border: '1px dashed #1A3C5E', backgroundColor: '#fff', color: '#1A3C5E', fontWeight: 'bold', cursor: 'pointer' };
const principal = { width: '100%', minHeight: '52px', borderRadius: '12px', border: 'none', backgroundColor: '#E8720C', color: '#fff', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '16px' };
