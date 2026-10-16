// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

let sesion = { user: { uid: 'u1' }, loading: false };
let ruta = '/panel/inventario';
let bandera = { botonPanel: true };
const leerConfigPortada = vi.fn(async () => bandera);
vi.mock('./AuthContext', () => ({ useAuth: () => sesion }));
vi.mock('next/navigation', () => ({ usePathname: () => ruta }));
vi.mock('../lib/firebase', () => ({ db: {} }));
vi.mock('../../lib/configPortada', () => ({ leerConfigPortada: (...a) => leerConfigPortada(...a) }));

const { default: EnlaceIrAMecanix } = await import('./EnlaceIrAMecanix.js');

afterEach(() => { cleanup(); sesion = { user: { uid: 'u1' }, loading: false }; ruta = '/panel/inventario'; bandera = { botonPanel: true }; vi.clearAllMocks(); });

describe('"← Ir a Mecanix" en el panel', () => {
  it('con sesión y la bandera encendida: enlace a la portada', async () => {
    render(<EnlaceIrAMecanix />);
    expect(await screen.findByRole('link', { name: '← Ir a Mecanix' })).toHaveAttribute('href', '/');
  });
  it('bandera apagada: nada', async () => {
    bandera = { botonPanel: false };
    const { container } = render(<EnlaceIrAMecanix />);
    await waitFor(() => expect(leerConfigPortada).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
  it('sin sesión no lee la bandera; en el acceso y los registros no aparece', async () => {
    sesion = { user: null, loading: false };
    render(<EnlaceIrAMecanix />);
    expect(leerConfigPortada).not.toHaveBeenCalled();
    cleanup();
    sesion = { user: { uid: 'u1' }, loading: false };
    ruta = '/panel/registro';
    const { container } = render(<EnlaceIrAMecanix />);
    await waitFor(() => expect(leerConfigPortada).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
