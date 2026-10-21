// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const replace = vi.fn();
let configOrdenes = null;
let tallerDatos = { id: 'T1', activo: true, aceptacionVersion: 'v1' };
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace }) }));
vi.mock('../../AuthContext', () => ({ useAuth: () => ({ tallerId: 'T1' }) }));
vi.mock('../cotizaciones/datos', () => ({
  leerTaller: vi.fn(async () => tallerDatos),
  leerConfigCotizaciones: vi.fn(async () => ({ terminosVersion: 'v1' })),
  aceptarVersion: vi.fn(),
}));
vi.mock('./datos', () => ({ leerConfigOrdenes: vi.fn(async () => configOrdenes) }));

const { default: OrdenesLayout } = await import('./layout.js');
const { useOrdenes } = await import('./contexto.js');

afterEach(() => { cleanup(); replace.mockClear(); vi.unstubAllEnvs(); tallerDatos = { id: 'T1', activo: true, aceptacionVersion: 'v1' }; });

// Muestra los permisos que reciben las pantallas de órdenes.
function Permisos() {
  const { puedeEditar, puedeBorrar } = useOrdenes();
  return <p>{`editar:${puedeEditar} borrar:${puedeBorrar}`}</p>;
}
const enDias = (n) => new Date(Date.now() + n * 86400000);

describe('candado Premium (config/ordenes.requierePremium)', () => {
  const base = { habilitado: true, datosClienteHabilitados: false, avisoOrdenVersion: 'aviso-orden-0' };
  it('sin el campo: igual que hoy (crea, edita y borra; sin candado)', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    configOrdenes = base;
    render(<OrdenesLayout><Permisos /></OrdenesLayout>);
    expect(await screen.findByText('editar:true borrar:true')).toBeInTheDocument();
    expect(screen.queryByText(/Función del plan Premium/)).not.toBeInTheDocument();
  });
  it('encendido y Básico: candado; no crea ni edita, pero sí borra', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    configOrdenes = { ...base, requierePremium: true };
    render(<OrdenesLayout><Permisos /></OrdenesLayout>);
    expect(await screen.findByText('editar:false borrar:true')).toBeInTheDocument();
    expect(screen.getByText(/Función del plan Premium/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Quiero Premium/ })).toHaveAttribute('href', expect.stringContaining('talleres'));
  });
  it('encendido y Premium vencido: igual que Básico', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    configOrdenes = { ...base, requierePremium: true };
    tallerDatos = { ...tallerDatos, plan: 'premium', premiumHasta: enDias(-1) };
    render(<OrdenesLayout><Permisos /></OrdenesLayout>);
    expect(await screen.findByText('editar:false borrar:true')).toBeInTheDocument();
  });
  it('encendido y Premium vigente: sin candado, crea y edita', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    configOrdenes = { ...base, requierePremium: true };
    tallerDatos = { ...tallerDatos, plan: 'premium', premiumHasta: enDias(30) };
    render(<OrdenesLayout><Permisos /></OrdenesLayout>);
    expect(await screen.findByText('editar:true borrar:true')).toBeInTheDocument();
    expect(screen.queryByText(/Función del plan Premium/)).not.toBeInTheDocument();
  });
});

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
