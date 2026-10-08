// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const leerYonkeEstadoActivo = vi.fn(async () => ({ estado: 'baja-california', activo: true }));
const escucharSolicitudesAbiertas = vi.fn((estado, cb) => { cb([{ id: 'S1' }, { id: 'S2' }]); return () => {}; });
const leerConfigSolicitudesPiezas = vi.fn(async () => ({ habilitado: true }));

vi.mock('next/navigation', () => ({ usePathname: () => '/panel/inventario', useRouter: () => ({ push: vi.fn() }) }));
vi.mock('./AuthContext', () => ({ useAuth: () => ({ yonkeId: 'Y1' }) }));
vi.mock('./solicitudesPiezasDatos', () => ({
  leerYonkeEstadoActivo: (...args) => leerYonkeEstadoActivo(...args),
  escucharSolicitudesAbiertas: (...args) => escucharSolicitudesAbiertas(...args),
  leerConfigSolicitudesPiezas: (...args) => leerConfigSolicitudesPiezas(...args),
}));

const { default: BottomNav } = await import('./BottomNav.js');

afterEach(() => {
  cleanup();
  leerYonkeEstadoActivo.mockClear();
  escucharSolicitudesAbiertas.mockClear();
  leerConfigSolicitudesPiezas.mockReset();
  leerConfigSolicitudesPiezas.mockResolvedValue({ habilitado: true });
});

describe('badge de "Pedidos" en el BottomNav', () => {
  it('muestra el conteo de solicitudes abiertas del estado del yonke', async () => {
    render(<BottomNav />);
    expect(await screen.findByText('2')).toBeInTheDocument();
  });

  it('sin yonkeId (otro rol) no muestra ningún badge', async () => {
    vi.doMock('./AuthContext', () => ({ useAuth: () => ({ yonkeId: null }) }));
    vi.resetModules();
    const { default: BottomNavSinYonke } = await import('./BottomNav.js');
    render(<BottomNavSinYonke />);
    await waitFor(() => expect(screen.queryByText('2')).not.toBeInTheDocument());
  });

  it('sin config/solicitudesPiezas: no hay badge y no se lee nada más de ese módulo', async () => {
    leerConfigSolicitudesPiezas.mockResolvedValue(null);
    render(<BottomNav />);
    await waitFor(() => expect(leerConfigSolicitudesPiezas).toHaveBeenCalled());
    expect(screen.queryByText('2')).not.toBeInTheDocument();
    expect(leerYonkeEstadoActivo).not.toHaveBeenCalled();
    expect(escucharSolicitudesAbiertas).not.toHaveBeenCalled();
  });

  it('con habilitado=false: lo mismo, nada se lee de más', async () => {
    leerConfigSolicitudesPiezas.mockResolvedValue({ habilitado: false });
    render(<BottomNav />);
    await waitFor(() => expect(leerConfigSolicitudesPiezas).toHaveBeenCalled());
    expect(leerYonkeEstadoActivo).not.toHaveBeenCalled();
    expect(escucharSolicitudesAbiertas).not.toHaveBeenCalled();
  });
});
