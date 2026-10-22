'use client';

// Enlaces de seguimiento: el admin pega un enlace que le reportaron, la página calcula la huella
// del token EN EL NAVEGADOR (el token no se manda a ningún lado), muestra lo que ve el público y
// permite "Desactivar" (borra seguimientos/{huella}). Solo admin (admin/layout.js y las reglas).
// Costo: 1 lectura por búsqueda; 1 borrado por "Desactivar".
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { huellaSeguimiento, seguimientoPublico, tokenDeEnlace } from '../../../lib/seguimiento';

const tarjeta = { backgroundColor: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '12px' };
const volver = { background: 'none', border: 'none', color: '#1A3C5E', fontSize: '14px', cursor: 'pointer', padding: 0 };
const boton = { padding: '10px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#1A3C5E', color: '#fff', fontWeight: '600', fontSize: '14px', cursor: 'pointer' };

export default function AdminSeguimientos() {
  const router = useRouter();
  const [enlace, setEnlace] = useState('');
  const [resultado, setResultado] = useState(null); // { huella, datos | null }
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function buscar(e) {
    e.preventDefault();
    setMensaje(''); setResultado(null);
    const token = tokenDeEnlace(enlace);
    if (!token) { setMensaje('Ese no parece un enlace de seguimiento (…/seguimiento/ y 43 caracteres).'); return; }
    setOcupado(true);
    try {
      const huella = await huellaSeguimiento(token);
      const snap = await getDoc(doc(db, 'seguimientos', huella));
      setResultado({ huella, datos: snap.exists() ? snap.data() : null });
    } catch (err) {
      console.error('[admin/seguimientos] No se pudo buscar', err);
      setMensaje('No se pudo buscar. Revisa tu conexión y tus permisos de admin.');
    } finally {
      setOcupado(false);
    }
  }

  async function desactivar() {
    if (!window.confirm('¿Desactivar este enlace? Quien lo tenga ya no podrá abrirlo. El taller puede activar uno nuevo.')) return;
    setOcupado(true);
    try {
      await deleteDoc(doc(db, 'seguimientos', resultado.huella));
      setResultado({ ...resultado, datos: null });
      setMensaje('Enlace desactivado.');
    } catch (err) {
      console.error('[admin/seguimientos] No se pudo desactivar', err);
      setMensaje('No se pudo desactivar. Revisa tu conexión y tus permisos de admin.');
    } finally {
      setOcupado(false);
    }
  }

  const publico = resultado?.datos ? seguimientoPublico(resultado.datos) : null;

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F0F2F5', padding: '24px 16px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <button type="button" onClick={() => router.push('/admin')} style={volver}>← Volver al admin</button>
        <h1 style={{ fontSize: '22px', color: '#1A3C5E', margin: '8px 0 4px' }}>Enlaces de seguimiento</h1>
        <p style={{ fontSize: '13px', color: '#666', margin: '0 0 16px' }}>
          Pega el enlace que te reportaron. La huella se calcula en tu navegador; el enlace no se guarda ni se envía.
        </p>
        <form onSubmit={buscar} style={tarjeta}>
          <label htmlFor="enlace" style={{ display: 'block', fontSize: '14px', color: '#1A3C5E', marginBottom: '6px' }}>Enlace de seguimiento</label>
          <input
            id="enlace" value={enlace} onChange={(e) => setEnlace(e.target.value)} autoComplete="off"
            placeholder="https://www.mecanixyonkevirtual.com/seguimiento/..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #CCC', fontSize: '14px', marginBottom: '10px' }}
          />
          <button type="submit" disabled={ocupado} style={boton}>Buscar</button>
        </form>
        {mensaje && <p role="status" style={{ color: '#1A3C5E', fontSize: '14px' }}>{mensaje}</p>}
        {resultado && !resultado.datos && !mensaje && (
          <p role="status" style={{ color: '#555', fontSize: '14px' }}>Ese enlace no está activo (no existe, ya venció o se desactivó).</p>
        )}
        {resultado?.datos && (
          <div style={tarjeta} data-testid="resultado-seguimiento">
            <p style={{ margin: '0 0 8px', fontWeight: '700', color: '#1A3C5E' }}>Lo que ve el público</p>
            {publico ? (
              <ul style={{ margin: '0 0 12px', paddingLeft: '18px', fontSize: '14px', color: '#333', lineHeight: 1.6 }}>
                <li>Taller: {publico.tallerNombre}</li>
                <li>Vehículo: {[publico.marca, publico.modelo, publico.anio].filter(Boolean).join(' ')}</li>
                <li>Estado: {publico.estadoNombre}</li>
                <li>Nota: {publico.nota || '(sin nota)'}</li>
                <li>Última actualización: {publico.actualizadoAt ? new Date(publico.actualizadoAt).toLocaleString('es-MX') : '—'}</li>
              </ul>
            ) : (
              <p style={{ fontSize: '14px', color: '#555', margin: '0 0 12px' }}>Ya venció: el público ve «no encontrado». Se borrará solo.</p>
            )}
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 12px' }}>Solo para admin: taller {String(resultado.datos.tallerId)} · folio {String(resultado.datos.folio)}</p>
            <button type="button" onClick={desactivar} disabled={ocupado} style={{ ...boton, backgroundColor: '#B3261E' }}>Desactivar</button>
          </div>
        )}
      </div>
    </main>
  );
}
