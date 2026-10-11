// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

let configOrdenes = null;
const leerConfigOrdenes = vi.fn(async () => configOrdenes);
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('../../lib/firebase', () => ({ auth: {}, db: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), getDoc: vi.fn(async () => ({ exists: () => true, data: () => ({ nombre: 'Taller Uno', aceptacionVersion: 'v1', activo: true }) })) }));
vi.mock('../AuthContext', () => ({ useAuth: () => ({ tallerId: 'T1' }) }));
vi.mock('./cotizaciones/datos', () => ({ leerConfigCotizaciones: vi.fn(async () => ({ terminosVersion: 'v1' })), aceptarVersion: vi.fn() }));
vi.mock('../solicitudesPiezasDatos', () => ({ leerConfigSolicitudesPiezas: vi.fn(async () => null) }));
vi.mock('./ordenes/datos', () => ({ leerConfigOrdenes: (...a) => leerConfigOrdenes(...a) }));

const { default: PanelTaller } = await import('./page.js');

afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

describe('botón "Órdenes de servicio" en el inicio del taller', () => {
  it('sin config/ordenes no aparece', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    configOrdenes = null;
    render(<PanelTaller />);
    expect(await screen.findByText('Taller Uno')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Órdenes de servicio' })).not.toBeInTheDocument();
  });
  it('con habilitado: false no aparece', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    configOrdenes = { habilitado: false };
    render(<PanelTaller />);
    expect(await screen.findByText('Taller Uno')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Órdenes de servicio' })).not.toBeInTheDocument();
  });
  it('con habilitado: true aparece', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    configOrdenes = { habilitado: true };
    render(<PanelTaller />);
    expect(await screen.findByRole('button', { name: 'Órdenes de servicio' })).toBeInTheDocument();
  });
  it('con la función de talleres apagada no aparece aunque config/ordenes esté encendida', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '0');
    configOrdenes = { habilitado: true };
    render(<PanelTaller />);
    await waitFor(() => expect(leerConfigOrdenes).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Órdenes de servicio' })).not.toBeInTheDocument();
  });
});
