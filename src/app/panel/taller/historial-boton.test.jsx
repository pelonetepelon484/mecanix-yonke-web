// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

let configHistorial = null;
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('../../lib/firebase', () => ({ auth: {}, db: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), getDoc: vi.fn(async () => ({ exists: () => true, data: () => ({ nombre: 'Taller Uno', aceptacionVersion: 'v1', activo: true }) })) }));
vi.mock('../AuthContext', () => ({ useAuth: () => ({ tallerId: 'T1' }) }));
vi.mock('./cotizaciones/datos', () => ({ leerConfigCotizaciones: vi.fn(async () => ({ terminosVersion: 'v1' })), aceptarVersion: vi.fn() }));
vi.mock('../solicitudesPiezasDatos', () => ({ leerConfigSolicitudesPiezas: vi.fn(async () => null) }));
vi.mock('./ordenes/datos', () => ({ leerConfigOrdenes: vi.fn(async () => ({ habilitado: true })) }));
vi.mock('./historial/datos', () => ({
  leerConfigHistorial: vi.fn(async () => configHistorial),
  listarPorVencer: vi.fn(async () => []), listarPorBorrarse: vi.fn(async () => []), recordatoriosDe: () => [], telefonoDeOrden: vi.fn(),
}));

const { default: PanelTaller } = await import('./page.js');

afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

describe('botón "Historial de servicios" en el inicio del taller', () => {
  it('sin config/historialTaller o con habilitado false: no aparece (el resto igual)', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    for (const c of [null, { habilitado: false }]) {
      configHistorial = c;
      render(<PanelTaller />);
      expect(await screen.findByRole('button', { name: 'Órdenes de servicio' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Historial de servicios' })).not.toBeInTheDocument();
      cleanup();
    }
  });
  it('con habilitado: true aparece', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    configHistorial = { habilitado: true };
    render(<PanelTaller />);
    expect(await screen.findByRole('button', { name: 'Historial de servicios' })).toBeInTheDocument();
  });
});
