// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const push = vi.fn();
const replace = vi.fn();
const crearSolicitud = vi.fn(async () => 'SNEW');

vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }));
vi.mock('../../../AuthContext', () => ({ useAuth: () => ({ tallerId: 'T1' }) }));
vi.mock('../../cotizaciones/datos', () => ({
  leerTaller: vi.fn(async () => ({ nombre: 'Taller Uno', whatsapp: '6641110000', activo: true })),
}));
vi.mock('../datos', () => ({ crearSolicitud: (...args) => crearSolicitud(...args) }));
vi.mock('../../../../lib/estados', () => ({
  ESTADO_DEFAULT: 'baja-california',
  cargarEstados: vi.fn(async () => [{ id: 'baja-california', nombre: 'Baja California' }]),
}));
vi.mock('../../../../lib/SelectorMarcaModelo', () => ({
  default: ({ marca, modelo, onMarca, onModelo }) => (
    <>
      <input aria-label="marca" value={marca} onChange={(e) => onMarca(e.target.value)} />
      <input aria-label="modelo" value={modelo} onChange={(e) => onModelo(e.target.value)} />
    </>
  ),
}));

const { default: NuevaSolicitudPieza } = await import('./page.js');

afterEach(() => { cleanup(); crearSolicitud.mockClear(); push.mockClear(); replace.mockClear(); });

describe('Pedir una pieza: formulario nuevo', () => {
  it('sin marca/modelo/pieza, muestra el primer error y no envía', async () => {
    render(<NuevaSolicitudPieza />);
    fireEvent.click(await screen.findByText('Enviar pedido'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Escribe la marca y el modelo del vehículo.');
    expect(crearSolicitud).not.toHaveBeenCalled();
  });

  it('con todo completo, crea la solicitud y navega al detalle', async () => {
    render(<NuevaSolicitudPieza />);
    fireEvent.change(await screen.findByLabelText('marca'), { target: { value: 'Nissan' } });
    fireEvent.change(screen.getByLabelText('modelo'), { target: { value: 'Sentra' } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2001' } });
    fireEvent.change(screen.getByPlaceholderText('Ej. Defensa delantera'), { target: { value: 'Defensa delantera' } });
    fireEvent.click(screen.getByText('Enviar pedido'));
    await waitFor(() => expect(crearSolicitud).toHaveBeenCalledWith(expect.objectContaining({
      tallerId: 'T1', tallerNombre: 'Taller Uno', tallerWhatsapp: '6641110000',
      estado: 'baja-california', pieza: 'Defensa delantera',
      vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 },
    })));
    expect(replace).toHaveBeenCalledWith('/panel/taller/pedir-pieza/SNEW');
  });

  it('con el taller desactivado, no muestra el formulario', async () => {
    const mod = await import('../../cotizaciones/datos.js');
    mod.leerTaller.mockResolvedValueOnce({ nombre: 'Taller Uno', whatsapp: '6641110000', activo: false });
    render(<NuevaSolicitudPieza />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu taller está desactivado: no puedes pedir piezas nuevas.');
    expect(screen.queryByText('Enviar pedido')).not.toBeInTheDocument();
  });
});
