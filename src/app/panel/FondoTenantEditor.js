'use client';

import { useState } from 'react';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { subirFondoTenant, borrarFondoPorUrl, validarArchivoFondo } from '../lib/fondoTenantStorage';

function mensajeDeError(error) {
  if (error?.code === 'storage/unauthorized' || error?.code === 'permission-denied') {
    return 'No tienes permiso para guardar esta imagen. Avísale a Mecanix.';
  }
  return error?.message || 'No se pudo completar la operación. Intenta de nuevo.';
}

// Imagen de fondo de la franja superior del sitio con subdominio (yonkes/{id}.branding.fondoUrl).
// Sin imagen, la franja sigue mostrando colorPrimario tal cual — esto es puramente opcional.
// colorPrimario se recibe del llamador (mismo color que ya elige en "Color de tu página") para
// que la vista previa se vea igual que la franja real.
export default function FondoTenantEditor({ yonkeId, fondoUrl, colorPrimario, onChange }) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  async function guardarFondoUrl(url) {
    await updateDoc(doc(db, 'yonkes', yonkeId), { 'branding.fondoUrl': url === null ? deleteField() : url });
    onChange(url);
  }

  async function manejarSeleccion(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const errorArchivo = validarArchivoFondo(file);
    if (errorArchivo) { setError(errorArchivo); return; }
    setError('');
    setOcupado(true);
    try {
      const anterior = fondoUrl;
      const url = await subirFondoTenant(yonkeId, file);
      try {
        await guardarFondoUrl(url);
      } catch (e) {
        await borrarFondoPorUrl(url).catch(() => {}); // no dejar el archivo huérfano si no se pudo guardar
        throw e;
      }
      if (anterior) await borrarFondoPorUrl(anterior).catch((err) => console.error('No se pudo borrar el fondo anterior', err));
    } catch (e) {
      console.error(e);
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  }

  async function quitarFondo() {
    if (!fondoUrl) return;
    setError('');
    setOcupado(true);
    try {
      const anterior = fondoUrl;
      await guardarFondoUrl(null);
      await borrarFondoPorUrl(anterior).catch((err) => console.error('No se pudo borrar el fondo', err));
    } catch (e) {
      console.error(e);
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div>
      <p style={notaStyle}>
        Reemplaza el color sólido de la parte de arriba de tu página por una imagen (por ejemplo, tu
        yonke, tu equipo o autopartes). Tamaño ideal: <strong>1920 × 400 px, horizontal</strong>. En
        celular se ve principalmente el centro de la imagen, cuida que lo importante quede ahí.
      </p>

      {/* Vista previa: mismo alto/estilo que la franja real del sitio. */}
      <div style={{
        ...previewBaseStyle,
        backgroundColor: colorPrimario,
        ...(fondoUrl ? { backgroundImage: `url(${fondoUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' } : {}),
      }}>
        {!fondoUrl && <span style={previewSinImagenTextoStyle}>Sin imagen — se usa el color de tu página</span>}
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
        <label style={{ ...botonPrincipalStyle, opacity: ocupado ? 0.5 : 1, cursor: ocupado ? 'wait' : 'pointer' }}>
          {ocupado ? 'Procesando...' : (fondoUrl ? 'Reemplazar imagen' : 'Subir imagen')}
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={manejarSeleccion} disabled={ocupado} style={{ display: 'none' }} />
        </label>
        {fondoUrl && (
          <button type="button" onClick={quitarFondo} disabled={ocupado} style={botonEliminarStyle}>
            Quitar imagen
          </button>
        )}
      </div>

      {error && <p role="alert" style={{ color: '#C0392B', fontSize: '13px', margin: '10px 0 0' }}>{error}</p>}
    </div>
  );
}

const notaStyle = { fontSize: '13px', color: '#666', margin: '0 0 12px', lineHeight: '1.5' };
const previewBaseStyle = {
  width: '100%', height: '110px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const previewSinImagenTextoStyle = { color: 'rgba(255,255,255,0.85)', fontSize: '12px', fontWeight: '600', textAlign: 'center', padding: '0 16px' };
const botonPrincipalStyle = {
  padding: '10px 14px', borderRadius: '8px', border: 'none', backgroundColor: '#E8720C',
  color: '#fff', fontWeight: 'bold', fontSize: '13px', display: 'inline-block',
};
const botonEliminarStyle = {
  padding: '10px 14px', borderRadius: '8px', border: 'none', backgroundColor: '#fff',
  color: '#D85A30', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer',
};
