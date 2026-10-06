// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const replaceMock = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: replaceMock }) }));
vi.mock('../../AuthContext', () => ({ useAuth: () => ({ tallerId: 'T1' }) }));

let taller;
let config;
vi.mock('./datos', () => ({
  leerTaller: vi.fn(async () => taller),
  leerConfigCotizaciones: vi.fn(async () => config),
  aceptarVersion: vi.fn(async () => {}),
}));

const { default: CotizacionesLayout } = await import('./layout.js');

beforeEach(() => {
  replaceMock.mockReset();
  taller = { id: 'T1', activo: true, aceptacionVersion: 'v1', avisoPrivacidad: { versionPlantilla: 'aviso-1' } };
  config = { terminosVersion: 'v1', avisoTallerVersion: 'aviso-1', datosClienteHabilitados: true, resumenCambios: 'x' };
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

describe('cotizaciones con la bandera de talleres', () => {
  it('apagada: no muestra la pantalla y regresa al inicio del taller', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '0');
    render(<CotizacionesLayout><p>lista de cotizaciones</p></CotizacionesLayout>);
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/panel/taller'));
    expect(screen.queryByText('lista de cotizaciones')).not.toBeInTheDocument();
  });
  it('encendida y con versión vigente: muestra la pantalla sin aviso', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    render(<CotizacionesLayout><p>lista de cotizaciones</p></CotizacionesLayout>);
    expect(await screen.findByText('lista de cotizaciones')).toBeInTheDocument();
    expect(screen.queryByText(/Cambiaron los Términos/)).not.toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
  it('encendida con versión vieja: muestra el aviso de cambios y el botón de aceptar', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    taller.aceptacionVersion = 'v0';
    render(<CotizacionesLayout><p>lista de cotizaciones</p></CotizacionesLayout>);
    expect(await screen.findByText(/Cambiaron los Términos/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Acepto la versión nueva' })).toBeInTheDocument();
    expect(screen.getByText('lista de cotizaciones')).toBeInTheDocument();
  });
  it('sin configuración de cotizaciones: avisa que no están disponibles', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    config = null;
    render(<CotizacionesLayout><p>lista de cotizaciones</p></CotizacionesLayout>);
    expect(await screen.findByText(/no están disponibles/)).toBeInTheDocument();
  });
});
