'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useConteoPedidos } from './ConteoPedidos';

const TABS = [
  { path: '/panel/inventario', icon: '🚗', label: 'Inventario' },
  { path: '/panel/reservaciones', icon: '📋', label: 'Pedidos' },
  { path: '/panel/ventas', icon: '💰', label: 'Ventas' },
  { path: '/panel/venta-manual', icon: '🧾', label: 'Manual' },
  { path: '/panel/reciclaje', icon: '♻️', label: 'Reciclaje' },
  { path: '/panel/demanda', icon: '📈', label: 'Demanda' },
  { path: '/panel/perfil', icon: '⚙️', label: 'Negocio' },
];

// El número del globo de "Pedidos" lo calcula ConteoPedidosProvider (ConteoPedidos.js), montado
// una sola vez en el layout del panel: cambiar de pantalla ya no vuelve a conectar ni a leer nada.
export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const conteoSolicitudes = useConteoPedidos();

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