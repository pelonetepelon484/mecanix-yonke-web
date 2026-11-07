'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCitas } from '../contexto';
import { borrarCita, cambiarEstadoCita, guardarCita, leerCita } from '../datos';
import CitaForm from '../CitaForm';
import {
  MENSAJES_CITA, NOMBRES_ESTADO_CITA, enlaceRecordatorioCita, expiraCita, fechaDeCita, textoDia, textoHora,
} from '../../../../../lib/citasTaller';

const fechaLarga = (d) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

// Detalle de una cita: datos, recordatorio por WhatsApp (con el mensaje ya escrito), cambiar el
// estado y editar (si puede escribir) y borrar (siempre).
export default function DetalleCitaPage() {
  const { id } = useParams();
  const router = useRouter();
  const { tallerId, taller, puedeEscribir } = useCitas();
  const [cita, setCita] = useState(undefined);
  const [editando, setEditando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let cancelado = false;
    leerCita(tallerId, id)
      .then((c) => { if (!cancelado) setCita(c); })
      .catch((err) => { console.error(err); if (!cancelado) { setCita(null); setAviso('No pudimos cargar esta cita.'); } });
    return () => { cancelado = true; };
  }, [tallerId, id, recarga]);

  async function guardar(datos) {
    await guardarCita({ tallerId, id, datos });
    setEditando(false);
    setRecarga((n) => n + 1);
  }

  async function cambiarEstado(estado) {
    setOcupado(true); setAviso('');
    try {
      await cambiarEstadoCita({ tallerId, id, estado });
      setCita((c) => ({ ...c, estado }));
    } catch (err) {
      setAviso(err.message);
    } finally {
      setOcupado(false);
    }
  }

  async function borrar() {
    if (!window.confirm(`¿Borrar la cita de ${cita.nombre}? Esto no se puede deshacer.`)) return;
    setOcupado(true);
    try {
      await borrarCita(tallerId, id);
      router.push('/panel/taller/citas');
    } catch (err) {
      console.error(err);
      setAviso(MENSAJES_CITA.borrarFallo);
      setOcupado(false);
    }
  }

  const volverALista = <button type="button" onClick={() => router.push('/panel/taller/citas')} style={volver}>← Citas</button>;
  if (cita === undefined) return <main style={{ padding: '24px' }}><p style={{ color: '#555' }}>Cargando...</p></main>;
  if (cita === null) {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '16px' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>
          {volverALista}
          <p role="alert" style={{ color: '#555' }}>{aviso || 'Esta cita ya no existe.'}</p>
        </div>
      </main>
    );
  }

  const f = fechaDeCita(cita);
  const enlace = enlaceRecordatorioCita(cita.telefono, taller?.nombre || '', cita.nombre, f);
  const otrosEstados = ['confirmada', 'atendida', 'cancelada'].filter((s) => s !== cita.estado);

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '16px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        {volverALista}
        {editando ? (
          <>
            <h1 style={titulo}>Editar cita</h1>
            <CitaForm inicial={cita} textoBoton="Guardar cambios" onGuardar={guardar} />
            <button type="button" onClick={() => setEditando(false)} style={{ ...secundario, marginTop: '10px' }}>Cancelar</button>
          </>
        ) : (
          <>
            <h1 style={titulo}>{f ? `${textoDia(f)}, ${textoHora(f)}` : 'Cita'}</h1>
            <p style={{ ...linea, fontWeight: 'bold' }}>Estado: {NOMBRES_ESTADO_CITA[cita.estado] ?? cita.estado}</p>
            <p style={linea}>👤 {cita.nombre}</p>
            {cita.telefono && <p style={linea}>📱 {cita.telefono}</p>}
            {(cita.vehiculo || cita.placas) && <p style={linea}>🚗 {[cita.vehiculo, cita.placas].filter(Boolean).join(' · ')}</p>}
            {cita.motivo && <p style={{ ...linea, color: '#555', whiteSpace: 'pre-wrap' }}>{cita.motivo}</p>}
            {f && <p style={{ fontSize: '13px', color: '#8A2A1A', margin: '8px 0 14px' }}>Se borrará el {fechaLarga(expiraCita(f))}.</p>}
            {aviso && <p role="alert" style={{ color: '#B3261E' }}>{aviso}</p>}
            {enlace && (
              <a href={enlace} target="_blank" rel="noopener noreferrer" style={botonWhatsapp}>💬 Recordar por WhatsApp</a>
            )}
            {puedeEscribir && (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${otrosEstados.length}, 1fr)`, gap: '8px', margin: '0 0 10px' }}>
                {otrosEstados.map((s) => (
                  <button key={s} type="button" disabled={ocupado} onClick={() => cambiarEstado(s)} style={botonEstado}>
                    {NOMBRES_ESTADO_CITA[s]}
                  </button>
                ))}
              </div>
            )}
            {puedeEscribir && <button type="button" onClick={() => setEditando(true)} style={secundario}>Editar</button>}
            <button type="button" onClick={borrar} disabled={ocupado} style={botonBorrar}>Borrar cita</button>
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
const botonEstado = { minHeight: '48px', borderRadius: '12px', border: '1px solid #1A3C5E', backgroundColor: '#F4F7FA', color: '#1A3C5E', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' };
const secundario = { width: '100%', minHeight: '48px', borderRadius: '12px', border: '1px solid #1A3C5E', backgroundColor: '#fff', color: '#1A3C5E', fontWeight: 'bold', cursor: 'pointer', margin: '0 0 10px' };
const botonBorrar = { width: '100%', minHeight: '48px', borderRadius: '12px', border: '1px solid #B3261E', backgroundColor: '#fff', color: '#B3261E', fontWeight: 'bold', cursor: 'pointer' };
