// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Cada rol en su sección del panel: una cuenta de refaccionaria (como una de taller) que abre el
// panel de yonkes se va a /panel/refaccionaria, y el login la manda ahí al entrar.
const replaceMock = vi.fn();
const pushMock = vi.fn();
let pathnameActual = '/panel/inventario';
let estadoAuth = {};
vi.mock('next/navigation', () => ({ usePathname: () => pathnameActual, useRouter: () => ({ push: pushMock, replace: replaceMock }) }));
vi.mock('./AuthContext', () => ({ AuthProvider: ({ children }) => children, useAuth: () => estadoAuth }));
vi.mock('./AvisoTerminosYonke', () => ({ default: () => null }));
vi.mock('./AvisoInstalarApp', () => ({ default: () => null }));
vi.mock('./EnlaceIrAMecanix', () => ({ default: () => null }));
vi.mock('./ConteoPedidos', () => ({ ConteoPedidosProvider: ({ children }) => children }));
vi.mock('../lib/firebase', () => ({ auth: {}, db: {} }));
vi.mock('firebase/auth', () => ({ signInWithEmailAndPassword: vi.fn() }));
vi.mock('../lib/passwordReset', () => ({ enviarRecuperacionPassword: vi.fn() }));

const { default: PanelLayoutCliente } = await import('./PanelLayoutCliente.js');
const { default: Login } = await import('./page.js');

beforeEach(() => { replaceMock.mockReset(); pushMock.mockReset(); });
afterEach(() => cleanup());

const conRol = (userRole) => ({ user: { uid: 'u' }, userRole, loading: false, rolListo: true });

describe('guarda del panel por rol', () => {
  it('refaccionaria fuera de su sección: a /panel/refaccionaria, sin mostrar la pantalla de yonke', () => {
    estadoAuth = conRol('refaccionaria');
    for (const ruta of ['/panel/inventario', '/panel/reservaciones', '/panel/taller']) {
      pathnameActual = ruta;
      render(<PanelLayoutCliente><p>pantalla</p></PanelLayoutCliente>);
      expect(screen.queryByText('pantalla')).not.toBeInTheDocument();
      cleanup();
    }
    expect(replaceMock).toHaveBeenCalledTimes(3);
    expect(replaceMock).toHaveBeenCalledWith('/panel/refaccionaria');
  });
  it('refaccionaria en su sección, y yonke en la suya: se muestran', () => {
    estadoAuth = conRol('refaccionaria');
    pathnameActual = '/panel/refaccionaria';
    render(<PanelLayoutCliente><p>pantalla</p></PanelLayoutCliente>);
    expect(screen.getByText('pantalla')).toBeInTheDocument();
    cleanup();
    estadoAuth = conRol('yonke');
    pathnameActual = '/panel/inventario';
    render(<PanelLayoutCliente><p>pantalla</p></PanelLayoutCliente>);
    expect(screen.getByText('pantalla')).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
  it('taller: igual que hoy (a /panel/taller)', () => {
    estadoAuth = conRol('taller');
    pathnameActual = '/panel/inventario';
    render(<PanelLayoutCliente><p>pantalla</p></PanelLayoutCliente>);
    expect(replaceMock).toHaveBeenCalledWith('/panel/taller');
  });
});

describe('login del panel', () => {
  it('con sesión de refaccionaria va a /panel/refaccionaria; taller, admin y yonke como hoy', () => {
    for (const [rol, destino] of [['refaccionaria', '/panel/refaccionaria'], ['taller', '/panel/taller'], ['admin', '/admin'], ['yonke', '/panel/inventario']]) {
      pushMock.mockReset();
      estadoAuth = conRol(rol);
      render(<Login />);
      expect(pushMock).toHaveBeenCalledWith(destino);
      cleanup();
    }
  });
});
