'use client';

import { useState } from 'react';
import { parsePrecio } from '../../lib/precio';

const inputBase = {
  width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd',
  fontSize: '15px', backgroundColor: '#F4F5F5', color: '#333', boxSizing: 'border-box',
};

// Precio a texto editable: 1500 -> "1500", 1500.5 -> "1500.5"; sin precio -> ''.
export function precioATexto(precio) {
  return typeof precio === 'number' ? String(precio) : '';
}

// Campo "Precio (MXN)" de los formularios (motor/transmisión, pieza suelta). Controlado por el
// padre; valida en vivo con parsePrecio (misma función que usa el guardado). El padre debe volver
// a llamar parsePrecio al guardar y bloquear si no es ok — este componente solo informa.
// inputMode="decimal": teclado numérico en móvil, con punto/coma decimal.
export default function PrecioInput({ value, onChange, inputStyle }) {
  const parsed = parsePrecio(value);
  return (
    <div style={{ marginBottom: '12px' }}>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="Precio (MXN) — opcional"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...(inputStyle || inputBase), marginBottom: 0, borderColor: parsed.ok ? '#ddd' : '#C0392B' }}
      />
      {!parsed.ok && <p style={{ color: '#C0392B', fontSize: '12px', margin: '4px 0 0' }}>{parsed.error}</p>}
    </div>
  );
}

// Precio por pieza dentro de la lista de piezas de un vehículo. Se guarda al salir del campo
// (blur) o con Enter — sin botón, para capturar rápido. onCommit(number | null): null = vacío
// (el padre debe borrar el campo con deleteField()). Si el texto es inválido no guarda nada y
// muestra el error; si no cambió respecto a lo guardado, no escribe.
export function PiezaPrecioInput({ precio, onCommit }) {
  const original = precioATexto(precio);
  const [texto, setTexto] = useState(original);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function confirmar() {
    const parsed = parsePrecio(texto);
    if (!parsed.ok) { setError(parsed.error); return; }
    setError('');
    const nuevoTexto = precioATexto(parsed.value);
    if (nuevoTexto === original) { setTexto(nuevoTexto); return; }
    setGuardando(true);
    try {
      await onCommit(parsed.value);
      setTexto(nuevoTexto);
    } catch (e) {
      console.error(e);
      setError('No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={{ flexShrink: 0, width: '96px' }}>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label="Precio (MXN)"
        placeholder="Precio"
        value={texto}
        disabled={guardando}
        onChange={(e) => { setTexto(e.target.value); if (error) setError(''); }}
        onBlur={confirmar}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        style={{ ...inputBase, padding: '6px 8px', fontSize: '13px', borderColor: error ? '#C0392B' : '#ddd', opacity: guardando ? 0.6 : 1 }}
      />
      {error && <p style={{ color: '#C0392B', fontSize: '10px', margin: '2px 0 0', lineHeight: 1.2 }}>{error}</p>}
    </div>
  );
}
