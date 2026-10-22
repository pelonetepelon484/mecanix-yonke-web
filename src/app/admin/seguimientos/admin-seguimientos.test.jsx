// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { createHash } from 'node:crypto';

const guardado = new Map();
const deleteDoc = vi.fn(async (ruta) => { guardado.delete(ruta); });
const getDoc = vi.fn(async (ruta) => ({ exists: () => guardado.has(ruta), data: () => guardado.get(ruta) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (_db, ...a) => a.join('/'), getDoc: (...a) => getDoc(...a), deleteDoc: (...a) => deleteDoc(...a),
}));
// La huella se calcula igual que en el navegador (SHA-256 hex); aquí con Node.
vi.mock('../../../lib/seguimiento', async (original) => ({
  ...(await original()), huellaSeguimiento: async (t) => createHash('sha256').update(t).digest('hex'),
}));

const { default: AdminSeguimientos } = await import('./page.js');
const TOKEN = 'Q'.repeat(40) + 'abc';
const RUTA = `seguimientos/${createHash('sha256').update(TOKEN).digest('hex')}`;
const ts = (d) => ({ toMillis: () => d.getTime(), toDate: () => d });

beforeEach(() => {
  guardado.clear(); deleteDoc.mockClear(); getDoc.mockClear();
  guardado.set(RUTA, {
    tallerId: 'T1', folio: 'O261020-ABCD', tallerNombre: 'Taller Peña', tallerWhatsapp: '6641234567', marca: 'Nissan', modelo: 'Sentra', anio: 2001,
    estado: 'listo', nota: 'Hoy', actualizadoAt: ts(new Date()), expiraAt: ts(new Date(Date.now() + 86400000)),
  });
});
afterEach(cleanup);

describe('admin: enlaces de seguimiento', () => {
  it('pega el enlace, ve lo que ve el público y lo desactiva', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<AdminSeguimientos />);
    fireEvent.change(screen.getByLabelText('Enlace de seguimiento'), { target: { value: `https://www.mecanixyonkevirtual.com/seguimiento/${TOKEN}` } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    const resultado = await screen.findByTestId('resultado-seguimiento');
    expect(getDoc).toHaveBeenCalledWith(RUTA);
    expect(resultado).toHaveTextContent('Taller: Taller Peña');
    expect(resultado).toHaveTextContent('Vehículo: Nissan Sentra 2001');
    expect(resultado).toHaveTextContent('Estado: Listo');
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
    await waitFor(() => expect(deleteDoc).toHaveBeenCalledWith(RUTA));
    expect(await screen.findByText('Enlace desactivado.')).toBeInTheDocument();
  });
  it('un texto que no es enlace de seguimiento no consulta nada', async () => {
    render(<AdminSeguimientos />);
    fireEvent.change(screen.getByLabelText('Enlace de seguimiento'), { target: { value: 'https://otro.com/x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByRole('status')).toHaveTextContent('no parece un enlace de seguimiento');
    expect(getDoc).not.toHaveBeenCalled();
  });
  it('enlace que no existe: lo dice, sin botón de desactivar', async () => {
    guardado.clear();
    render(<AdminSeguimientos />);
    fireEvent.change(screen.getByLabelText('Enlace de seguimiento'), { target: { value: TOKEN } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByText(/no está activo/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desactivar' })).not.toBeInTheDocument();
  });
});
