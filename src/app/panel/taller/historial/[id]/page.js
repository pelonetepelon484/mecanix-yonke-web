'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useHistorial } from '../contexto';
import { borrarVehiculo, leerVehiculo, telefonoDeOrden } from '../datos';
import { enlaceWhatsappHistorial, mensajeWhatsappHistorial, nombreVehiculo } from '../../../../../lib/historialTaller';
import { fechaLarga, kmTexto } from '../formato';

// Detalle de un vehículo: sus servicios (del más reciente al más antiguo), WhatsApp y borrar.
// WhatsApp: el teléfono se lee de la orden ultimoFolio EN ESE MOMENTO; si ya no existe, abre sin
// número y el taller elige el contacto. El teléfono nunca se guarda en el historial.
export default function DetalleVehiculoPage() {
  const { id } = useParams();
  const router = useRouter();
  const { tallerId, taller } = useHistorial();
  const [vehiculo, setVehiculo] = useState(undefined);
  const [aviso, setAviso] = useState('');
  const [abriendo, setAbriendo] = useState(false);
  const [borrando, setBorrando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    leerVehiculo(tallerId, id)
      .then((v) => { if (!cancelado) setVehiculo(v); })
      .catch((err) => { console.error(err); if (!cancelado) { setVehiculo(null); setAviso('No pudimos cargar este vehículo.'); } });
    return () => { cancelado = true; };
  }, [tallerId, id]);

  async function abrirWhatsapp() {
    setAbriendo(true);
    try {
      const telefono = await telefonoDeOrden(tallerId, vehiculo.ultimoFolio);
      const enlace = enlaceWhatsappHistorial(telefono, mensajeWhatsappHistorial(taller?.nombre || '', vehiculo));
      // Misma pestaña: abrir una ventana nueva después de esperar la lectura lo bloquean los celulares.
      if (!telefono) setAviso('La orden ya no tiene el teléfono del cliente: elige el contacto en WhatsApp.');
      window.location.href = enlace;
    } finally {
      setAbriendo(false);
    }
  }

  async function borrar() {
    if (!window.confirm(`¿Borrar el vehículo ${vehiculo.placas} con todo su historial? Esto no se puede deshacer.`)) return;
    setBorrando(true);
    try {
      await borrarVehiculo(tallerId, id);
      router.push('/panel/taller/historial');
    } catch (err) {
      console.error(err);
      setAviso('No pudimos borrar el vehículo. Intenta de nuevo.');
      setBorrando(false);
    }
  }

  if (vehiculo === undefined) return <main style={{ padding: '24px' }}><p style={{ color: '#555' }}>Cargando...</p></main>;
  if (vehiculo === null) {
    return (
      <main style={{ padding: '24px' }}>
        <p style={{ color: '#555' }}>{aviso || 'Este vehículo ya no está en tu historial.'}</p>
        <button type="button" onClick={() => router.push('/panel/taller/historial')}>Volver al historial</button>
      </main>
    );
  }

  const servicios = [...(vehiculo.servicios || [])].reverse();
  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '16px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <button type="button" onClick={() => router.push('/panel/taller/historial')} style={volver}>← Historial</button>
        <h1 style={{ fontSize: '22px', color: '#1A3C5E', margin: '8px 0 2px' }}>{vehiculo.placas}</h1>
        <p style={{ margin: '0 0 6px', color: '#333' }}>{nombreVehiculo(vehiculo)} · {kmTexto(vehiculo.ultimoKm)}</p>
        {vehiculo.expiraAt && (
          <p style={{ fontSize: '13px', color: '#8A2A1A', margin: '0 0 12px' }}>Se borrará el {fechaLarga(vehiculo.expiraAt)} si no le agregas otro servicio.</p>
        )}
        {aviso && <p role="status" style={{ fontSize: '14px', color: '#1A3C5E' }}>{aviso}</p>}

        <button type="button" onClick={abrirWhatsapp} disabled={abriendo} style={botonWhatsapp}>
          {abriendo ? 'Abriendo...' : '💬 Escribir por WhatsApp'}
        </button>

        <h2 style={{ fontSize: '16px', color: '#1A3C5E', margin: '18px 0 8px' }}>Servicios</h2>
        {servicios.map((s) => (
          <div key={s.folio} style={tarjeta}>
            <p style={{ margin: 0, fontWeight: 'bold', color: '#1A3C5E' }}>{fechaLarga(s.fecha)}</p>
            <p style={{ margin: '2px 0', fontSize: '13px', color: '#555' }}>Orden {s.folio} · {kmTexto(s.kilometraje)}</p>
            {s.descripcion && <p style={{ margin: '6px 0 0', fontSize: '14px', color: '#333' }}>{s.descripcion}</p>}
            {s.piezas?.length > 0 && <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#555' }}>Piezas: {s.piezas.join(', ')}</p>}
          </div>
        ))}

        <button type="button" onClick={borrar} disabled={borrando} style={botonBorrar}>
          {borrando ? 'Borrando...' : 'Borrar vehículo'}
        </button>
      </div>
    </main>
  );
}

const volver = { background: 'none', border: 'none', color: '#1A3C5E', fontWeight: '600', cursor: 'pointer', padding: 0, fontSize: '14px' };
const tarjeta = { backgroundColor: '#fff', border: '1px solid #E3E3E3', borderRadius: '14px', padding: '12px 14px', marginBottom: '10px' };
const botonWhatsapp = { width: '100%', minHeight: '52px', borderRadius: '12px', border: 'none', backgroundColor: '#25D366', color: '#fff', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' };
const botonBorrar = { width: '100%', minHeight: '48px', borderRadius: '12px', border: '1px solid #B3261E', backgroundColor: '#fff', color: '#B3261E', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', margin: '16px 0 24px' };
