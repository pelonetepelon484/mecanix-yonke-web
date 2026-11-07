'use client';

import { useEffect, useRef, useState } from 'react';
import { leerConfigContactos } from './config';
import { buscarContactos, listarContactos } from './datos';
import { coincide, nombreVehiculoContacto, sugerenciasDe } from '../../../../lib/contactosTaller';

const MAX_SUGERENCIAS = 5;
const MIN_LETRAS = 2;

// Autocompletar desde la libreta de contactos, debajo del campo "Nombre" de una cita, cotización u
// orden. Solo aparece con config/contactos.habilitado == true. Lee los contactos una sola vez
// (primeros 50, A-Z) al escribir 2 letras y filtra en pantalla; si el taller tiene más, busca en
// Firestore (inicio del nombre, WhatsApp o placas) un momento después de dejar de escribir.
// Solo después de que el taller escribe (al abrir algo ya guardado no sale nada).
// onElegir(contacto, vehiculo|null): el formulario llena sus campos. Si algo falla, no se muestra
// nada y el formulario sigue igual.
export default function SugerenciasContactos({ tallerId, texto, onElegir }) {
  const [habilitado, setHabilitado] = useState(false);
  const [primeros, setPrimeros] = useState(null); // { items, hayMas }
  const [remotos, setRemotos] = useState([]);
  const [elegido, setElegido] = useState(null);
  const pidiendo = useRef(false);
  const [textoInicial] = useState(() => (texto ?? '').trim());

  useEffect(() => {
    let cancelado = false;
    leerConfigContactos()
      .then((c) => { if (!cancelado) setHabilitado(c?.habilitado === true); })
      .catch(() => {});
    return () => { cancelado = true; };
  }, []);

  const t = (texto ?? '').trim();
  const activo = habilitado && Boolean(tallerId) && t.length >= MIN_LETRAS && t !== elegido && t !== textoInicial;

  useEffect(() => {
    if (!activo || primeros || pidiendo.current) return;
    pidiendo.current = true;
    listarContactos(tallerId)
      .then((r) => setPrimeros({ items: r.items, hayMas: r.hayMas }))
      .catch((err) => { console.error(err); setPrimeros({ items: [], hayMas: false }); });
  }, [activo, primeros, tallerId]);

  useEffect(() => {
    if (!activo || !primeros?.hayMas) return undefined;
    let cancelado = false;
    const espera = setTimeout(() => {
      buscarContactos(tallerId, t)
        .then((r) => { if (!cancelado) setRemotos(r); })
        .catch(() => {});
    }, 400);
    return () => { cancelado = true; clearTimeout(espera); };
  }, [activo, primeros, tallerId, t]);

  if (!activo || !primeros) return null;
  const vistos = new Set();
  const encontrados = [...primeros.items.filter((c) => coincide(c, t)), ...remotos]
    .filter((c) => (vistos.has(c.id) ? false : vistos.add(c.id)));
  const opciones = encontrados.flatMap(sugerenciasDe).slice(0, MAX_SUGERENCIAS);
  if (opciones.length === 0) return null;

  return (
    <div role="listbox" aria-label="Sugerencias de tus contactos" style={caja}>
      <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#555' }}>📇 De tus contactos:</p>
      {opciones.map(({ contacto, vehiculo, clave }) => (
        <button
          key={clave}
          type="button"
          role="option"
          aria-selected="false"
          onClick={() => { setElegido(contacto.nombre); onElegir(contacto, vehiculo); }}
          style={opcion}
        >
          <strong style={{ color: '#1A3C5E' }}>{contacto.nombre}</strong>
          {vehiculo && <span style={{ display: 'block', fontSize: '13px', color: '#555' }}>🚗 {nombreVehiculoContacto(vehiculo)}</span>}
        </button>
      ))}
    </div>
  );
}

const caja = { border: '1px solid #D7DEE6', borderRadius: '12px', padding: '8px', margin: '-4px 0 10px', backgroundColor: '#F7F9FB' };
const opcion = { display: 'block', width: '100%', textAlign: 'left', minHeight: '44px', padding: '8px 10px', borderRadius: '10px', border: '1px solid #E3E3E3', backgroundColor: '#fff', cursor: 'pointer', marginBottom: '6px', fontSize: '14px' };
