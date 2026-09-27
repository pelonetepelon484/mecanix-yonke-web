'use client';

import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { subirPromoYonke, borrarPromoPorUrl, validarArchivoPromo } from '../lib/promosStorage';
import { PROMOS_MAX, PROMO_TITULO_MAX, validarTituloPromo, validarPromosParaGuardar } from '../../lib/promos';

function mensajeDeError(error) {
  if (error?.code === 'storage/unauthorized' || error?.code === 'permission-denied') {
    return 'No tienes permiso para guardar esta imagen. Avísale a Mecanix.';
  }
  return error?.message || 'No se pudo completar la operación. Intenta de nuevo.';
}

// Hasta 3 imágenes de ofertas/publicidad para la página con subdominio del yonke. Cada una lleva un
// título obligatorio (máx. 60) que se usa en el mensaje de WhatsApp al tocarla. Se guardan en
// yonkes/{id}.promoImagenes = [{ url, titulo }].
export default function PromoImagenesEditor({ yonkeId, promos, onChange }) {
  const [tituloNuevo, setTituloNuevo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [titulosEditados, setTitulosEditados] = useState({}); // índice -> texto en edición

  const tituloValido = validarTituloPromo(tituloNuevo);
  const alMaximo = promos.length >= PROMOS_MAX;

  async function guardarLista(nuevas) {
    const v = validarPromosParaGuardar(nuevas);
    if (!v.ok) throw new Error(v.error);
    await updateDoc(doc(db, 'yonkes', yonkeId), { promoImagenes: nuevas });
    onChange(nuevas);
  }

  async function ejecutar(operacion) {
    setError('');
    setOcupado(true);
    try {
      await operacion();
    } catch (e) {
      console.error(e);
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  }

  function agregar(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (alMaximo) { setError(`Ya tienes ${PROMOS_MAX} promociones. Elimina una para agregar otra.`); return; }
    if (!tituloValido.ok) { setError(tituloValido.error); return; }
    const errorArchivo = validarArchivoPromo(file);
    if (errorArchivo) { setError(errorArchivo); return; }
    ejecutar(async () => {
      const url = await subirPromoYonke(yonkeId, file);
      try {
        await guardarLista([...promos, { url, titulo: tituloValido.titulo }]);
      } catch (e) {
        await borrarPromoPorUrl(url).catch(() => {}); // no dejar el archivo huérfano si no se pudo guardar
        throw e;
      }
      setTituloNuevo('');
    });
  }

  function reemplazar(indice, e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const errorArchivo = validarArchivoPromo(file);
    if (errorArchivo) { setError(errorArchivo); return; }
    ejecutar(async () => {
      const anterior = promos[indice].url;
      const url = await subirPromoYonke(yonkeId, file);
      try {
        await guardarLista(promos.map((p, i) => (i === indice ? { ...p, url } : p)));
      } catch (err) {
        await borrarPromoPorUrl(url).catch(() => {});
        throw err;
      }
      await borrarPromoPorUrl(anterior).catch((err) => console.error('No se pudo borrar la imagen anterior', err));
    });
  }

  function eliminar(indice) {
    if (!confirm('¿Eliminar esta promoción? La imagen se borra y deja de mostrarse en tu página.')) return;
    ejecutar(async () => {
      const anterior = promos[indice].url;
      await guardarLista(promos.filter((_, i) => i !== indice));
      await borrarPromoPorUrl(anterior).catch((err) => console.error('No se pudo borrar la imagen', err));
    });
  }

  function guardarTitulo(indice) {
    const v = validarTituloPromo(titulosEditados[indice]);
    if (!v.ok) { setError(v.error); return; }
    ejecutar(async () => {
      await guardarLista(promos.map((p, i) => (i === indice ? { ...p, titulo: v.titulo } : p)));
      setTitulosEditados(({ [indice]: _quitado, ...resto }) => resto);
    });
  }

  return (
    <div>
      <p style={notaStyle}>
        Sube hasta {PROMOS_MAX} imágenes de ofertas. Al tocar una, tu cliente te escribe por WhatsApp
        preguntando por esa promoción. La imagen se reduce sola (máx. 1200 px, menos de 300 KB).
      </p>

      {promos.map((p, i) => {
        const enEdicion = titulosEditados[i] !== undefined;
        const textoTitulo = enEdicion ? titulosEditados[i] : p.titulo;
        return (
          <div key={p.url} style={filaStyle}>
            <img src={p.url} alt={p.titulo} loading="lazy" style={miniaturaStyle} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                type="text"
                value={textoTitulo}
                maxLength={PROMO_TITULO_MAX}
                onChange={(e) => setTitulosEditados((prev) => ({ ...prev, [i]: e.target.value }))}
                disabled={ocupado}
                aria-label="Título de la promoción"
                style={inputStyle}
              />
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {enEdicion && textoTitulo.trim() !== p.titulo && (
                  <button type="button" onClick={() => guardarTitulo(i)} disabled={ocupado} style={botonPrincipalStyle}>
                    Guardar título
                  </button>
                )}
                <label style={{ ...botonSecundarioStyle, opacity: ocupado ? 0.5 : 1, cursor: ocupado ? 'wait' : 'pointer' }}>
                  Reemplazar imagen
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => reemplazar(i, e)} disabled={ocupado} style={{ display: 'none' }} />
                </label>
                <button type="button" onClick={() => eliminar(i)} disabled={ocupado} style={botonEliminarStyle}>Eliminar</button>
              </div>
            </div>
          </div>
        );
      })}

      {alMaximo ? (
        <p style={{ ...notaStyle, color: '#1A3C5E', fontWeight: 'bold' }}>
          Ya tienes {PROMOS_MAX} promociones. Elimina una para agregar otra.
        </p>
      ) : (
        <div style={{ marginTop: promos.length ? '14px' : 0 }}>
          <p style={labelStyle}>Título de la nueva promoción *</p>
          <input
            type="text"
            value={tituloNuevo}
            maxLength={PROMO_TITULO_MAX}
            onChange={(e) => setTituloNuevo(e.target.value)}
            placeholder="Ej. 20% en alternadores"
            disabled={ocupado}
            style={inputStyle}
          />
          <p style={{ ...notaStyle, margin: '-4px 0 8px' }}>{tituloNuevo.trim().length}/{PROMO_TITULO_MAX} — es lo que se dice en el mensaje de WhatsApp.</p>
          <label style={{
            ...botonPrincipalStyle, display: 'block', textAlign: 'center',
            opacity: !tituloValido.ok || ocupado ? 0.5 : 1,
            cursor: ocupado ? 'wait' : (!tituloValido.ok ? 'not-allowed' : 'pointer'),
          }}>
            {ocupado ? 'Procesando...' : 'Elegir imagen y guardar'}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={agregar} disabled={!tituloValido.ok || ocupado} style={{ display: 'none' }} />
          </label>
          {!tituloValido.ok && tituloNuevo.length === 0 && (
            <p style={{ ...notaStyle, marginTop: '6px' }}>Primero escribe el título para poder elegir la imagen.</p>
          )}
        </div>
      )}

      {error && <p role="alert" style={{ color: '#C0392B', fontSize: '13px', marginTop: '10px' }}>{error}</p>}
    </div>
  );
}

const notaStyle = { fontSize: '13px', color: '#666', margin: '0 0 12px', lineHeight: '1.5' };
const labelStyle = { fontSize: '13px', color: '#666', margin: '0 0 6px' };
const inputStyle = {
  width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd',
  fontSize: '14px', backgroundColor: '#F4F5F5', color: '#333', boxSizing: 'border-box', marginBottom: '8px',
};
const filaStyle = { display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px 0', borderTop: '1px solid #F4F5F5' };
const miniaturaStyle = { width: '88px', height: '66px', objectFit: 'cover', borderRadius: '8px', backgroundColor: '#F4F5F5', flexShrink: 0 };
const botonPrincipalStyle = {
  padding: '10px 14px', borderRadius: '8px', border: 'none', backgroundColor: '#E8720C',
  color: '#fff', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer',
};
const botonSecundarioStyle = {
  padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #1A3C5E', backgroundColor: '#fff',
  color: '#1A3C5E', fontWeight: 'bold', fontSize: '13px', display: 'inline-block',
};
const botonEliminarStyle = {
  padding: '10px 14px', borderRadius: '8px', border: 'none', backgroundColor: '#fff',
  color: '#D85A30', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer',
};
