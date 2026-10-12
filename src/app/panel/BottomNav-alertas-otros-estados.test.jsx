// @vitest-environment jsdom
// Contador de "Pedidos" con alertas de clientes de otros estados (ConteoPedidosProvider).
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

let conexiones;
function conexion(nombre, cb) {
  const c = { nombre, cb, abierta: true };
  conexiones.push(c);
  return () => { c.abierta = false; };
}
const abiertas = (nombre) => conexiones.filter((c) => c.nombre === nombre && c.abierta);
const emitir = (nombre, valor) => act(() => { abiertas(nombre).forEach((c) => c.cb(valor)); });

const propias = [{ id: 'P1', estado: 'baja-california' }];
const deOtros = [{ id: 'P2', estado: 'jalisco' }, { id: 'P3', estado: 'sonora' }, { id: 'P1', estado: 'baja-california' }];

vi.mock('next/navigation', () => ({ usePathname: () => '/panel/inventario', useRouter: () => ({ push: vi.fn() }) }));
vi.mock('./AuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' }, userRole: 'yonke', yonkeId: 'Y1' }) }));
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

const { default: BottomNav } = await import('./BottomNav.js');
const { ConteoPedidosProvider } = await import('./ConteoPedidos.js');

const conEnvio = { estado: 'baja-california', activo: true, verificado: true, enviosNacionales: true };
function arrancar(config, yonke) {
  render(<ConteoPedidosProvider><BottomNav /></ConteoPedidosProvider>);
  emitir('configSolicitudes', null);
  emitir('configPedidos', config);
  emitir('yonke', yonke);
  emitir('propias', propias);
  emitir('otras', deOtros);
}

beforeEach(() => { conexiones = []; });
afterEach(() => cleanup());

describe('contador de "Pedidos" con alertas de otros estados', () => {
  it('interruptor apagado: solo las de su estado (igual que hoy), sin consulta extra', () => {
    arrancar({ habilitado: true, otrosEstados: true }, { ...conEnvio, verAlertasOtrosEstados: false });
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(conexiones.filter((c) => c.nombre === 'otras')).toHaveLength(0);
  });
  it('interruptor encendido: suma las de otros estados (sin contar dos veces las de su estado)', () => {
    arrancar({ habilitado: true, otrosEstados: true }, { ...conEnvio, verAlertasOtrosEstados: true });
    expect(screen.getByText('3')).toBeInTheDocument();
  });
  it('segunda bandera apagada o sin Verificado: no suma aunque el interruptor esté encendido', () => {
    for (const [c, y] of [
      [{ habilitado: true }, { ...conEnvio, verAlertasOtrosEstados: true }],
      [{ habilitado: true, otrosEstados: true }, { ...conEnvio, verificado: false, verAlertasOtrosEstados: true }],
    ]) {
      conexiones = [];
      arrancar(c, y);
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(conexiones.filter((x) => x.nombre === 'otras')).toHaveLength(0);
      cleanup();
    }
  });
  it('al cambiar el interruptor en Pedidos (se guarda en su ficha), el contador se vuelve a calcular solo', () => {
    arrancar({ habilitado: true, otrosEstados: true }, { ...conEnvio, verAlertasOtrosEstados: false });
    expect(screen.getByText('1')).toBeInTheDocument();
    emitir('yonke', { ...conEnvio, verAlertasOtrosEstados: true });
    emitir('otras', deOtros);
    expect(screen.getByText('3')).toBeInTheDocument();
    emitir('yonke', { ...conEnvio, verAlertasOtrosEstados: false });
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(abiertas('otras')).toHaveLength(0);
  });
  it('solicitudes de talleres + alertas propias + otros estados se suman', () => {
    render(<ConteoPedidosProvider><BottomNav /></ConteoPedidosProvider>);
    emitir('configSolicitudes', { habilitado: true });
    emitir('configPedidos', { habilitado: true, otrosEstados: true });
    emitir('yonke', { ...conEnvio, verAlertasOtrosEstados: true });
    emitir('solicitudes', [{ id: 'S1' }, { id: 'S2' }]);
    emitir('propias', propias);
    emitir('otras', deOtros);
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
