// @vitest-environment jsdom
// /admin/pedidos: "Sugerir yonke" (con su bandera, pedido abierto, yonkes activos sin responder por
// estado, sin precio: "Precio no informado") y "Quitar respuesta" (sin bandera; bloqueado si el taller ya
// eligió esa respuesta), en las dos pestañas.
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../lib/estados', () => ({
  cargarEstados: vi.fn(async () => [{ id: 'baja-california', nombre: 'Baja California' }, { id: 'sonora', nombre: 'Sonora' }]),
}));

const DIA = 24 * 60 * 60 * 1000;
const ts = (ms) => ({ toDate: () => new Date(Date.now() + ms) });
const YONKES = {
  'baja-california': [
    { id: 'Y1', nombre: 'El Güero', whatsapp: '6641111111', estado: 'baja-california' },
    { id: 'Y5', nombre: 'Autopartes Ñandú', whatsapp: '6645555555', estado: 'baja-california' },
    { id: 'Y6', nombre: 'Yonke Otay', whatsapp: '6646666666', estado: 'baja-california' },
  ],
  sonora: [{ id: 'Y2', nombre: 'Yonke Sonora', whatsapp: '6622222222', estado: 'sonora' }],
};
let banderas;
let pedidos;
let respuestasCliente;
let solicitudes;
const datos = {
  leerBanderaPedidosClientes: vi.fn(async () => true),
  cambiarBanderaPedidosClientes: vi.fn(async () => {}),
  listarPedidosClientes: vi.fn(async () => pedidos),
  contarRespuestas: vi.fn(async () => 1),
  leerDetallePedidoCliente: vi.fn(async () => ({ clienteWhatsapp: '6649998877', respuestas: respuestasCliente })),
  cerrarPedidoCliente: vi.fn(async () => {}),
  cancelarPedidoCliente: vi.fn(async () => {}),
  reabrirPedidoCliente: vi.fn(async () => {}),
  borrarPedidoCliente: vi.fn(async () => {}),
  listarSolicitudesTalleres: vi.fn(async () => solicitudes),
  leerRespuestasSolicitud: vi.fn(async () => [
    { yonkeId: 'Y2', yonkeNombre: 'Yonke Sonora', tieneLaPieza: true, precio: 800, nota: '', whatsapp: '6622222222' },
    { yonkeId: 'Y7', yonkeNombre: 'Yonke Elegido', tieneLaPieza: true, precio: 700, nota: '', whatsapp: '6627777777' },
  ]),
  borrarSolicitudTaller: vi.fn(async () => {}),
  leerBanderasSugerirYonke: vi.fn(async () => banderas),
  listarYonkesActivosDeEstado: vi.fn(async (estado) => YONKES[estado] || []),
  sugerirYonke: vi.fn(async () => {}),
  quitarRespuesta: vi.fn(async () => {}),
  leerWhatsappSolicitante: vi.fn(async () => '6649998877'),
};
vi.mock('./datos', () => datos);

const { default: PedidosAdminPage } = await import('./page.js');

beforeEach(() => {
  banderas = { clientes: true, talleres: true };
  pedidos = [
    { id: 'A', pieza: 'Alternador', vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2005 }, estado: 'baja-california', estadoPedido: 'abierta', creadoAt: ts(-DIA), expiraAt: ts(4 * DIA) },
    { id: 'B', pieza: 'Defensa', vehiculo: { marca: 'Ford', modelo: 'Focus', anio: 2012 }, estado: 'baja-california', estadoPedido: 'abierta', aceptaOtrosEstados: true, creadoAt: ts(-DIA), expiraAt: ts(4 * DIA) },
    { id: 'C', pieza: 'Faro', vehiculo: { marca: 'VW', modelo: 'Jetta', anio: 2015 }, estado: 'baja-california', estadoPedido: 'cerrada', creadoAt: ts(-3 * DIA), expiraAt: ts(2 * DIA) },
    { id: 'V', pieza: 'Radiador', vehiculo: { marca: 'VW', modelo: 'Golf', anio: 2010 }, estado: 'baja-california', estadoPedido: 'abierta', creadoAt: ts(-6 * DIA), expiraAt: ts(-DIA) },
  ];
  respuestasCliente = [
    { yonkeId: 'Y1', yonkeNombre: 'El Güero', tieneLaPieza: true, precio: 1500, nota: 'Original', whatsapp: '6641111111', verificado: true },
  ];
  solicitudes = [
    { id: 'S1', pieza: 'Faro', vehiculo: { marca: 'Ford', modelo: 'F-150', anio: 2010 }, tallerNombre: 'Taller Uno', estado: 'sonora', estadoSolicitud: 'abierta', yonkeElegido: null, creadoAt: ts(0), expiraAt: ts(DIA) },
    { id: 'S2', pieza: 'Puerta', vehiculo: { marca: 'Ford', modelo: 'Ranger', anio: 2008 }, tallerNombre: 'Taller Uno', estado: 'sonora', estadoSolicitud: 'cerrada', yonkeElegido: 'Y7', creadoAt: ts(0), expiraAt: ts(DIA) },
  ];
  window.confirm = vi.fn(() => true);
});
afterEach(() => { cleanup(); Object.values(datos).forEach((f) => f.mockClear()); });

const abrir = async (pieza) => fireEvent.click(await screen.findByText(pieza));
const llenarAutorizacion = () => {
  fireEvent.change(screen.getByLabelText('Medio por el que la recibiste'), { target: { value: 'whatsapp' } });
  fireEvent.change(screen.getByLabelText('Fecha y hora en que la recibiste'), { target: { value: '2026-10-30T10:30' } });
  fireEvent.change(screen.getByLabelText('Mensaje del yonke (pégalo completo)'), { target: { value: '  Sí la tengo y autorizo.  ' } });
  fireEvent.click(screen.getByLabelText(/Confirmo que el yonke me autorizó por escrito/));
};
const aTalleres = async () => fireEvent.click(await screen.findByRole('tab', { name: 'Pedidos de talleres' }));

describe('Sugerir yonke: pedidos de clientes', () => {
  it('sin la bandera no aparece; "Quitar respuesta" sí', async () => {
    banderas = { clientes: false, talleres: false };
    render(<PedidosAdminPage />);
    await abrir('Alternador');
    await screen.findByText('El Güero');
    expect(screen.queryByRole('button', { name: 'Sugerir yonke' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar respuesta' })).toBeInTheDocument();
  });

  it('no aparece en pedidos cerrados ni vencidos', async () => {
    for (const pieza of ['Faro', 'Radiador']) {
      render(<PedidosAdminPage />);
      await abrir(pieza);
      await screen.findByText('El Güero');
      expect(screen.queryByRole('button', { name: 'Sugerir yonke' })).not.toBeInTheDocument();
      cleanup();
    }
  });

  it('lista los activos del estado que no han respondido, busca por nombre, sin precio, y guarda tras confirmar', async () => {
    render(<PedidosAdminPage />);
    await abrir('Alternador');
    fireEvent.click(await screen.findByRole('button', { name: 'Sugerir yonke' }));
    const grupo = await screen.findByRole('radiogroup', { name: 'Yonkes' });
    expect(datos.listarYonkesActivosDeEstado).toHaveBeenCalledWith('baja-california', { sinLigeros: false });
    expect(within(grupo).queryByText('El Güero')).not.toBeInTheDocument(); // ya respondió
    expect(within(grupo).getByText('Autopartes Ñandú')).toBeInTheDocument();
    // Sin otros estados (el pedido no los acepta) y sin campo de precio.
    expect(screen.queryByLabelText('Mostrar también otros estados')).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.getByText('Precio no informado')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Buscar yonke por nombre'), { target: { value: 'nandu' } });
    expect(within(grupo).queryByText('Yonke Otay')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar sugerencia' })).toBeDisabled();
    fireEvent.click(within(grupo).getByRole('radio'));
    expect(screen.getByRole('button', { name: 'Guardar sugerencia' })).toBeDisabled(); // falta la autorización
    llenarAutorizacion();
    datos.leerDetallePedidoCliente.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar sugerencia' }));

    await waitFor(() => expect(datos.sugerirYonke).toHaveBeenCalledWith('pedidosClientes', 'A', YONKES['baja-california'][1], {
      medio: 'whatsapp', mensaje: 'Sí la tengo y autorizo.', recibidoAt: new Date('2026-10-30T10:30'),
    }));
    await waitFor(() => expect(datos.leerDetallePedidoCliente).toHaveBeenCalledWith('A'));
  });

  it('sin la casilla de autorización, no deja guardar', async () => {
    render(<PedidosAdminPage />);
    await abrir('Alternador');
    fireEvent.click(await screen.findByRole('button', { name: 'Sugerir yonke' }));
    fireEvent.click(within(await screen.findByRole('radiogroup', { name: 'Yonkes' })).getAllByRole('radio')[0]);
    llenarAutorizacion();
    fireEvent.click(screen.getByLabelText(/Confirmo que el yonke me autorizó por escrito/));
    expect(screen.getByRole('button', { name: 'Guardar sugerencia' })).toBeDisabled();
    expect(datos.sugerirYonke).not.toHaveBeenCalled();
  });

  it('solo ofrece medios escritos', async () => {
    render(<PedidosAdminPage />);
    await abrir('Alternador');
    fireEvent.click(await screen.findByRole('button', { name: 'Sugerir yonke' }));
    await screen.findByRole('radiogroup', { name: 'Yonkes' });
    const medios = within(screen.getByLabelText('Medio por el que la recibiste')).getAllByRole('option').map((o) => o.value);
    expect(medios).toEqual(['', 'whatsapp', 'sms', 'correo', 'otro']);
  });

  it('con aceptaOtrosEstados: "Mostrar también otros estados" deja elegir otro estado (consulta solo ese)', async () => {
    render(<PedidosAdminPage />);
    await abrir('Defensa');
    fireEvent.click(await screen.findByRole('button', { name: 'Sugerir yonke' }));
    await screen.findByRole('radiogroup', { name: 'Yonkes' });
    expect(screen.queryByLabelText('Estado de los yonkes')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Mostrar también otros estados'));
    fireEvent.change(screen.getByLabelText('Estado de los yonkes'), { target: { value: 'sonora' } });
    await waitFor(() => expect(datos.listarYonkesActivosDeEstado).toHaveBeenCalledWith('sonora', { sinLigeros: false }));
    expect(await screen.findByText(/Yonke Sonora · Sonora/)).toBeInTheDocument();
  });

  it('respuesta sugerida: marca "Sugerida por admin" y "Precio no informado" (nunca un precio vacío)', async () => {
    respuestasCliente = [{ yonkeId: 'Y5', yonkeNombre: 'Autopartes Ñandú', tieneLaPieza: true, precioATratar: true, creadoPorAdmin: true, nota: '', whatsapp: '6645555555', verificado: false }];
    render(<PedidosAdminPage />);
    await abrir('Alternador');
    expect(await screen.findByText('🤝 Sugerida por admin')).toBeInTheDocument();
    expect(screen.getByText('La tiene · Precio no informado')).toBeInTheDocument();
  });

  it('quitar respuesta: confirma, la quita y recarga el detalle', async () => {
    render(<PedidosAdminPage />);
    await abrir('Alternador');
    fireEvent.click(await screen.findByRole('button', { name: 'Quitar respuesta' }));
    expect(screen.getByRole('button', { name: 'Confirmar y quitar' })).toBeDisabled(); // sin motivo no
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'sinPieza' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y quitar' }));
    await waitFor(() => expect(datos.quitarRespuesta).toHaveBeenCalledWith('pedidosClientes', 'A', expect.objectContaining({ yonkeId: 'Y1' }), 'sinPieza'));
    expect(window.confirm.mock.calls.at(-1)[0]).toMatch(/Quitar la respuesta de El Güero/);
    await waitFor(() => expect(datos.leerDetallePedidoCliente).toHaveBeenCalledTimes(2));
    expect((await screen.findByRole('link', { name: 'Avisar al cliente' })).getAttribute('href')).toContain('wa.me/526649998877');
    expect(screen.getByRole('link', { name: 'Avisar al yonke' }).getAttribute('href')).toContain('Ya%20no%20tiene%20la%20pieza');
  });

  it('número ajeno: no ofrece avisar al yonke, porque ese número es de quien reclamó', async () => {
    render(<PedidosAdminPage />);
    await abrir('Alternador');
    fireEvent.click(await screen.findByRole('button', { name: 'Quitar respuesta' }));
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'numeroAjeno' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y quitar' }));
    expect(await screen.findByRole('link', { name: 'Avisar al cliente' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Avisar al yonke' })).not.toBeInTheDocument();
  });

  it('quitar respuesta sin confirmar no hace nada', async () => {
    window.confirm = vi.fn(() => false);
    render(<PedidosAdminPage />);
    await abrir('Alternador');
    fireEvent.click(await screen.findByRole('button', { name: 'Quitar respuesta' }));
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'otro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y quitar' }));
    expect(datos.quitarRespuesta).not.toHaveBeenCalled();
  });
});

describe('Sugerir yonke: pedidos de talleres', () => {
  it('solo yonkes del estado del pedido, nunca otros estados', async () => {
    render(<PedidosAdminPage />);
    await aTalleres();
    fireEvent.click((await screen.findAllByText('Faro'))[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Sugerir yonke' }));
    await screen.findByText(/No hay yonkes activos sin responder en Sonora/); // Y2 ya respondió
    expect(datos.listarYonkesActivosDeEstado).toHaveBeenCalledWith('sonora', { sinLigeros: true });
    expect(screen.queryByLabelText('Mostrar también otros estados')).not.toBeInTheDocument();
  });

  it('sin la bandera de talleres no aparece', async () => {
    banderas = { clientes: true, talleres: false };
    render(<PedidosAdminPage />);
    await aTalleres();
    fireEvent.click((await screen.findAllByText('Faro'))[0]);
    await screen.findByText('Yonke Sonora');
    expect(screen.queryByRole('button', { name: 'Sugerir yonke' })).not.toBeInTheDocument();
  });

  it('la respuesta elegida por el taller no se puede quitar; las demás sí', async () => {
    render(<PedidosAdminPage />);
    await aTalleres();
    await abrir('Puerta');
    expect(await screen.findByText('Respuesta elegida por el taller: no se puede quitar')).toBeInTheDocument();
    const botones = screen.getAllByRole('button', { name: 'Quitar respuesta' });
    expect(botones).toHaveLength(1); // solo la de Yonke Sonora
    expect(screen.queryByRole('button', { name: 'Sugerir yonke' })).not.toBeInTheDocument(); // cerrada
    fireEvent.click(botones[0]);
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'errorMecanix' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y quitar' }));
    await waitFor(() => expect(datos.quitarRespuesta).toHaveBeenCalledWith('solicitudesPiezas', 'S2', expect.objectContaining({ yonkeId: 'Y2' }), 'errorMecanix'));
    await waitFor(() => expect(datos.leerRespuestasSolicitud).toHaveBeenCalledTimes(2));
  });
});
