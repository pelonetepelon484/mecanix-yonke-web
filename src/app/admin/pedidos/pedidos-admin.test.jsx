// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../lib/estados', () => ({
  cargarEstados: vi.fn(async () => [{ id: 'baja-california', nombre: 'Baja California' }, { id: 'sonora', nombre: 'Sonora' }]),
}));

const DIA = 24 * 60 * 60 * 1000;
const ts = (ms) => ({ toDate: () => new Date(Date.now() + ms) });
let pedidos = [];
const datos = {
  leerBanderaPedidosClientes: vi.fn(async () => false),
  cambiarBanderaPedidosClientes: vi.fn(async () => {}),
  listarPedidosClientes: vi.fn(async () => pedidos),
  contarRespuestas: vi.fn(async (_c, id) => (id === 'A' ? 2 : 0)),
  leerDetallePedidoCliente: vi.fn(async () => ({
    clienteWhatsapp: '6649998877',
    respuestas: [{ yonkeId: 'Y1', yonkeNombre: 'El Güero', tieneLaPieza: true, precio: 1500, nota: 'Original', whatsapp: '6641111111', verificado: true }],
  })),
  cerrarPedidoCliente: vi.fn(async () => {}),
  cancelarPedidoCliente: vi.fn(async () => {}),
  reabrirPedidoCliente: vi.fn(async () => {}),
  borrarPedidoCliente: vi.fn(async () => {}),
  listarSolicitudesTalleres: vi.fn(async () => [{ id: 'S1', pieza: 'Faro', vehiculo: { marca: 'Ford', modelo: 'F-150', anio: 2010 }, tallerNombre: 'Taller Uno', estado: 'sonora', estadoSolicitud: 'abierta', creadoAt: ts(0), expiraAt: ts(DIA) }]),
  leerRespuestasSolicitud: vi.fn(async () => [{ yonkeId: 'Y2', yonkeNombre: 'Yonke Sonora', tieneLaPieza: false, nota: '', whatsapp: '6622222222' }]),
  borrarSolicitudTaller: vi.fn(async () => {}),
};
vi.mock('./datos', () => datos);

const { default: PedidosAdminPage } = await import('./page.js');

beforeEach(() => {
  pedidos = [
    { id: 'A', pieza: 'Alternador', vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2005 }, estado: 'baja-california', estadoPedido: 'abierta', creadoAt: ts(-DIA), expiraAt: ts(4 * DIA) },
    { id: 'B', pieza: 'Defensa', vehiculo: { marca: 'Ford', modelo: 'Focus', anio: 2012 }, estado: 'sonora', estadoPedido: 'abierta', creadoAt: ts(-DIA), expiraAt: ts(4 * DIA) },
    { id: 'C', pieza: 'Faro', vehiculo: { marca: 'VW', modelo: 'Jetta', anio: 2015 }, estado: 'baja-california', estadoPedido: 'cerrada', creadoAt: ts(-3 * DIA), expiraAt: ts(2 * DIA), cerradoAt: ts(-DIA) },
  ];
  window.confirm = vi.fn(() => true);
});
afterEach(() => { cleanup(); Object.values(datos).forEach((f) => f.mockClear()); });

const abrir = async (pieza) => fireEvent.click(await screen.findByText(pieza));

describe('panel admin "Pedidos de piezas"', () => {
  it('muestra los contadores: abiertos, con respuesta, sin respuesta y cerrados en 7 días', async () => {
    render(<PedidosAdminPage />);
    const contador = async (titulo) => within((await screen.findByText(titulo)).parentElement).getByText(/^\d+$/).textContent;
    expect(await contador('Pedidos abiertos')).toBe('2');
    expect(await contador('Con al menos una respuesta')).toBe('1');
    expect(await contador('Sin respuestas')).toBe('1');
    expect(await contador('Cerrados (últimos 7 días)')).toBe('1');
    expect(datos.contarRespuestas).toHaveBeenCalledTimes(2); // solo los abiertos
  });
  it('filtra por estado del pedido y por estado de la República', async () => {
    render(<PedidosAdminPage />);
    await screen.findByText('Alternador');
    fireEvent.change(screen.getByLabelText('Filtrar por estado del pedido'), { target: { value: 'cerrada' } });
    expect(screen.queryByText('Alternador')).not.toBeInTheDocument();
    expect(screen.getByText('Faro')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Filtrar por estado del pedido'), { target: { value: 'todos' } });
    fireEvent.change(screen.getByLabelText('Filtrar por estado de la República'), { target: { value: 'sonora' } });
    expect(screen.getByText('Defensa')).toBeInTheDocument();
    expect(screen.queryByText('Alternador')).not.toBeInTheDocument();
  });
  it('al abrir un pedido muestra el WhatsApp del cliente con botón a WhatsApp y las respuestas', async () => {
    render(<PedidosAdminPage />);
    await abrir('Alternador');
    const enlace = await screen.findByRole('link', { name: /6649998877/ });
    expect(enlace.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/526649998877\?text=/);
    expect(screen.getByText('El Güero')).toBeInTheDocument();
    expect(screen.getByText(/La tiene · \$1,500 · Original/)).toBeInTheDocument();
    expect(screen.getByText(/WhatsApp del yonke: 6641111111/)).toBeInTheDocument();
    expect(screen.getByText(/✅ Verificado/)).toBeInTheDocument();
  });
  it('cada acción pide confirmación; si el admin dice que no, no hace nada', async () => {
    window.confirm = vi.fn(() => false);
    render(<PedidosAdminPage />);
    await abrir('Alternador');
    for (const nombre of ['Cerrar', 'Cancelar', 'Reabrir 5 días', 'Borrar']) fireEvent.click(await screen.findByRole('button', { name: nombre }));
    expect(window.confirm).toHaveBeenCalledTimes(4);
    for (const f of ['cerrarPedidoCliente', 'cancelarPedidoCliente', 'reabrirPedidoCliente', 'borrarPedidoCliente']) expect(datos[f]).not.toHaveBeenCalled();
  });
  it('con confirmación, cerrar / cancelar / reabrir / borrar llaman a su función y recargan la lista', async () => {
    for (const [boton, f] of [['Cerrar', 'cerrarPedidoCliente'], ['Cancelar', 'cancelarPedidoCliente'], ['Reabrir 5 días', 'reabrirPedidoCliente'], ['Borrar', 'borrarPedidoCliente']]) {
      render(<PedidosAdminPage />);
      await abrir('Alternador');
      datos.listarPedidosClientes.mockClear();
      fireEvent.click(await screen.findByRole('button', { name: boton }));
      await waitFor(() => expect(datos[f]).toHaveBeenCalledWith('A'));
      await waitFor(() => expect(datos.listarPedidosClientes).toHaveBeenCalled());
      cleanup();
    }
  });
  it('un pedido cerrado solo ofrece reabrir o borrar', async () => {
    render(<PedidosAdminPage />);
    await abrir('Faro');
    await screen.findByRole('button', { name: 'Reabrir 5 días' });
    expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
  });
  it('el interruptor escribe config/pedidosClientes.habilitado tras confirmar', async () => {
    render(<PedidosAdminPage />);
    const interruptor = await screen.findByRole('switch', { name: 'Pedido de piezas para clientes activado' });
    await waitFor(() => expect(interruptor).not.toBeDisabled());
    expect(interruptor).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(interruptor);
    await waitFor(() => expect(datos.cambiarBanderaPedidosClientes).toHaveBeenCalledWith(true));
    await waitFor(() => expect(interruptor).toHaveAttribute('aria-checked', 'true'));
  });
  it('pestaña de talleres: lista y respuestas en solo lectura, y borrar con confirmación', async () => {
    render(<PedidosAdminPage />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Pedidos de talleres' }));
    await abrir('Faro');
    expect(await screen.findByText('Yonke Sonora')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }));
    await waitFor(() => expect(datos.borrarSolicitudTaller).toHaveBeenCalledWith('S1'));
  });
});
