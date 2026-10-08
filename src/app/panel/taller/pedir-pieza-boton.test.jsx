// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('../../lib/firebase', () => ({ auth: {}, db: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(async () => ({ exists: () => true, data: () => ({ nombre: 'Taller Prueba', aceptacionVersion: 'v1', activo: true }) })),
}));
vi.mock('../AuthContext', () => ({ useAuth: () => ({ tallerId: 'T1' }) }));
vi.mock('./cotizaciones/datos', () => ({
  leerConfigCotizaciones: vi.fn(async () => ({ terminosVersion: 'v1', resumenCambios: 'x' })),
  aceptarVersion: vi.fn(async () => {}),
}));
const leerConfigSolicitudesPiezas = vi.fn(async () => null);
vi.mock('../solicitudesPiezasDatos', () => ({ leerConfigSolicitudesPiezas: (...args) => leerConfigSolicitudesPiezas(...args) }));

const { default: PanelTaller } = await import('./page.js');

afterEach(() => { cleanup(); vi.unstubAllEnvs(); leerConfigSolicitudesPiezas.mockReset(); leerConfigSolicitudesPiezas.mockResolvedValue(null); });

describe('botón "Pedir una pieza" en el inicio del taller', () => {
  it('sin config/solicitudesPiezas: NO se muestra, y la pantalla queda igual que antes', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    leerConfigSolicitudesPiezas.mockResolvedValue(null);
    render(<PanelTaller />);
    expect(await screen.findByText('Cotizaciones')).toBeInTheDocument();
    expect(screen.queryByText('Pedir una pieza')).not.toBeInTheDocument();
  });

  it('con config/solicitudesPiezas pero habilitado=false: tampoco se muestra', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    leerConfigSolicitudesPiezas.mockResolvedValue({ habilitado: false });
    render(<PanelTaller />);
    await screen.findByText('Cotizaciones');
    expect(screen.queryByText('Pedir una pieza')).not.toBeInTheDocument();
  });

  it('con config/solicitudesPiezas habilitado=true: sí se muestra', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    leerConfigSolicitudesPiezas.mockResolvedValue({ habilitado: true });
    render(<PanelTaller />);
    expect(await screen.findByText('Pedir una pieza')).toBeInTheDocument();
  });

  it('con la bandera general apagada, tampoco se muestra aunque exista la config', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '0');
    leerConfigSolicitudesPiezas.mockResolvedValue({ habilitado: true });
    render(<PanelTaller />);
    await screen.findByText('Taller Prueba');
    expect(screen.queryByText('Cotizaciones')).not.toBeInTheDocument();
    expect(screen.queryByText('Pedir una pieza')).not.toBeInTheDocument();
  });
});
