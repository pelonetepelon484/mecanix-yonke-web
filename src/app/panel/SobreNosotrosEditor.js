'use client';

import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { firebaseConfig } from '../lib/firebaseConfig';
import { subirFotoSobreNosotros, borrarFotoSobreNosotrosPorUrl, validarArchivoFotoSobreNosotros } from '../lib/sobreNosotrosStorage';
import { SOBRE_NOSOTROS_TEXTO_MAX, validarSobreNosotrosParaGuardar } from '../../lib/sobreNosotros';

function mensajeDeError(error) {
  if (error?.code === 'storage/unauthorized' || error?.code === 'permission-denied') {
    return 'No tienes permiso para guardar esto. Avísale a Mecanix.';
  }
  return error?.message || 'No se pudo guardar. Intenta de nuevo.';
}

// Sección "Sobre nosotros" del sitio con subdominio: yonkes/{id}.sitio.sobreNosotros. Solo texto
// plano (nunca HTML) — se muestra tal cual, sin dar formato. Si se deja el texto vacío, la
// sección deja de mostrarse en la página pública (no hace falta borrar nada más).
export default function SobreNosotrosEditor({ yonkeId, sobreNosotros, onChange }) {
  const [texto, setTexto] = useState(sobreNosotros?.texto || '');
  const [aniosExperiencia, setAniosExperiencia] = useState(sobreNosotros?.aniosExperiencia ?? '');
  const [direccion, setDireccion] = useState(sobreNosotros?.direccion || '');
  const [horario, setHorario] = useState(sobreNosotros?.horario || '');
  const [fotoUrl, setFotoUrl] = useState(sobreNosotros?.fotoUrl || null);
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [error, setError] = useState('');

  async function manejarFoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const errorArchivo = validarArchivoFotoSobreNosotros(file);
    if (errorArchivo) { setError(errorArchivo); return; }
    setError('');
    setSubiendoFoto(true);
    try {
      const anterior = fotoUrl;
      const url = await subirFotoSobreNosotros(yonkeId, file);
      setFotoUrl(url);
      if (anterior) await borrarFotoSobreNosotrosPorUrl(anterior).catch((err) => console.error('No se pudo borrar la foto anterior', err));
    } catch (e) {
      console.error(e);
      setError(mensajeDeError(e));
    } finally {
      setSubiendoFoto(false);
    }
  }

  function quitarFoto() {
    if (!fotoUrl) return;
    const anterior = fotoUrl;
    setFotoUrl(null);
    borrarFotoSobreNosotrosPorUrl(anterior).catch((err) => console.error('No se pudo borrar la foto', err));
  }

  async function guardar() {
    const datos = { texto, aniosExperiencia, direccion, horario, fotoUrl };
    const v = validarSobreNosotrosParaGuardar(datos, firebaseConfig.storageBucket);
    if (!v.ok) { setError(v.error); return; }
    setError('');
    setGuardando(true);
    try {
      const guardado = {
        texto: texto.trim(),
        aniosExperiencia: aniosExperiencia === '' ? null : Number(aniosExperiencia),
        direccion: direccion.trim() || null,
        horario: horario.trim() || null,
        fotoUrl: fotoUrl || null,
      };
      await updateDoc(doc(db, 'yonkes', yonkeId), { 'sitio.sobreNosotros': guardado });
      onChange(guardado);
      alert('Se guardó "Sobre nosotros" correctamente');
    } catch (e) {
      console.error(e);
      setError(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <p style={notaStyle}>
        Este texto aparece en tu página con subdominio. Si lo dejas vacío, la sección no se muestra.
      </p>

      <p style={labelStyle}>Sobre tu negocio</p>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value.slice(0, SOBRE_NOSOTROS_TEXTO_MAX))}
        maxLength={SOBRE_NOSOTROS_TEXTO_MAX}
        rows={5}
        placeholder="Cuéntale a tus clientes quiénes son, desde cuándo trabajan y qué los hace diferentes."
        style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
      />
      <p style={{ ...notaStyle, margin: '-4px 0 12px', textAlign: 'right' }}>{texto.length}/{SOBRE_NOSOTROS_TEXTO_MAX}</p>

      <p style={labelStyle}>Años de experiencia (opcional)</p>
      <input
        type="number" min="0" inputMode="numeric"
        value={aniosExperiencia}
        onChange={(e) => setAniosExperiencia(e.target.value)}
        placeholder="Ej. 15"
        style={{ ...inputStyle, maxWidth: '140px' }}
      />

      <p style={labelStyle}>Dirección para mostrar aquí (opcional)</p>
      <input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Puede ser distinta a tu dirección de registro" style={inputStyle} />

      <p style={labelStyle}>Horario para mostrar aquí (opcional)</p>
      <input type="text" value={horario} onChange={(e) => setHorario(e.target.value)} placeholder="Ej. Lunes a sábado, 9am a 6pm" style={inputStyle} />

      <p style={labelStyle}>Foto (opcional)</p>
      {fotoUrl && (
        <div style={{ marginBottom: '10px' }}>
          <img src={fotoUrl} alt="Foto de Sobre nosotros" style={{ width: '100%', maxWidth: '320px', borderRadius: '10px', display: 'block' }} />
        </div>
      )}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <label style={{ ...botonSecundarioStyle, opacity: subiendoFoto ? 0.5 : 1, cursor: subiendoFoto ? 'wait' : 'pointer' }}>
          {subiendoFoto ? 'Subiendo...' : (fotoUrl ? 'Reemplazar foto' : 'Subir foto')}
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={manejarFoto} disabled={subiendoFoto} style={{ display: 'none' }} />
        </label>
        {fotoUrl && (
          <button type="button" onClick={quitarFoto} disabled={subiendoFoto} style={botonEliminarStyle}>Quitar foto</button>
        )}
      </div>

      {error && <p role="alert" style={{ color: '#C0392B', fontSize: '13px', margin: '0 0 10px' }}>{error}</p>}

      <button onClick={guardar} disabled={guardando || subiendoFoto} style={{ ...botonPrincipalStyle, width: '100%' }}>
        {guardando ? 'Guardando...' : 'Guardar "Sobre nosotros"'}
      </button>

      {texto.trim() && (
        <div style={previewStyle}>
          <p style={previewTituloStyle}>Vista previa</p>
          {fotoUrl && <img src={fotoUrl} alt="" style={{ width: '100%', borderRadius: '10px', marginBottom: '10px', display: 'block' }} />}
          <p style={previewTextoStyle}>{texto}</p>
          {(aniosExperiencia || direccion || horario) && (
            <p style={{ ...previewTextoStyle, color: '#888', fontSize: '12px', marginTop: '8px' }}>
              {[aniosExperiencia ? `${aniosExperiencia} años de experiencia` : null, direccion, horario].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const notaStyle = { fontSize: '13px', color: '#666', margin: '0 0 12px', lineHeight: '1.5' };
const labelStyle = { fontSize: '13px', color: '#666', margin: '0 0 6px' };
const inputStyle = {
  width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd',
  fontSize: '14px', backgroundColor: '#F4F5F5', color: '#333', boxSizing: 'border-box', marginBottom: '12px',
};
const botonPrincipalStyle = {
  padding: '12px 14px', borderRadius: '8px', border: 'none', backgroundColor: '#E8720C',
  color: '#fff', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer',
};
const botonSecundarioStyle = {
  padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #1A3C5E', backgroundColor: '#fff',
  color: '#1A3C5E', fontWeight: 'bold', fontSize: '13px', display: 'inline-block',
};
const botonEliminarStyle = {
  padding: '10px 14px', borderRadius: '8px', border: 'none', backgroundColor: '#fff',
  color: '#D85A30', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer',
};
const previewStyle = { marginTop: '16px', padding: '14px', borderRadius: '10px', backgroundColor: '#F4F5F5', border: '1px dashed #ccc' };
const previewTituloStyle = { fontSize: '11px', fontWeight: 'bold', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px' };
const previewTextoStyle = { fontSize: '14px', color: '#333', lineHeight: '1.5', margin: 0, whiteSpace: 'pre-wrap' };
