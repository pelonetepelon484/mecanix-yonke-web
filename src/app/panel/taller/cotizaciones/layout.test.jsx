// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const replaceMock = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: replaceMock }) }));

const { default: CotizacionesLayout } = await import('./layout.js');

beforeEach(() => replaceMock.mockReset());
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

describe('cotizaciones con la bandera de talleres', () => {
  it('apagada: no muestra la pantalla y regresa al inicio del taller', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '0');
    render(<CotizacionesLayout><p>lista de cotizaciones</p></CotizacionesLayout>);
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/panel/taller'));
    expect(screen.queryByText('lista de cotizaciones')).not.toBeInTheDocument();
  });
  it('encendida: muestra la pantalla y no redirige', () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    render(<CotizacionesLayout><p>lista de cotizaciones</p></CotizacionesLayout>);
    expect(screen.getByText('lista de cotizaciones')).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
