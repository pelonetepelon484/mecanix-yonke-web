'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';
import { escucharSolicitudesAbiertas, leerConfigSolicitudesPiezas, leerYonkeEstadoActivo } from './solicitudesPiezasDatos';
import { escucharPedidosClientesAbiertos, leerConfigPedidosClientes } from './pedidosClientesDatos';

const TABS = [
  { path: '/panel/inventario', icon: '🚗', label: 'Inventario' },
  { path: '/panel/reservaciones', icon: '📋', label: 'Pedidos' },
  { path: '/panel/ventas', icon: '💰', label: 'Ventas' },
  { path: '/panel/venta-manual', icon: '🧾', label: 'Manual' },
  { path: '/panel/reciclaje', icon: '♻️', label: 'Reciclaje' },
  { path: '/panel/demanda', icon: '📈', label: 'Demanda' },
  { path: '/panel/perfil', icon: '⚙️', label: 'Negocio' },
];

// Conteo de solicitudes de piezas abiertas del estado del yonke, para el badge de "Pedidos".
// Sin config/solicitudesPiezas (función apagada), no se hace NINGUNA otra lectura de Firestore
// de este módulo -- ni el documento del yonke ni el listener. Un yonke inactivo o sin estado
// tampoco ve ninguna (mismas reglas que protegen la lectura real).
function useConteoSolicitudes(yonkeId) {
  const [conteo, setConteo] = useState(0);
  useEffect(() => {
    if (!yonkeId) return;
    let cancelado = false;
    let dejarDeEscuchar = null;
    leerConfigSolicitudesPiezas().then((config) => {
      if (cancelado || config?.habilitado !== true) return;
      leerYonkeEstadoActivo(yonkeId).then(({ estado, activo }) => {
        if (cancelado || !activo || !estado) return;
        dejarDeEscuchar = escucharSolicitudesAbiertas(estado, (lista) => { if (!cancelado) setConteo(lista.length); });
      });
    });
    return () => { cancelado = true; if (dejarDeEscuchar) dejarDeEscuchar(); };
  }, [yonkeId]);
  return conteo;
}

// Mismo conteo para los pedidos de clientes sin cuenta (pedidosClientes), con su propia bandera:
// sin config/pedidosClientes no se hace ninguna otra lectura.
function useConteoPedidosClientes(yonkeId) {
  const [conteo, setConteo] = useState(0);
  useEffect(() => {
    if (!yonkeId) return;
    let cancelado = false;
    let dejarDeEscuchar = null;
    leerConfigPedidosClientes().then((config) => {
      if (cancelado || config?.habilitado !== true) return;
      leerYonkeEstadoActivo(yonkeId).then(({ estado, activo }) => {
        if (cancelado || !activo || !estado) return;
        dejarDeEscuchar = escucharPedidosClientesAbiertos(estado, (lista) => { if (!cancelado) setConteo(lista.length); });
      });
    }).catch(() => {});
    return () => { cancelado = true; if (dejarDeEscuchar) dejarDeEscuchar(); };
  }, [yonkeId]);
  return conteo;
}

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { yonkeId } = useAuth();
  const conteoSolicitudes = useConteoSolicitudes(yonkeId) + useConteoPedidosClientes(yonkeId);

  return (
    <nav style={navStyle}>
      {TABS.map((tab) => {
        const activo = pathname === tab.path;
        const badge = tab.path === '/panel/reservaciones' && conteoSolicitudes > 0 ? conteoSolicitudes : null;
        return (
          <button
            key={tab.path}
            onClick={() => router.push(tab.path)}
            style={{ ...tabButtonStyle, color: activo ? '#E8720C' : '#999' }}
          >
            <span style={{ position: 'relative', fontSize: '20px' }}>
              {tab.icon}
              {badge !== null && (
                <span style={badgeStyle}>{badge > 9 ? '9+' : badge}</span>
              )}
            </span>
            <span style={{ fontSize: '11px', marginTop: '2px', fontWeight: activo ? 'bold' : 'normal' }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

const navStyle = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  backgroundColor: '#fff',
  borderTop: '1px solid #eee',
  display: 'flex',
  justifyContent: 'space-around',
  alignItems: 'center',
  padding: '8px 0',
  paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
  zIndex: 500,
};

const badgeStyle = {
  position: 'absolute', top: '-6px', right: '-10px', minWidth: '16px', height: '16px',
  borderRadius: '8px', backgroundColor: '#E8720C', color: '#fff', fontSize: '10px', fontWeight: 'bold',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', lineHeight: 1,
};

const tabButtonStyle = {
  background: 'none',
  border: 'none',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  cursor: 'pointer',
  padding: '4px 8px',
};