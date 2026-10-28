'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useAuth } from '../AuthContext';
import { TEXTOS_PROVISIONALES, refaccionariaAceptoTerminos } from '../../../lib/refaccionarias';
import { leerConfigRefaccionarias, leerRefaccionaria } from './datos';
import AvisoVersionRefaccionaria from './AvisoVersionRefaccionaria';

// Panel de la refaccionaria (etapa 1): sus datos, el aviso de aceptación de términos si falta y
// "Próximamente: carga de inventario". 2 lecturas al abrir (la refaccionaria y config/refaccionarias).
export default function PanelRefaccionaria() {
  const router = useRouter();
  const { refaccionariaId } = useAuth();
  const [refaccionaria, setRefaccionaria] = useState(null);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!refaccionariaId) return undefined;
    let cancelado = false;
    Promise.all([leerRefaccionaria(refaccionariaId), leerConfigRefaccionarias()])
      .then(([r, c]) => { if (!cancelado) { setRefaccionaria(r); setConfig(c); } })
      .catch((err) => { console.error('[panel/refaccionaria]', err); if (!cancelado) setError('No pudimos cargar tu información. Intenta de nuevo.'); });
    return () => { cancelado = true; };
  }, [refaccionariaId]);

  async function salir() {
    await signOut(auth);
    router.push('/panel');
  }

  const falta = refaccionaria && config && !refaccionariaAceptoTerminos(refaccionaria, config);

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '24px 16px' }}>
      <div style={{ maxWidth: '520px', margin: '0 auto' }}>
        <p style={{ fontSize: '13px', color: '#E8720C', letterSpacing: '2px', fontWeight: 'bold', margin: '0 0 4px' }}>PANEL DE REFACCIONARIA</p>
        <h1 style={{ fontSize: '22px', color: '#1A3C5E', margin: '0 0 16px' }}>{refaccionaria?.nombre || 'Tu refaccionaria'}</h1>
        {error && <p role="alert" style={{ color: '#B3261E' }}>{error}</p>}
        {!error && (!refaccionaria || !config) && <p style={{ color: '#555' }}>Cargando...</p>}
        {falta && (
          <AvisoVersionRefaccionaria
            refaccionariaId={refaccionariaId} version={config.terminosVersion} resumen={config.resumenCambios}
            onAceptada={() => setRefaccionaria((r) => ({ ...r, aceptacionVersion: config.terminosVersion }))}
          />
        )}
        {refaccionaria && (
          <div style={tarjeta}>
            <p style={dato}><strong>WhatsApp:</strong> {refaccionaria.whatsapp}</p>
            <p style={dato}><strong>Ciudad:</strong> {refaccionaria.ciudad}</p>
            {refaccionaria.zonaEntrega && (
              <p style={dato}><strong>Entrega local:</strong> {refaccionaria.zonaEntrega.descripcion}{refaccionaria.zonaEntrega.municipios?.length ? ` (${refaccionaria.zonaEntrega.municipios.join(', ')})` : ''}</p>
            )}
            <p style={dato}><strong>Insignia Verificado:</strong> {refaccionaria.verificado === true ? '✅ Sí' : 'Todavía no'}</p>
          </div>
        )}
        {refaccionaria && (
          <div style={{ ...tarjeta, backgroundColor: '#EEF4FA', border: '1px solid #C5D8EC' }}>
            <p style={{ margin: '0 0 6px', fontWeight: 'bold', color: '#1A3C5E', fontSize: '16px' }}>📦 {TEXTOS_PROVISIONALES.proximamenteInventario}</p>
            <p style={{ margin: 0, fontSize: '14px', color: '#444', lineHeight: '1.5' }}>{TEXTOS_PROVISIONALES.proximamenteInventarioDetalle}</p>
          </div>
        )}
        <button type="button" onClick={salir} style={{ background: 'none', border: 'none', color: '#1A3C5E', textDecoration: 'underline', cursor: 'pointer', fontSize: '14px', padding: 0 }}>
          Cerrar sesión
        </button>
      </div>
    </main>
  );
}

const tarjeta = { backgroundColor: '#fff', borderRadius: '14px', padding: '16px', marginBottom: '14px', boxShadow: '0 2px 8px rgba(26,60,94,0.06)' };
const dato = { margin: '0 0 6px', fontSize: '14px', color: '#333' };
