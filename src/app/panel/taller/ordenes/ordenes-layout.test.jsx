// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const replace = vi.fn();
let configOrdenes = null;
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace }) }));
vi.mock('../../AuthContext', () => ({ useAuth: () => ({ tallerId: 'T1' }) }));
vi.mock('../cotizaciones/datos', () => ({
  leerTaller: vi.fn(async () => ({ id: 'T1', activo: true, aceptacionVersion: 'v1' })),
  leerConfigCotizaciones: vi.fn(async () => ({ terminosVersion: 'v1' })),
  aceptarVersion: vi.fn(),
}));
vi.mock('./datos', () => ({ leerConfigOrdenes: vi.fn(async () => configOrdenes) }));

const { default: OrdenesLayout } = await import('./layout.js');

afterEach(() => { cleanup(); replace.mockClear(); vi.unstubAllEnvs(); });

describe('marco de órdenes (falla cerrada)', () => {
  it('sin config/ordenes regresa al inicio del taller y no muestra nada', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    configOrdenes = null;
    render(<OrdenesLayout><p>contenido</p></OrdenesLayout>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/panel/taller'));
    expect(screen.queryByText('contenido')).not.toBeInTheDocument();
  });
  it('con habilitado: false, igual', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    configOrdenes = { habilitado: false };
    render(<OrdenesLayout><p>contenido</p></OrdenesLayout>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/panel/taller'));
  });
  it('con la función de talleres apagada, igual aunque config/ordenes esté encendida', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '0');
    configOrdenes = { habilitado: true };
    render(<OrdenesLayout><p>contenido</p></OrdenesLayout>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/panel/taller'));
    expect(screen.queryByText('contenido')).not.toBeInTheDocument();
  });
  it('encendida: muestra la sección', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    configOrdenes = { habilitado: true, datosClienteHabilitados: false, avisoOrdenVersion: 'aviso-orden-0' };
    render(<OrdenesLayout><p>contenido</p></OrdenesLayout>);
    expect(await screen.findByText('contenido')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
