// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('../../lib/firebase', () => ({ auth: {}, db: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), getDoc: vi.fn(() => new Promise(() => {})) }));
vi.mock('../AuthContext', () => ({ useAuth: () => ({ tallerId: 'T1' }) }));

const { default: PanelTaller } = await import('./page.js');

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

afterEach(() => { cleanup(); window.localStorage.clear(); });

describe('inicio del taller: opción fija "Instalar app"', () => {
  it('aunque el aviso se haya cerrado, el taller lo vuelve a ver desde su inicio (mismo componente que Negocio)', () => {
    Object.defineProperty(window.navigator, 'userAgent', { value: IPHONE, configurable: true });
    window.matchMedia = vi.fn(() => ({ matches: false }));
    window.localStorage.setItem('mecanix_aviso_instalar_cerrado', '1');
    render(<PanelTaller />);
    expect(screen.getByRole('heading', { name: 'Instalar app' })).toBeInTheDocument();
    expect(screen.queryByText(/Instala Mecanix en tu iPhone/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Instalar app' }));
    expect(screen.getByText(/Instala Mecanix en tu iPhone/)).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
  });
});
