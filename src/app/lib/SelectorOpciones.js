'use client';

// Selector de opciones fijas en forma de botones — mismo componente para specs de vehículo
// (panel/admin) y para motores/transmisiones sueltos, así los dos lugares no se desincronizan
// en estilo ni en comportamiento.
//
// Compatibilidad con datos viejos: si `valor` no coincide con ninguna de las `opciones` (ej.
// texto libre capturado antes de este cambio), se agrega como chip extra ya seleccionado al
// inicio de la lista — nunca se pierde ni se reemplaza en silencio por "Otro / No
// especificado"; el usuario ve su valor real tal cual estaba guardado y decide si lo cambia.
export default function SelectorOpciones({ opciones, valor, onChange }) {
  const opcionesAMostrar = (valor && !opciones.includes(valor))
    ? [valor, ...opciones]
    : opciones;

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
      {opcionesAMostrar.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          style={valor === opt ? selectorActiveStyle : selectorStyle}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

const selectorStyle = {
  padding: '10px 14px', borderRadius: '8px', border: '1px solid #ddd',
  backgroundColor: '#F4F5F5', color: '#888', fontWeight: '600', cursor: 'pointer', fontSize: '13px',
};
const selectorActiveStyle = {
  ...selectorStyle, backgroundColor: '#1A3C5E', borderColor: '#1A3C5E', color: '#fff',
};
