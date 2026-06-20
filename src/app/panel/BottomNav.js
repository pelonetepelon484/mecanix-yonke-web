'use client';

import { usePathname, useRouter } from 'next/navigation';

const TABS = [
  { path: '/panel/inventario', icon: '🚗', label: 'Inventario' },
  { path: '/panel/reservaciones', icon: '📋', label: 'Pedidos' },
  { path: '/panel/ventas', icon: '💰', label: 'Ventas' },
  { path: '/panel/venta-manual', icon: '🧾', label: 'Manual' },
  { path: '/panel/perfil', icon: '⚙️', label: 'Negocio' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav style={navStyle}>
      {TABS.map((tab) => {
        const activo = pathname === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => router.push(tab.path)}
            style={{ ...tabButtonStyle, color: activo ? '#E8720C' : '#999' }}
          >
            <span style={{ fontSize: '20px' }}>{tab.icon}</span>
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

const tabButtonStyle = {
  background: 'none',
  border: 'none',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  cursor: 'pointer',
  padding: '4px 8px',
};