// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('../../lib/firebase', () => ({ auth: {}, db: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), getDoc: vi.fn(() => new Promise(() => {})) }));
vi.mock('../AuthContext', () => ({ useAuth: () => ({ tallerId: 'T1' }) }));

const { default: PanelTaller } = await import('./page.js');

afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

describe('inicio del taller con la bandera', () => {
  it('apagada: no muestra el botón de cotizaciones', () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '0');
    render(<PanelTaller />);
    expect(screen.queryByRole('button', { name: 'Cotizaciones' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
  });
  it('encendida: muestra el botón de cotizaciones', () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    render(<PanelTaller />);
    expect(screen.getByRole('button', { name: 'Cotizaciones' })).toBeInTheDocument();
  });
});
