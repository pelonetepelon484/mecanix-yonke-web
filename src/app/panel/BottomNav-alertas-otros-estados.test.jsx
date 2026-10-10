// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const EVENTO = 'mecanix:ver-alertas-otros-estados';
let yonke = {};
let config = {};
const propias = [{ id: 'P1', estado: 'baja-california' }];
const deOtros = [{ id: 'P2', estado: 'jalisco' }, { id: 'P3', estado: 'sonora' }, { id: 'P1', estado: 'baja-california' }];
const escucharOtros = vi.fn((cb) => { cb(deOtros); return () => {}; });

vi.mock('next/navigation', () => ({ usePathname: () => '/panel/inventario', useRouter: () => ({ push: vi.fn() }) }));
vi.mock('./AuthContext', () => ({ useAuth: () => ({ yonkeId: 'Y1' }) }));
vi.mock('./solicitudesPiezasDatos', () => ({
  leerYonkeEstadoActivo: vi.fn(async () => yonke),
  escucharSolicitudesAbiertas: vi.fn(() => () => {}),
  leerConfigSolicitudesPiezas: vi.fn(async () => null),
}));
vi.mock('./pedidosClientesDatos', () => ({
  EVENTO_OTROS_ESTADOS: EVENTO,
  leerConfigPedidosClientes: vi.fn(async () => config),
  escucharPedidosClientesAbiertos: vi.fn((estado, cb) => { cb(propias); return () => {}; }),
  escucharPedidosClientesOtrosEstados: (...a) => escucharOtros(...a),
}));

const { default: BottomNav } = await import('./BottomNav.js');

const conEnvio = { estado: 'baja-california', activo: true, verificado: true, enviosNacionales: true };
afterEach(() => { cleanup(); escucharOtros.mockClear(); });

describe('contador de "Pedidos" con alertas de otros estados', () => {
  it('interruptor apagado: solo las de su estado (igual que hoy), sin consulta extra', async () => {
    config = { habilitado: true, otrosEstados: true };
    yonke = { ...conEnvio, verAlertasOtrosEstados: false };
    render(<BottomNav />);
    expect(await screen.findByText('1')).toBeInTheDocument();
    expect(escucharOtros).not.toHaveBeenCalled();
  });
  it('interruptor encendido: suma las de otros estados (sin contar dos veces las de su estado)', async () => {
    config = { habilitado: true, otrosEstados: true };
    yonke = { ...conEnvio, verAlertasOtrosEstados: true };
    render(<BottomNav />);
    expect(await screen.findByText('3')).toBeInTheDocument();
  });
  it('segunda bandera apagada o sin Verificado: no suma aunque el interruptor esté encendido', async () => {
    for (const [c, y] of [
      [{ habilitado: true }, { ...conEnvio, verAlertasOtrosEstados: true }],
      [{ habilitado: true, otrosEstados: true }, { ...conEnvio, verificado: false, verAlertasOtrosEstados: true }],
    ]) {
      config = c;
      yonke = y;
      render(<BottomNav />);
      expect(await screen.findByText('1')).toBeInTheDocument();
      expect(escucharOtros).not.toHaveBeenCalled();
      cleanup();
    }
  });
  it('al cambiar el interruptor en Pedidos, el contador se vuelve a calcular', async () => {
    config = { habilitado: true, otrosEstados: true };
    yonke = { ...conEnvio, verAlertasOtrosEstados: false };
    render(<BottomNav />);
    expect(await screen.findByText('1')).toBeInTheDocument();
    yonke = { ...conEnvio, verAlertasOtrosEstados: true };
    act(() => { window.dispatchEvent(new Event(EVENTO)); });
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument());
  });
});
