// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const replaceMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => pathnameActual,
}));

let pathnameActual = '/panel/taller';
let estadoAuth;
vi.mock('../AuthContext', () => ({
  useAuth: () => estadoAuth,
}));

const { default: TallerLayout } = await import('./layout.js');

beforeEach(() => {
  replaceMock.mockReset();
  pathnameActual = '/panel/taller';
});
afterEach(() => cleanup());

describe('guarda de /panel/taller', () => {
  it('con usuario pero rol aún no leído: muestra carga y NO redirige (sin menú de yonke)', () => {
    estadoAuth = { user: { uid: 'u1' }, userRole: null, loading: false, rolListo: false };
    render(<TallerLayout><p>contenido del taller</p></TallerLayout>);
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
    expect(screen.queryByText('contenido del taller')).not.toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('rol de taller ya leído: muestra el contenido', () => {
    estadoAuth = { user: { uid: 'u1' }, userRole: 'taller', loading: false, rolListo: true };
    render(<TallerLayout><p>contenido del taller</p></TallerLayout>);
    expect(screen.getByText('contenido del taller')).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('sin sesión: redirige al login del panel', async () => {
    estadoAuth = { user: null, userRole: null, loading: false, rolListo: false };
    render(<TallerLayout><p>contenido del taller</p></TallerLayout>);
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/panel'));
    expect(screen.queryByText('contenido del taller')).not.toBeInTheDocument();
  });

  it('usuario con rol de yonke: redirige al login del panel', async () => {
    estadoAuth = { user: { uid: 'y1' }, userRole: 'yonke', loading: false, rolListo: true };
    render(<TallerLayout><p>contenido del taller</p></TallerLayout>);
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/panel'));
  });

  it('el registro de taller no pasa por la guarda', () => {
    pathnameActual = '/panel/taller/registro';
    estadoAuth = { user: null, userRole: null, loading: false, rolListo: false };
    render(<TallerLayout><p>formulario de registro</p></TallerLayout>);
    expect(screen.getByText('formulario de registro')).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
