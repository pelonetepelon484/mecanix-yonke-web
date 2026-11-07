'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { leerConfigContactos } from './config';
import { buscarContactos, crearContacto } from './datos';
import { esPremiumVigente } from '../../../../lib/planes';
import { MENSAJES_INTEGRACION_CONTACTO, contactoDesdeDatos, validarContacto } from '../../../../lib/contactosTaller';

// Botón "📇 Guardar en mis contactos" para el detalle de una cita, cotización u orden.
// Solo aparece con config/contactos.habilitado == true, si el taller puede escribir (términos
// vigentes y taller activo) y si hay nombre del cliente. Si ya hay un contacto con el mismo
// WhatsApp, no crea otro: avisa y deja abrirlo. En Básico respeta el tope de 25 (mismo mensaje
// que la libreta). datos: { nombre, telefono, vehiculo: { marca, modelo, anio, placas } }.
export default function GuardarComoContacto({ tallerId, taller, puedeEscribir, datos }) {
  const router = useRouter();
  const [habilitado, setHabilitado] = useState(false);
  const [estado, setEstado] = useState({ ocupado: false, mensaje: '', error: '', id: null });

  useEffect(() => {
    let cancelado = false;
    leerConfigContactos()
      .then((c) => { if (!cancelado) setHabilitado(c?.habilitado === true); })
      .catch(() => {});
    return () => { cancelado = true; };
  }, []);

  const escrito = contactoDesdeDatos(datos ?? {});
  if (!habilitado || !puedeEscribir || !escrito.nombre) return null;

  async function guardar() {
    const r = validarContacto(escrito);
    if (!r.ok) { setEstado({ ocupado: false, mensaje: '', error: r.mensaje, id: null }); return; }
    setEstado({ ocupado: true, mensaje: '', error: '', id: null });
    try {
      if (r.datos.telefono) {
        const iguales = await buscarContactos(tallerId, r.datos.telefono);
        if (iguales.length > 0) {
          setEstado({ ocupado: false, mensaje: MENSAJES_INTEGRACION_CONTACTO.yaExiste, error: '', id: iguales[0].id });
          return;
        }
      }
      const id = await crearContacto({ tallerId, datos: r.datos, premium: esPremiumVigente(taller) });
      setEstado({ ocupado: false, mensaje: MENSAJES_INTEGRACION_CONTACTO.guardado, error: '', id });
    } catch (err) {
      setEstado({ ocupado: false, mensaje: '', error: err?.message || 'No pudimos guardar el contacto. Intenta de nuevo.', id: null });
    }
  }

  return (
    <div style={{ margin: '0 0 12px' }}>
      {estado.id ? (
        <p role="status" style={{ fontSize: '14px', color: '#1E6B34', margin: 0 }}>
          ✓ {estado.mensaje}{' '}
          <button type="button" onClick={() => router.push(`/panel/taller/contactos/${estado.id}`)} style={enlace}>Ver contacto</button>
        </p>
      ) : (
        <button type="button" onClick={guardar} disabled={estado.ocupado} style={boton}>
          {estado.ocupado ? 'Guardando...' : '📇 Guardar en mis contactos'}
        </button>
      )}
      {estado.error && <p role="alert" style={{ color: '#B3261E', fontSize: '14px', margin: '6px 0 0' }}>{estado.error}</p>}
    </div>
  );
}

const boton = { width: '100%', minHeight: '48px', borderRadius: '12px', border: '1px dashed #1A3C5E', backgroundColor: '#fff', color: '#1A3C5E', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' };
const enlace = { background: 'none', border: 'none', padding: 0, color: '#1A3C5E', fontWeight: 'bold', textDecoration: 'underline', cursor: 'pointer', fontSize: '14px' };
