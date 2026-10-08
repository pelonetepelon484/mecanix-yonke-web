// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/panel/inventario', useRouter: () => ({ push: vi.fn() }) }));
vi.mock('./AuthContext', () => ({ useAuth: () => ({ yonkeId: 'Y1' }) }));
vi.mock('./solicitudesPiezasDatos', () => ({
  leerYonkeEstadoActivo: vi.fn(async () => ({ estado: 'baja-california', activo: true })),
  escucharSolicitudesAbiertas: vi.fn((estado, cb) => { cb([{ id: 'S1' }, { id: 'S2' }]); return () => {}; }),
}));

const { default: BottomNav } = await import('./BottomNav.js');

afterEach(() => cleanup());

describe('badge de "Pedidos" en el BottomNav', () => {
  it('muestra el conteo de solicitudes abiertas del estado del yonke', async () => {
    render(<BottomNav />);
    expect(await screen.findByText('2')).toBeInTheDocument();
  });

  it('sin yonkeId (otro rol) no muestra ningún badge', async () => {
    vi.doMock('./AuthContext', () => ({ useAuth: () => ({ yonkeId: null }) }));
    vi.resetModules();
    const { default: BottomNavSinYonke } = await import('./BottomNav.js');
    render(<BottomNavSinYonke />);
    await waitFor(() => expect(screen.queryByText('2')).not.toBeInTheDocument());
  });
});
