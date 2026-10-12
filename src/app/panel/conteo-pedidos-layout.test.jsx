// @vitest-environment jsdom
// El contador de "Pedidos" vive en el layout del panel (PanelLayoutCliente): al cambiar de
// pantalla (otra página dentro del mismo layout) no se vuelve a conectar.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const conexiones = [];
const conexion = (nombre, cb) => { const c = { nombre, cb, abierta: true }; conexiones.push(c); return () => { c.abierta = false; }; };
const emitir = (nombre, valor) => act(() => { conexiones.filter((c) => c.nombre === nombre && c.abierta).forEach((c) => c.cb(valor)); });

vi.mock('next/navigation', () => ({ usePathname: () => '/panel/inventario', useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('./AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({ user: { uid: 'u1' }, userRole: 'yonke', yonkeId: 'Y1', loading: false }),
}));
vi.mock('./AvisoTerminosYonke', () => ({ default: () => null }));
vi.mock('./AvisoInstalarApp', () => ({ default: () => null }));
vi.mock('./solicitudesPiezasDatos', () => ({
  escucharConfigSolicitudesPiezas: (cb) => conexion('configSolicitudes', cb),
  escucharYonkeEstadoActivo: (_id, cb) => conexion('yonke', cb),
  escucharSolicitudesAbiertas: (_e, cb) => conexion('solicitudes', cb),
}));
vi.mock('./pedidosClientesDatos', () => ({
  escucharConfigPedidosClientes: (cb) => conexion('configPedidos', cb),
  escucharPedidosClientesAbiertos: (_e, cb) => conexion('propias', cb),
  escucharPedidosClientesOtrosEstados: (cb) => conexion('otras', cb),
}));

const { default: PanelLayoutCliente } = await import('./PanelLayoutCliente.js');
const { default: BottomNav } = await import('./BottomNav.js');
const Pagina = ({ titulo }) => <main><h1>{titulo}</h1><BottomNav /></main>;

describe('contador de "Pedidos" en el layout del panel', () => {
  it('se conecta al entrar y cambiar entre 7 pantallas no abre conexiones nuevas', () => {
    const { rerender } = render(<PanelLayoutCliente><Pagina key="Inventario" titulo="Inventario" /></PanelLayoutCliente>);
    emitir('configSolicitudes', { habilitado: true });
    emitir('configPedidos', { habilitado: true });
    emitir('yonke', { estado: 'baja-california', activo: true });
    emitir('solicitudes', [{ id: 'S1' }]);
    emitir('propias', [{ id: 'P1', estado: 'baja-california' }, { id: 'P2', estado: 'baja-california' }]);
    expect(screen.getByText('3')).toBeInTheDocument();
    const alEntrar = conexiones.length;
    for (const titulo of ['Pedidos', 'Ventas', 'Manual', 'Reciclaje', 'Demanda', 'Negocio']) {
      rerender(<PanelLayoutCliente><Pagina key={titulo} titulo={titulo} /></PanelLayoutCliente>);
      expect(screen.getByRole('heading', { name: titulo })).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    }
    expect(alEntrar).toBe(5); // 2 banderas + ficha + talleres + alertas propias
    expect(conexiones.length).toBe(alEntrar);
  });
});
