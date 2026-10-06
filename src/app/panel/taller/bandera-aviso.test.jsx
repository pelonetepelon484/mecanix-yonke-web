// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('../../lib/firebase', () => ({ auth: {}, db: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(async () => ({ exists: () => true, data: () => ({ nombre: 'Taller Prueba', aceptacionVersion: 'v0' }) })),
}));
vi.mock('../AuthContext', () => ({ useAuth: () => ({ tallerId: 'T1' }) }));
vi.mock('./cotizaciones/datos', () => ({
  leerConfigCotizaciones: vi.fn(async () => ({ terminosVersion: 'v1', resumenCambios: 'Cambios de prueba' })),
  aceptarVersion: vi.fn(async () => {}),
}));

const { default: PanelTaller } = await import('./page.js');

afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

describe('aviso de cambios de términos en el inicio del taller', () => {
  it('con la bandera APAGADA no se muestra, aunque la versión sea distinta', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '0');
    render(<PanelTaller />);
    expect(await screen.findByText('Taller Prueba')).toBeInTheDocument();
    expect(screen.queryByText(/Cambiaron los Términos/)).not.toBeInTheDocument();
  });
  it('con la bandera ENCENDIDA sí se muestra cuando la versión es distinta', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    render(<PanelTaller />);
    expect(await screen.findByText(/Cambiaron los Términos/)).toBeInTheDocument();
  });
});
