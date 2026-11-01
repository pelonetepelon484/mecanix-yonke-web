// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const CORREO = '6641234567@yonkes.mecanixyonkevirtual.com';
const reautenticar = vi.fn(async () => {});
const actualizar = vi.fn(async () => {});
vi.mock('../../lib/firebase', () => ({ auth: { currentUser: { email: '6641234567@yonkes.mecanixyonkevirtual.com' } } }));
vi.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: (correo, clave) => ({ correo, clave }) },
  reauthenticateWithCredential: (...a) => reautenticar(...a),
  updatePassword: (...a) => actualizar(...a),
}));
const { default: CambiarPassword } = await import('./CambiarPassword');

afterEach(() => { cleanup(); vi.clearAllMocks(); });

function llenar(actual, nueva) {
  fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
  fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: actual } });
  fireEvent.change(screen.getByLabelText(/Contraseña nueva/), { target: { value: nueva } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
}

describe('cambiar contraseña', () => {
  it('confirma la actual y guarda la nueva', async () => {
    render(<CambiarPassword />);
    llenar('temporal12', 'nueva-clave');
    expect(await screen.findByRole('status')).toHaveTextContent('Tu contraseña se cambió.');
    expect(reautenticar.mock.calls[0][1]).toEqual({ correo: CORREO, clave: 'temporal12' });
    expect(actualizar.mock.calls[0][1]).toBe('nueva-clave');
  });
  it('contraseña nueva muy corta: no llama a Firebase', async () => {
    render(<CambiarPassword />);
    llenar('temporal12', 'corta');
    expect(await screen.findByRole('alert')).toHaveTextContent('al menos 8');
    expect(reautenticar).not.toHaveBeenCalled();
  });
  it('actual equivocada: lo dice y no cambia nada', async () => {
    reautenticar.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'auth/invalid-credential' }));
    render(<CambiarPassword />);
    llenar('mala', 'nueva-clave');
    expect(await screen.findByRole('alert')).toHaveTextContent('actual no es correcta');
    expect(actualizar).not.toHaveBeenCalled();
  });
  it('cancelar borra lo escrito', async () => {
    render(<CambiarPassword />);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cambiar contraseña' }));
    await waitFor(() => expect(screen.getByLabelText('Contraseña actual')).toHaveValue(''));
  });
});
