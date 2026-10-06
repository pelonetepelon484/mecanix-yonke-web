// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('../../AuthContext', () => ({ useAuth: () => ({ recargarRol: vi.fn() }) }));
vi.mock('../../../lib/firebase', () => ({ auth: {}, db: {} }));
vi.mock('firebase/auth', () => ({ createUserWithEmailAndPassword: vi.fn(), deleteUser: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), doc: vi.fn(() => ({ id: 'x' })), deleteDoc: vi.fn(), serverTimestamp: vi.fn(), setDoc: vi.fn(),
}));

const { default: RegistroTaller } = await import('./page.js');

afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

describe('registro de taller con la bandera', () => {
  it('apagada: muestra "próximamente" y no ofrece el formulario', () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '');
    render(<RegistroTaller />);
    expect(screen.getByText(/próximamente/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar taller' })).not.toBeInTheDocument();
    expect(screen.queryByText('Nombre del taller')).not.toBeInTheDocument();
  });
  it('encendida: muestra el formulario con la casilla de términos', () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    render(<RegistroTaller />);
    expect(screen.getByRole('button', { name: 'Registrar taller' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });
});
