// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const replace = vi.fn();
let configHistorial = null;
let taller = { id: 'T1', activo: true, aceptacionVersion: 'v1', plan: 'premium' };
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace }) }));
vi.mock('../../AuthContext', () => ({ useAuth: () => ({ tallerId: 'T1' }) }));
vi.mock('../cotizaciones/datos', () => ({
  leerTaller: vi.fn(async () => taller),
  leerConfigCotizaciones: vi.fn(async () => ({ terminosVersion: 'v1' })),
  aceptarVersion: vi.fn(),
}));
vi.mock('./datos', () => ({ leerConfigHistorial: vi.fn(async () => configHistorial) }));

const { default: HistorialLayout } = await import('./layout.js');
const { useHistorial } = await import('./contexto.js');
function Permisos() {
  const { puedeEscribir } = useHistorial();
  return <p>{`escribir:${puedeEscribir}`}</p>;
}

afterEach(() => { cleanup(); replace.mockClear(); vi.unstubAllEnvs(); taller = { id: 'T1', activo: true, aceptacionVersion: 'v1', plan: 'premium' }; });

describe('historial: falla cerrada y permisos', () => {
  it('sin config/historialTaller o con habilitado false: regresa al inicio y no muestra nada', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    for (const c of [null, { habilitado: false }]) {
      configHistorial = c;
      render(<HistorialLayout><p>contenido</p></HistorialLayout>);
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/panel/taller'));
      expect(screen.queryByText('contenido')).not.toBeInTheDocument();
      cleanup();
      replace.mockClear();
    }
  });
  it('encendida y Premium: escribe; con la advertencia fija', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    configHistorial = { habilitado: true };
    render(<HistorialLayout><Permisos /></HistorialLayout>);
    expect(await screen.findByText('escribir:true')).toBeInTheDocument();
    expect(screen.getByText(/No escribas nombres ni teléfonos de clientes en las descripciones/)).toBeInTheDocument();
    expect(screen.queryByText(/Función del plan Premium/)).not.toBeInTheDocument();
  });
  it('sin Premium: candado, solo ver y borrar', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    configHistorial = { habilitado: true };
    taller = { ...taller, plan: 'freemium' };
    render(<HistorialLayout><Permisos /></HistorialLayout>);
    expect(await screen.findByText('escribir:false')).toBeInTheDocument();
    expect(screen.getByText(/Función del plan Premium/)).toBeInTheDocument();
  });
  it('con términos viejos: no escribe', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    configHistorial = { habilitado: true };
    taller = { ...taller, aceptacionVersion: 'v0' };
    render(<HistorialLayout><Permisos /></HistorialLayout>);
    expect(await screen.findByText('escribir:false')).toBeInTheDocument();
  });
});
