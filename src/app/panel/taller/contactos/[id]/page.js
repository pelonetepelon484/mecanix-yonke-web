'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useContactos } from '../contexto';
import { borrarContacto, guardarContacto, leerContacto, marcarUsado } from '../datos';
import ContactoForm from '../ContactoForm';
import { MENSAJES_CONTACTO, enlaceWhatsappContacto, nombreVehiculoContacto } from '../../../../../lib/contactosTaller';

const fechaLarga = (v) => (v?.toDate ? v.toDate().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

// Detalle de un contacto: datos, WhatsApp (con el mensaje ya escrito; renueva la fecha de borrado),
// editar (si puede escribir) y borrar (siempre).
export default function DetalleContactoPage() {
  const { id } = useParams();
  const router = useRouter();
  const { tallerId, taller, puedeEscribir } = useContactos();
  const [contacto, setContacto] = useState(undefined);
  const [editando, setEditando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [borrando, setBorrando] = useState(false);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let cancelado = false;
    leerContacto(tallerId, id)
      .then((c) => { if (!cancelado) setContacto(c); })
      .catch((err) => { console.error(err); if (!cancelado) { setContacto(null); setAviso('No pudimos cargar este contacto.'); } });
    return () => { cancelado = true; };
  }, [tallerId, id, recarga]);

  async function guardar(datos) {
    await guardarContacto({ tallerId, id, datos });
    setEditando(false);
    setRecarga((n) => n + 1);
  }

  async function borrar() {
    if (!window.confirm(`¿Borrar el contacto ${contacto.nombre}? Esto no se puede deshacer.`)) return;
    setBorrando(true);
    try {
      await borrarContacto(tallerId, id);
      router.push('/panel/taller/contactos');
    } catch (err) {
      console.error(err);
      setAviso(MENSAJES_CONTACTO.borrarFallo);
      setBorrando(false);
    }
  }

  const volverALista = <button type="button" onClick={() => router.push('/panel/taller/contactos')} style={volver}>← Contactos</button>;
  if (contacto === undefined) return <main style={{ padding: '24px' }}><p style={{ color: '#555' }}>Cargando...</p></main>;
  if (contacto === null) {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '16px' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>
          {volverALista}
          <p role="alert" style={{ color: '#555' }}>{aviso || 'Este contacto ya no existe.'}</p>
        </div>
      </main>
    );
  }

  const enlace = enlaceWhatsappContacto(contacto.telefono, taller?.nombre || '', contacto.nombre);

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '16px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        {volverALista}
        {editando ? (
          <>
            <h1 style={titulo}>Editar contacto</h1>
            <ContactoForm inicial={contacto} textoBoton="Guardar cambios" onGuardar={guardar} />
            <button type="button" onClick={() => setEditando(false)} style={{ ...secundario, marginTop: '10px' }}>Cancelar</button>
          </>
        ) : (
          <>
            <h1 style={titulo}>{contacto.nombre}</h1>
            {contacto.telefono && <p style={linea}>📱 {contacto.telefono}</p>}
            {(contacto.vehiculos ?? []).map((v, i) => <p key={i} style={linea}>🚗 {nombreVehiculoContacto(v)}</p>)}
            {contacto.nota && <p style={{ ...linea, color: '#555', whiteSpace: 'pre-wrap' }}>{contacto.nota}</p>}
            {contacto.expiraAt && <p style={{ fontSize: '13px', color: '#8A2A1A', margin: '8px 0 14px' }}>Se borrará el {fechaLarga(contacto.expiraAt)} si no lo editas ni le escribes.</p>}
            {aviso && <p role="alert" style={{ color: '#B3261E' }}>{aviso}</p>}
            {enlace && (
              <a href={enlace} target="_blank" rel="noopener noreferrer" onClick={() => { if (puedeEscribir) marcarUsado(tallerId, id); }} style={botonWhatsapp}>
                💬 Escribir por WhatsApp
              </a>
            )}
            {puedeEscribir && <button type="button" onClick={() => setEditando(true)} style={secundario}>Editar</button>}
            <button type="button" onClick={borrar} disabled={borrando} style={botonBorrar}>{borrando ? 'Borrando...' : 'Borrar contacto'}</button>
          </>
        )}
      </div>
    </main>
  );
}

const volver = { background: 'none', border: 'none', color: '#1A3C5E', fontWeight: '600', cursor: 'pointer', padding: 0, fontSize: '14px' };
const titulo = { fontSize: '22px', color: '#1A3C5E', margin: '8px 0 10px' };
const linea = { margin: '4px 0', fontSize: '15px', color: '#1A3C5E' };
const botonWhatsapp = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', boxSizing: 'border-box', minHeight: '52px', borderRadius: '12px', backgroundColor: '#25D366', color: '#fff', fontSize: '16px', fontWeight: 'bold', textDecoration: 'none', margin: '0 0 10px' };
const secundario = { width: '100%', minHeight: '48px', borderRadius: '12px', border: '1px solid #1A3C5E', backgroundColor: '#fff', color: '#1A3C5E', fontWeight: 'bold', cursor: 'pointer', margin: '0 0 10px' };
const botonBorrar = { width: '100%', minHeight: '48px', borderRadius: '12px', border: '1px solid #B3261E', backgroundColor: '#fff', color: '#B3261E', fontWeight: 'bold', cursor: 'pointer' };
