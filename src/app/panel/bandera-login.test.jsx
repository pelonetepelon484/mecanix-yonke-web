// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('../lib/firebase', () => ({ auth: {}, db: {} }));
vi.mock('firebase/auth', () => ({ signInWithEmailAndPassword: vi.fn() }));
vi.mock('../lib/passwordReset', () => ({ enviarRecuperacionPassword: vi.fn() }));
vi.mock('./AuthContext', () => ({ useAuth: () => ({ user: null, userRole: null, loading: false }) }));

const { default: PanelLogin } = await import('./page.js');

afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

describe('enlace de registro de taller en /panel', () => {
  it('apagada: no aparece "Regístrate como taller"', () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '0');
    render(<PanelLogin />);
    expect(screen.queryByText('Regístrate como taller')).not.toBeInTheDocument();
    expect(screen.getByText('Iniciar sesión')).toBeInTheDocument(); // el login de siempre sigue
  });
  it('encendida: aparece', () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    render(<PanelLogin />);
    expect(screen.getByText('Regístrate como taller')).toBeInTheDocument();
  });
});
