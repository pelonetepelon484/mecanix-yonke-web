'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { activarAvisos, apagarAvisos, avisosHabilitados, navegadorCompatible, revisarDispositivo } from './avisosPush';

// "Activar avisos" / "Apagar avisos" del panel del yonke (en Pedidos y en Mi negocio). No aparece
// si la función está apagada (config/notificaciones), si el navegador no es compatible (por ahora
// solo Android) o si quien entra no es un yonke. No depende de los términos ni del plan.
export default function BotonAvisos() {
  const { userRole, yonkeId } = useAuth();
  const [estado, setEstado] = useState('oculto'); // oculto | apagado | activo | ocupado
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    if (userRole !== 'yonke' || !yonkeId || !navegadorCompatible()) return undefined;
    let vigente = true;
    avisosHabilitados().then(async (habilitado) => {
      if (!vigente || !habilitado) return;
      const activo = await revisarDispositivo(yonkeId);
      if (vigente) setEstado(activo ? 'activo' : 'apagado');
    });
    return () => { vigente = false; };
  }, [userRole, yonkeId]);

  if (estado === 'oculto') return null;

  async function activar() {
    setMensaje('');
    setEstado('ocupado');
    try {
      const r = await activarAvisos(yonkeId);
      if (r.ok) { setEstado('activo'); return; }
      setEstado('apagado');
      if (r.motivo === 'denegado') setMensaje('Bloqueaste los avisos para este sitio. Para activarlos, permite las notificaciones en los ajustes de Chrome y vuelve a intentarlo.');
    } catch (error) {
      console.error('[avisos] No se pudieron activar', error?.code || error?.message);
      setEstado('apagado');
      setMensaje('No pudimos activar los avisos. Intenta de nuevo.');
    }
  }

  async function apagar() {
    setMensaje('');
    setEstado('ocupado');
    try {
      await apagarAvisos(yonkeId);
      setEstado('apagado');
    } catch (error) {
      console.error('[avisos] No se pudieron apagar', error?.code || error?.message);
      setEstado('activo');
      setMensaje('No pudimos apagar los avisos. Intenta de nuevo.');
    }
  }

  const activo = estado === 'activo';
  return (
    <div style={cajaStyle}>
      <p style={{ margin: 0, fontWeight: 'bold', color: '#1A3C5E', fontSize: '14px' }}>🔔 Avisos en este celular</p>
      <p style={{ margin: '4px 0 10px', fontSize: '13px', color: '#666', lineHeight: 1.5 }}>
        {activo
          ? 'Te avisamos aquí cuando llegue una búsqueda activa o un pedido de tu estado, aunque la app esté cerrada.'
          : 'Recibe un aviso en este celular cuando llegue una búsqueda activa o un pedido de tu estado, aunque la app esté cerrada.'}
      </p>
      <button
        type="button" onClick={activo ? apagar : activar} disabled={estado === 'ocupado'}
        style={{ ...botonStyle, backgroundColor: activo ? '#EEF1F5' : '#E8720C', color: activo ? '#333' : '#fff', opacity: estado === 'ocupado' ? 0.6 : 1 }}
      >
        {estado === 'ocupado' ? 'Un momento...' : activo ? 'Apagar avisos' : 'Activar avisos'}
      </button>
      {mensaje && <p role="alert" style={{ margin: '8px 0 0', fontSize: '13px', color: '#B3261E' }}>{mensaje}</p>}
    </div>
  );
}

const cajaStyle = { backgroundColor: '#fff', border: '1px solid #E3E7EC', borderRadius: '12px', padding: '14px 16px', marginBottom: '14px' };
const botonStyle = { border: 'none', borderRadius: '10px', padding: '10px 16px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', minHeight: '44px' };
