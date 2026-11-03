// @vitest-environment jsdom
// /panel/codigo-temporal: el yonke cambia su código por una contraseña nueva y entra con ella.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const push = vi.fn();
const entrar = vi.fn(async () => {});
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('firebase/auth', () => ({ signInWithEmailAndPassword: (...a) => entrar(...a) }));
vi.mock('../../lib/firebase', () => ({ auth: 'auth' }));
const { default: Pagina } = await import('./page.js');

const llenar = () => {
  fireEvent.change(screen.getByLabelText('Tu WhatsApp (10 dígitos)'), { target: { value: '6641234567' } });
  fireEvent.change(screen.getByLabelText('Contraseña temporal'), { target: { value: 'abcdefghjkmn' } });
  fireEvent.change(screen.getByLabelText(/Contraseña nueva/), { target: { value: 'clave-nueva' } });
  fireEvent.click(screen.getByRole('button', { name: 'Crear mi contraseña' }));
};

beforeEach(() => { global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) })); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('código temporal', () => {
  it('cambia la contraseña y entra con la nueva', async () => {
    render(<Pagina />);
    llenar();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/panel'));
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ whatsapp: '6641234567', codigo: 'abcdefghjkmn', password: 'clave-nueva' });
    expect(entrar).toHaveBeenCalledWith('auth', '6641234567@yonkes.mecanixyonkevirtual.com', 'clave-nueva');
  });
  it('código rechazado: muestra el mensaje y no entra', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({ ok: false, mensaje: 'El código no es válido' }) }));
    render(<Pagina />);
    llenar();
    expect(await screen.findByRole('alert')).toHaveTextContent('El código no es válido');
    expect(entrar).not.toHaveBeenCalled();
  });
  it('si falla la entrada automática, dice que ya se cambió', async () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {});
    entrar.mockRejectedValueOnce(new Error('x'));
    render(<Pagina />);
    llenar();
    expect(await screen.findByText('Tu contraseña se cambió.')).toBeInTheDocument();
    consola.mockRestore();
  });
});
