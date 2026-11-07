'use client';

import { useState } from 'react';
import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { SITIO_OFICIAL } from '../../../lib/sitioOficial';
import { whatsappHref } from '../../../lib/whatsapp';
import { COLECCION_CHECKINS, COLECCION_UBICACIONES, enlaceAqui, mensajeEnlaceAqui } from '../../../lib/ubicacionAsistencia';

// Secreto del enlace "Estoy aquí": 32 bytes al azar en base64url (43 caracteres). Solo se guarda
// su huella (SHA-256 en hex): si se pierde el enlace, se crea otro.
export function generarSecreto(bytes = crypto.getRandomValues(new Uint8Array(32))) {
  let texto = '';
  bytes.forEach((b) => { texto += String.fromCharCode(b); });
  return btoa(texto).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function huellaDe(secreto) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secreto));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Quita los enlaces viejos del proveedor y, si se pide, también su punto del mapa.
export async function desactivarEnlaces(proveedorId, { quitarDelMapa = true } = {}) {
  const viejos = await getDocs(query(collection(db, COLECCION_CHECKINS), where('proveedorId', '==', proveedorId)));
  await Promise.all(viejos.docs.map((d) => deleteDoc(d.ref)));
  if (quitarDelMapa) await deleteDoc(doc(db, COLECCION_UBICACIONES, proveedorId));
  return viejos.size;
}

// Enlace privado "Estoy aquí" de un proveedor: crear (reemplaza el anterior), copiar, mandar por
// WhatsApp y desactivar. El enlace solo se ve al crearlo: no se guarda.
export default function EnlaceAqui({ p }) {
  const [enlace, setEnlace] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [trabajando, setTrabajando] = useState(false);

  async function crear() {
    if (!window.confirm(`¿Crear un enlace "Estoy aquí" nuevo para ${p.nombre}? Si tenía uno, deja de servir.`)) return;
    setTrabajando(true); setMensaje('');
    try {
      await desactivarEnlaces(p.id, { quitarDelMapa: false });
      const secreto = generarSecreto();
      await setDoc(doc(db, COLECCION_CHECKINS, await huellaDe(secreto)), { proveedorId: p.id, creadoAt: serverTimestamp() });
      setEnlace(enlaceAqui(SITIO_OFICIAL, secreto));
    } catch (err) {
      console.error('[admin/asistencia-vial] crear enlace', err?.code || err?.message);
      setMensaje('No se pudo crear el enlace. Revisa tu conexión.');
    } finally {
      setTrabajando(false);
    }
  }

  async function desactivar() {
    if (!window.confirm(`¿Desactivar el enlace de ${p.nombre}? También se quita del mapa.`)) return;
    setTrabajando(true); setMensaje('');
    try {
      const n = await desactivarEnlaces(p.id);
      setEnlace('');
      setMensaje(n > 0 ? 'Enlace desactivado y proveedor quitado del mapa.' : 'No tenía enlace activo. Se quitó del mapa por si acaso.');
    } catch (err) {
      console.error('[admin/asistencia-vial] desactivar enlace', err?.code || err?.message);
      setMensaje('No se pudo desactivar. Revisa tu conexión.');
    } finally {
      setTrabajando(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace);
      setMensaje('Enlace copiado.');
    } catch {
      setMensaje('No se pudo copiar: selecciónalo y cópialo a mano.');
    }
  }

  const wa = enlace ? whatsappHref(p.whatsapp || p.telefono, mensajeEnlaceAqui(p.nombre, enlace)) : null;

  return (
    <div style={{ marginTop: '10px', padding: '10px', borderRadius: '10px', backgroundColor: '#F7F9FB', border: '1px solid #E3EAF2' }}>
      <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: '700', color: '#1A3C5E' }}>📍 Enlace "Estoy aquí" (mapa)</p>
      {enlace && (
        <>
          <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#555' }}>Guárdalo o mándalo ahora: después ya no se puede volver a ver.</p>
          <input readOnly value={enlace} aria-label="Enlace Estoy aquí" onFocus={(e) => e.target.select()} style={{ width: '100%', boxSizing: 'border-box', padding: '8px', fontSize: '12px', borderRadius: '8px', border: '1px solid #ccc' }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
            <button type="button" onClick={copiar} style={boton}>Copiar</button>
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" style={{ ...boton, textDecoration: 'none', display: 'inline-block' }}>Enviar por WhatsApp</a>}
          </div>
        </>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: enlace ? '8px' : 0 }}>
        <button type="button" disabled={trabajando} onClick={crear} style={boton}>{enlace ? 'Crear otro' : 'Crear enlace'}</button>
        <button type="button" disabled={trabajando} onClick={desactivar} style={{ ...boton, borderColor: '#B3261E', color: '#B3261E' }}>Desactivar enlace</button>
      </div>
      {mensaje && <p role="status" style={{ margin: '8px 0 0', fontSize: '13px', color: '#1A3C5E' }}>{mensaje}</p>}
    </div>
  );
}

const boton = { background: 'none', border: '1px solid #1A3C5E', borderRadius: '10px', color: '#1A3C5E', fontWeight: '600', fontSize: '13px', padding: '8px 12px', cursor: 'pointer' };
