// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const leerYonkeEstadoActivo = vi.fn(async () => ({ estado: 'baja-california', activo: true, nombre: 'Yonke Prueba', whatsapp: '6641234567' }));
const leerConfigPedidosClientes = vi.fn(async () => ({ habilitado: true }));
const escuchar = vi.fn();
const responderPedido = vi.fn(async () => {});
let abiertos = [];
let deOtros = [];
const escucharOtros = vi.fn();
const guardarVerOtrosEstados = vi.fn(async () => {});
let yaRespondio = vi.fn(async () => null);

vi.mock('./solicitudesPiezasDatos', () => ({ leerYonkeEstadoActivo: (...a) => leerYonkeEstadoActivo(...a) }));
vi.mock('./pedidosClientesDatos', () => ({
  leerConfigPedidosClientes: (...a) => leerConfigPedidosClientes(...a),
  escucharPedidosClientesAbiertos: (estado, cb) => { escuchar(estado); cb(abiertos); return () => {}; },
  escucharPedidosClientesOtrosEstados: (cb) => { escucharOtros(); cb(deOtros); return () => {}; },
  guardarVerOtrosEstados: (...a) => guardarVerOtrosEstados(...a),
  yaRespondioPedido: (...a) => yaRespondio(...a),
  responderPedido: (...a) => responderPedido(...a),
}));
vi.mock('../lib/estados', () => ({
  cargarEstados: vi.fn(async () => [{ id: 'baja-california', nombre: 'Baja California' }, { id: 'sonora', nombre: 'Sonora' }, { id: 'jalisco', nombre: 'Jalisco' }]),
}));

const { default: PedidosClientesYonke } = await import('./PedidosClientesYonke.js');

const ID = 'Pedido00000000000001';
const pedido = { id: ID, pieza: 'Alternador', vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2005 }, estado: 'baja-california', expiraAt: 'X' };

afterEach(() => {
  cleanup();
  abiertos = [];
  deOtros = [];
  escucharOtros.mockClear();
  guardarVerOtrosEstados.mockClear();
  leerYonkeEstadoActivo.mockReset();
  leerYonkeEstadoActivo.mockImplementation(async () => ({ estado: 'baja-california', activo: true, nombre: 'Yonke Prueba', whatsapp: '6641234567' }));
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

describe('Alertas de otros estados (lado del yonke)', () => {
  const SWITCH = { name: 'Ver también alertas de otros estados con envío' };
  const yonkeConEnvio = (extra = {}) => ({ estado: 'baja-california', activo: true, nombre: 'Yonke Prueba', whatsapp: '6641234567', verificado: true, enviosNacionales: true, ...extra });
  const deJalisco = { id: 'Pedido00000000000002', pieza: 'Faro', vehiculo: { marca: 'Ford', modelo: 'Focus', anio: 2012 }, estado: 'jalisco', expiraAt: 'X', aceptaOtrosEstados: true };

  it('segunda bandera apagada: sin interruptor y sin ninguna consulta extra (igual que hoy)', async () => {
    leerYonkeEstadoActivo.mockImplementation(async () => yonkeConEnvio({ verAlertasOtrosEstados: true }));
    abiertos = [pedido];
    render(<PedidosClientesYonke yonkeId="Y1" />);
    expect(await screen.findByText(/Pedidos de clientes \(1\)/)).toBeInTheDocument();
    expect(screen.queryByRole('switch', SWITCH)).not.toBeInTheDocument();
    expect(escucharOtros).not.toHaveBeenCalled();
  });
  it('bandera encendida pero sin Verificado o sin envíos nacionales: sin interruptor', async () => {
    leerConfigPedidosClientes.mockResolvedValue({ habilitado: true, otrosEstados: true });
    for (const extra of [{ verificado: false }, { enviosNacionales: false }]) {
      leerYonkeEstadoActivo.mockImplementation(async () => yonkeConEnvio({ ...extra, verAlertasOtrosEstados: true }));
      abiertos = [pedido];
      render(<PedidosClientesYonke yonkeId="Y1" />);
      expect(await screen.findByText(/Pedidos de clientes \(1\)/)).toBeInTheDocument();
      expect(screen.queryByRole('switch', SWITCH)).not.toBeInTheDocument();
      expect(escucharOtros).not.toHaveBeenCalled();
      cleanup();
    }
  });
  it('apagado por defecto: ve lo mismo que hoy; al encenderlo lo guarda y ve las de otros estados con "📦 Acepta envío"', async () => {
    leerConfigPedidosClientes.mockResolvedValue({ habilitado: true, otrosEstados: true });
    leerYonkeEstadoActivo.mockImplementation(async () => yonkeConEnvio());
    abiertos = [pedido];
    deOtros = [deJalisco, { ...pedido, aceptaOtrosEstados: true }]; // la de su estado no se repite
    render(<PedidosClientesYonke yonkeId="Y1" />);
    const interruptor = await screen.findByRole('switch', SWITCH);
    expect(interruptor).toHaveAttribute('aria-checked', 'false');
    expect(await screen.findByText(/Pedidos de clientes \(1\)/)).toBeInTheDocument();
    expect(escucharOtros).not.toHaveBeenCalled();

    fireEvent.click(interruptor);
    await waitFor(() => expect(guardarVerOtrosEstados).toHaveBeenCalledWith('Y1', true));
    await waitFor(() => expect(interruptor).toHaveAttribute('aria-checked', 'true'));
    expect(await screen.findByText(/Pedidos de clientes \(2\)/)).toBeInTheDocument();
    expect(escucharOtros).toHaveBeenCalled();
    expect(await screen.findByText('📦 Acepta envío · Desde Jalisco')).toBeInTheDocument();
    expect(screen.getAllByText(/Acepta envío/)).toHaveLength(1); // la de su estado, sin etiqueta

    fireEvent.click(screen.getAllByRole('button', { name: 'Responder' })[1]);
    expect(screen.getByRole('dialog')).toHaveTextContent('📦 Acepta envío · Desde Jalisco');
    expect(screen.getByRole('dialog')).not.toHaveTextContent(/6649|WhatsApp del cliente/);
  });
  it('encendido desde antes: ya escucha las de otros estados al abrir', async () => {
    leerConfigPedidosClientes.mockResolvedValue({ habilitado: true, otrosEstados: true });
    leerYonkeEstadoActivo.mockImplementation(async () => yonkeConEnvio({ verAlertasOtrosEstados: true }));
    deOtros = [deJalisco];
    render(<PedidosClientesYonke yonkeId="Y1" />);
    expect(await screen.findByText('📦 Acepta envío · Desde Jalisco')).toBeInTheDocument();
    expect(screen.getByRole('switch', SWITCH)).toHaveAttribute('aria-checked', 'true');
  });
  it('con ?pedido={id} de otro estado que acepta envío y el interruptor apagado: le dice que lo encienda', async () => {
    window.history.replaceState(null, '', `/panel/reservaciones?pedido=${deJalisco.id}`);
    leerConfigPedidosClientes.mockResolvedValue({ habilitado: true, otrosEstados: true });
    leerYonkeEstadoActivo.mockImplementation(async () => yonkeConEnvio());
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, pedido: { ...deJalisco, estadoNombre: 'Jalisco' } }) }));
    render(<PedidosClientesYonke yonkeId="Y1" />);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Esta alerta es de Jalisco y el cliente acepta yonkes de otros estados con envío. Enciende “Ver también alertas de otros estados con envío” para responderla.',
    );
  });
  it('con ?pedido={id} de otro estado y el interruptor encendido: la abre para responder', async () => {
    window.history.replaceState(null, '', `/panel/reservaciones?pedido=${deJalisco.id}`);
    leerConfigPedidosClientes.mockResolvedValue({ habilitado: true, otrosEstados: true });
    leerYonkeEstadoActivo.mockImplementation(async () => yonkeConEnvio({ verAlertasOtrosEstados: true }));
    deOtros = [deJalisco];
    render(<PedidosClientesYonke yonkeId="Y1" />);
    expect(await screen.findByRole('dialog')).toHaveTextContent('Faro');
  });
});
