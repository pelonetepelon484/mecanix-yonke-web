'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { cancelarSolicitud, elegirYonke, escucharRespuestas, leerSolicitud, leerWhatsappYonke } from '../datos';

const seccion = { backgroundColor: '#fff', borderRadius: '14px', padding: '16px', marginBottom: '14px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' };
const botonGrande = { minHeight: '48px', padding: '0 18px', borderRadius: '12px', border: 'none', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' };

export default function SolicitudPiezaDetalle() {
  const router = useRouter();
  const { id } = useParams();
  const [solicitud, setSolicitud] = useState(null);
  const [respuestas, setRespuestas] = useState([]);
  const [whatsappElegido, setWhatsappElegido] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');

  async function recargarSolicitud() {
    const s = await leerSolicitud(id);
    setSolicitud(s);
    setCargando(false);
    if (s?.yonkeElegido) {
      leerWhatsappYonke(s.yonkeElegido).then(setWhatsappElegido).catch(() => {});
    }
    return s;
  }

  useEffect(() => {
    if (!id) return;
    let cancelado = false;
    leerSolicitud(id).then((s) => {
      if (cancelado) return;
      setSolicitud(s);
      setCargando(false);
      if (s?.yonkeElegido) leerWhatsappYonke(s.yonkeElegido).then((w) => { if (!cancelado) setWhatsappElegido(w); }).catch(() => {});
    });
    const dejarDeEscuchar = escucharRespuestas(id, setRespuestas);
    return () => { cancelado = true; dejarDeEscuchar(); };
  }, [id]);

  async function elegir(yonkeId) {
    if (!confirm('¿Elegir a este yonke? Ya no podrás cambiarlo.')) return;
    setProcesando(true);
    setError('');
    try {
      await elegirYonke(id, yonkeId);
      await recargarSolicitud();
    } catch (err) {
      console.error(err);
      setError('No pudimos elegir a este yonke. Intenta de nuevo.');
    } finally {
      setProcesando(false);
    }
  }

  async function cancelar() {
    if (!confirm('¿Cancelar este pedido?')) return;
    setProcesando(true);
    setError('');
    try {
      await cancelarSolicitud(id);
      await recargarSolicitud();
    } catch (err) {
      console.error(err);
      setError('No pudimos cancelar el pedido. Intenta de nuevo.');
    } finally {
      setProcesando(false);
    }
  }

  if (cargando) {
    return <main style={{ minHeight: '100vh', padding: '24px' }}><p>Cargando...</p></main>;
  }
  if (!solicitud) {
    return (
      <main style={{ minHeight: '100vh', padding: '24px' }}>
        <p role="alert">Este pedido ya no existe.</p>
        <button onClick={() => router.push('/panel/taller/pedir-pieza')}>Volver</button>
      </main>
    );
  }

  const abierta = solicitud.estadoSolicitud === 'abierta';

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '16px', paddingBottom: '100px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <button onClick={() => router.push('/panel/taller/pedir-pieza')} style={{ background: 'none', border: 'none', color: '#1A3C5E', fontSize: '15px', cursor: 'pointer', padding: '8px 0' }}>
          ← Mis pedidos
        </button>

        <div style={seccion}>
          <p style={{ fontWeight: 'bold', color: '#1A3C5E', fontSize: '18px', margin: 0 }}>{solicitud.pieza}</p>
          <p style={{ color: '#666', fontSize: '14px', margin: '4px 0 0' }}>
            {solicitud.vehiculo?.marca} {solicitud.vehiculo?.modelo} {solicitud.vehiculo?.anio}
          </p>
          {solicitud.nota && <p style={{ color: '#888', fontSize: '13px', margin: '6px 0 0' }}>Nota: {solicitud.nota}</p>}
          <p style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '10px', color: abierta ? '#E8720C' : solicitud.estadoSolicitud === 'cerrada' ? '#2E7D32' : '#888' }}>
            {abierta ? 'Abierta' : solicitud.estadoSolicitud === 'cerrada' ? 'Cerrada' : 'Cancelada'}
          </p>
        </div>

        {solicitud.estadoSolicitud === 'cerrada' && solicitud.yonkeElegido && (
          <div style={{ ...seccion, backgroundColor: '#E8F5E9' }}>
            <p style={{ margin: 0, color: '#2E7D32', fontWeight: 'bold' }}>
              Yonke elegido — WhatsApp: {whatsappElegido || 'cargando...'}
            </p>
          </div>
        )}

        {error && <p role="alert" style={{ ...seccion, color: '#B3261E', fontSize: '14px' }}>{error}</p>}

        <div style={seccion}>
          <p style={{ margin: '0 0 10px', fontWeight: 'bold', color: '#1A3C5E' }}>Respuestas ({respuestas.length})</p>
          {respuestas.length === 0 && <p style={{ color: '#888', fontSize: '14px' }}>Todavía no hay respuestas.</p>}
          {respuestas.map((r) => (
            <div key={r.yonkeId} style={{ border: '1px solid #EEE', borderRadius: '12px', padding: '12px', marginBottom: '10px' }}>
              <p style={{ margin: 0, fontWeight: 'bold', color: '#1A3C5E' }}>{r.yonkeNombre}</p>
              {r.tieneLaPieza ? (
                <p style={{ margin: '4px 0 0', color: '#2E7D32', fontWeight: 'bold' }}>La tiene — ${Number(r.precio).toLocaleString('es-MX')}</p>
              ) : (
                <p style={{ margin: '4px 0 0', color: '#888' }}>No la tiene</p>
              )}
              {r.nota && <p style={{ margin: '4px 0 0', color: '#888', fontSize: '13px' }}>{r.nota}</p>}
              {abierta && r.tieneLaPieza && (
                <button type="button" disabled={procesando} onClick={() => elegir(r.yonkeId)} style={{ ...botonGrande, marginTop: '10px', backgroundColor: '#E8720C', color: '#fff' }}>
                  Elegir
                </button>
              )}
            </div>
          ))}
        </div>

        {abierta && (
          <button type="button" disabled={procesando} onClick={cancelar} style={{ ...botonGrande, width: '100%', backgroundColor: '#fff', color: '#B3261E', border: '1px solid #E5B8B3' }}>
            Cancelar pedido
          </button>
        )}
      </div>
    </main>
  );
}
