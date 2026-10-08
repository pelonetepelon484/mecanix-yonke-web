// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const leerYonkeEstadoActivo = vi.fn(async () => ({ estado: 'baja-california', activo: true, nombre: 'Yonke Prueba', whatsapp: '6641234567' }));
const leerConfigPedidosClientes = vi.fn(async () => ({ habilitado: true }));
const escuchar = vi.fn();
const responderPedido = vi.fn(async () => {});
let abiertos = [];
let yaRespondio = vi.fn(async () => null);

vi.mock('./solicitudesPiezasDatos', () => ({ leerYonkeEstadoActivo: (...a) => leerYonkeEstadoActivo(...a) }));
vi.mock('./pedidosClientesDatos', () => ({
  leerConfigPedidosClientes: (...a) => leerConfigPedidosClientes(...a),
  escucharPedidosClientesAbiertos: (estado, cb) => { escuchar(estado); cb(abiertos); return () => {}; },
  yaRespondioPedido: (...a) => yaRespondio(...a),
  responderPedido: (...a) => responderPedido(...a),
}));
vi.mock('../lib/estados', () => ({
  cargarEstados: vi.fn(async () => [{ id: 'baja-california', nombre: 'Baja California' }, { id: 'sonora', nombre: 'Sonora' }]),
}));

const { default: PedidosClientesYonke } = await import('./PedidosClientesYonke.js');

const ID = 'Pedido00000000000001';
const pedido = { id: ID, pieza: 'Alternador', vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2005 }, estado: 'baja-california', expiraAt: 'X' };

afterEach(() => {
  cleanup();
  abiertos = [];
  yaRespondio = vi.fn(async () => null);
  leerYonkeEstadoActivo.mockClear();
  escuchar.mockClear();
  responderPedido.mockClear();
  leerConfigPedidosClientes.mockReset();
  leerConfigPedidosClientes.mockResolvedValue({ habilitado: true });
  window.history.replaceState(null, '', '/panel/reservaciones');
  delete global.fetch;
});

describe('Pedidos de clientes (lado del yonke)', () => {
  it('con la función apagada no hace ninguna otra lectura ni muestra nada', async () => {
    leerConfigPedidosClientes.mockResolvedValue(null);
    const { container } = render(<PedidosClientesYonke yonkeId="Y1" />);
    await waitFor(() => expect(leerConfigPedidosClientes).toHaveBeenCalled());
    expect(leerYonkeEstadoActivo).not.toHaveBeenCalled();
    expect(escuchar).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });
  it('muestra los pedidos del estado como "Cliente particular", sin ningún dato del cliente', async () => {
    abiertos = [pedido];
    render(<PedidosClientesYonke yonkeId="Y1" />);
    expect(await screen.findByText(/Pedidos de clientes \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Cliente particular/)).toBeInTheDocument();
    expect(escuchar).toHaveBeenCalledWith('baja-california');
  });
  it('responde "La tengo" con precio y nota corta, con el nombre y WhatsApp del yonke', async () => {
    abiertos = [pedido];
    render(<PedidosClientesYonke yonkeId="Y1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Responder' }));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1500' } });
    fireEvent.change(screen.getByPlaceholderText(/Original/), { target: { value: 'Original' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar respuesta' }));
    await waitFor(() => expect(responderPedido).toHaveBeenCalledWith(pedido, 'Y1', {
      yonkeNombre: 'Yonke Prueba', whatsapp: '6641234567', tieneLaPieza: true, precio: 1500, nota: 'Original',
    }));
    await waitFor(() => expect(screen.queryByText(/Pedidos de clientes/)).not.toBeInTheDocument());
  });
  it('con ?pedido={id} de su estado, abre ese pedido para responder', async () => {
    window.history.replaceState(null, '', `/panel/reservaciones?pedido=${ID}`);
    abiertos = [pedido];
    render(<PedidosClientesYonke yonkeId="Y1" />);
    expect(await screen.findByRole('dialog')).toHaveTextContent('Alternador');
  });
  it('con ?pedido={id} de OTRO estado, explica que solo responden los yonkes de ese estado', async () => {
    window.history.replaceState(null, '', `/panel/reservaciones?pedido=${ID}`);
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, pedido: { ...pedido, estado: 'sonora', estadoNombre: 'Sonora' } }) }));
    render(<PedidosClientesYonke yonkeId="Y1" />);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Este pedido es de Sonora y tu yonke está registrado en Baja California. Solo los yonkes de Sonora pueden responderlo.',
    );
  });
  it('con ?pedido={id} que ya venció, lo dice claro', async () => {
    window.history.replaceState(null, '', `/panel/reservaciones?pedido=${ID}`);
    global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({ ok: false }) }));
    render(<PedidosClientesYonke yonkeId="Y1" />);
    expect(await screen.findByRole('status')).toHaveTextContent('Este pedido ya venció o ya no está disponible.');
  });
  it('con ?pedido={id} ya respondido, avisa en vez de abrir el formulario', async () => {
    window.history.replaceState(null, '', `/panel/reservaciones?pedido=${ID}`);
    abiertos = [pedido];
    yaRespondio = vi.fn(async () => ({ tieneLaPieza: true }));
    render(<PedidosClientesYonke yonkeId="Y1" />);
    expect(await screen.findByRole('status')).toHaveTextContent('Ya respondiste este pedido.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
