// @vitest-environment jsdom
// Lado del yonke: límite diario de respuestas (plan Básico), pregunta "¿Tienes el vehículo
// completo?" tras "La tengo" y la sección "Vehículos completos".
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

let sesion = { puedeEditarYonke: true, premiumVigente: false };
let config = { habilitado: true };
let abiertos = [];
let respuestasHoy = 0;
let vehiculoExistente = null;
let vehiculos = [];
const responderPedido = vi.fn(async () => {});
const guardarVehiculoCompleto = vi.fn(async () => 'crear');
const descontarPiezaDePedido = vi.fn(async () => null);
const sumarUnidadDePedido = vi.fn(async () => {});
const sumarUnidad = vi.fn(async () => {});
const restarUnidad = vi.fn(async () => {});
const deshacerVentaPieza = vi.fn(async () => {});
const marcarPiezaVendida = vi.fn(async () => {});
const quitarVehiculoAlerta = vi.fn(async () => {});
const renovarVehiculosVigentes = vi.fn(async () => 2);

vi.mock('./AuthContext', () => ({ useAuth: () => sesion }));
vi.mock('./solicitudesPiezasDatos', () => ({
  leerYonkeEstadoActivo: async () => ({ estado: 'baja-california', activo: true, nombre: 'Yonke Prueba', whatsapp: '6641234567' }),
}));
vi.mock('./pedidosClientesDatos', () => ({
  leerConfigPedidosClientes: async () => config,
  escucharPedidosClientesAbiertos: (estado, cb) => { cb(abiertos); return () => {}; },
  escucharPedidosClientesOtrosEstados: (cb) => { cb([]); return () => {}; },
  guardarVerOtrosEstados: async () => {},
  yaRespondioPedido: async () => null,
  responderPedido: (...a) => responderPedido(...a),
  leerRespuestasHoy: async () => respuestasHoy,
  leerVehiculoAlertaDePedido: async () => vehiculoExistente,
  guardarVehiculoCompleto: (...a) => guardarVehiculoCompleto(...a),
  descontarPiezaDePedido: (...a) => descontarPiezaDePedido(...a),
  sumarUnidadDePedido: (...a) => sumarUnidadDePedido(...a),
  sumarUnidad: (...a) => sumarUnidad(...a),
  restarUnidad: (...a) => restarUnidad(...a),
  deshacerVentaPieza: (...a) => deshacerVentaPieza(...a),
  escucharVehiculosAlerta: (yonkeId, cb) => { cb(vehiculos); return () => {}; },
  marcarPiezaVendida: (...a) => marcarPiezaVendida(...a),
  quitarVehiculoAlerta: (...a) => quitarVehiculoAlerta(...a),
  renovarVehiculosVigentes: (...a) => renovarVehiculosVigentes(...a),
}));
vi.mock('../lib/estados', () => ({ cargarEstados: vi.fn(async () => [{ id: 'baja-california', nombre: 'Baja California' }]) }));

const { default: PedidosClientesYonke } = await import('./PedidosClientesYonke.js');
const { default: VehiculosCompletosYonke, TEXTO_BOTON_RENOVAR } = await import('./VehiculosCompletosYonke.js');

const DIA = 24 * 60 * 60 * 1000;
const pedido = { id: 'Pedido00000000000001', pieza: 'Alternador', vehiculo: { marca: 'Honda', modelo: 'Civic', anio: 2020 }, estado: 'baja-california', expiraAt: 'X' };

afterEach(() => {
  cleanup();
  sesion = { puedeEditarYonke: true, premiumVigente: false };
  config = { habilitado: true };
  abiertos = [];
  respuestasHoy = 0;
  vehiculoExistente = null;
  vehiculos = [];
  vi.clearAllMocks();
  descontarPiezaDePedido.mockImplementation(async () => null);
  restarUnidad.mockImplementation(async () => {});
});

async function responderLaTengo() {
  fireEvent.click(await screen.findByRole('button', { name: 'Responder' }));
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1200' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar respuesta' }));
}

describe('límite diario de respuestas', () => {
  it('sin limiteRespuestasDiarias responde como siempre (misma llamada, sin límite)', async () => {
    abiertos = [pedido];
    render(<PedidosClientesYonke yonkeId="Y1" />);
    await responderLaTengo();
    await waitFor(() => expect(responderPedido).toHaveBeenCalledTimes(1));
    expect(responderPedido.mock.calls[0]).toHaveLength(3);
    expect(screen.queryByText(/Llegaste a tu límite/)).not.toBeInTheDocument();
  });

  it('Básico con 50 respuestas hoy: sigue viendo las alertas, no puede responder y ve el aviso', async () => {
    config = { habilitado: true, limiteRespuestasDiarias: 50 };
    respuestasHoy = 50;
    abiertos = [pedido];
    render(<PedidosClientesYonke yonkeId="Y1" />);
    expect(await screen.findByText('Llegaste a tu límite de hoy. Con el plan premium respondes sin límite.')).toBeInTheDocument();
    expect(screen.getByText('Alternador')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Responder' })).toBeDisabled();
  });

  it('Básico debajo del límite: responde pasando el límite para que se cuente', async () => {
    config = { habilitado: true, limiteRespuestasDiarias: 50 };
    respuestasHoy = 3;
    abiertos = [pedido];
    render(<PedidosClientesYonke yonkeId="Y1" />);
    await responderLaTengo();
    await waitFor(() => expect(responderPedido).toHaveBeenCalledWith(pedido, 'Y1', expect.objectContaining({ tieneLaPieza: true, precio: 1200 }), { limite: 50 }));
  });

  it('Premium no tiene límite aunque el campo exista', async () => {
    sesion = { puedeEditarYonke: true, premiumVigente: true };
    config = { habilitado: true, limiteRespuestasDiarias: 50 };
    respuestasHoy = 80;
    abiertos = [pedido];
    render(<PedidosClientesYonke yonkeId="Y1" />);
    expect(await screen.findByRole('button', { name: 'Responder' })).toBeEnabled();
    expect(screen.queryByText(/Llegaste a tu límite/)).not.toBeInTheDocument();
  });
});

describe('¿Tienes el vehículo completo?', () => {
  it('sin la bandera inventarioVehiculos no se pregunta nada', async () => {
    abiertos = [pedido];
    render(<PedidosClientesYonke yonkeId="Y1" />);
    await responderLaTengo();
    await waitFor(() => expect(responderPedido).toHaveBeenCalled());
    expect(screen.queryByText('¿Tienes el vehículo completo?')).not.toBeInTheDocument();
  });

  it('tras "La tengo" pregunta; "Sí, lo tengo" lo guarda en el inventario', async () => {
    config = { habilitado: true, inventarioVehiculos: true };
    abiertos = [pedido];
    render(<PedidosClientesYonke yonkeId="Y1" />);
    await responderLaTengo();
    expect(await screen.findByText('¿Tienes el vehículo completo?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, lo tengo' }));
    await waitFor(() => expect(guardarVehiculoCompleto).toHaveBeenCalledWith('Y1', pedido));
    expect(await screen.findByText(/quedó en tu inventario 30 días/)).toBeInTheDocument();
  });

  it('"No, solo la pieza" no guarda inventario', async () => {
    config = { habilitado: true, inventarioVehiculos: true };
    abiertos = [pedido];
    render(<PedidosClientesYonke yonkeId="Y1" />);
    await responderLaTengo();
    fireEvent.click(await screen.findByRole('button', { name: 'No, solo la pieza' }));
    expect(guardarVehiculoCompleto).not.toHaveBeenCalled();
  });

  it('si ya tiene el vehículo vigente, descuenta la pieza sin preguntar', async () => {
    config = { habilitado: true, inventarioVehiculos: true };
    vehiculoExistente = { estado: 'activo', venceEn: new Date(Date.now() + 5 * DIA), piezasVendidas: [] };
    abiertos = [pedido];
    render(<PedidosClientesYonke yonkeId="Y1" />);
    await responderLaTengo();
    await waitFor(() => expect(descontarPiezaDePedido).toHaveBeenCalledWith('Y1', pedido));
    expect(screen.queryByText('¿Tienes el vehículo completo?')).not.toBeInTheDocument();
  });

  it('pieza ya vendida en todas las unidades: pregunta "¿Tienes otro igual?" y "+1" suma la unidad con la venta', async () => {
    config = { habilitado: true, inventarioVehiculos: true };
    vehiculoExistente = { estado: 'activo', venceEn: new Date(Date.now() + 5 * DIA), unidades: 3, ventasPiezas: { alternador: 3 } };
    descontarPiezaDePedido.mockImplementation(async () => ({ agotada: true, vendidas: 3, unidades: 3 }));
    abiertos = [pedido];
    render(<PedidosClientesYonke yonkeId="Y1" />);
    await responderLaTengo();
    expect(await screen.findByText('¿Tienes otro igual?')).toBeInTheDocument();
    expect(screen.getByText(/Ya marcaste vendidos todos los “Alternador” de tus Honda Civic 2020 \(3 de 3\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '+1 Tengo otro igual' }));
    await waitFor(() => expect(sumarUnidadDePedido).toHaveBeenCalledWith('Y1', pedido));
    expect(await screen.findByText(/Sumamos otra unidad igual/)).toBeInTheDocument();
  });

  it('"No" a "¿Tienes otro igual?": la respuesta ya quedó guardada y el inventario no cambia', async () => {
    config = { habilitado: true, inventarioVehiculos: true };
    vehiculoExistente = { estado: 'activo', venceEn: new Date(Date.now() + 5 * DIA), unidades: 1, ventasPiezas: { alternador: 1 } };
    descontarPiezaDePedido.mockImplementation(async () => ({ agotada: true, vendidas: 1, unidades: 1 }));
    abiertos = [pedido];
    render(<PedidosClientesYonke yonkeId="Y1" />);
    await responderLaTengo();
    await waitFor(() => expect(responderPedido).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole('button', { name: 'No' }));
    expect(sumarUnidadDePedido).not.toHaveBeenCalled();
    expect(screen.queryByText('¿Tienes otro igual?')).not.toBeInTheDocument();
  });

  it('"No la tengo" no pregunta por el vehículo', async () => {
    config = { habilitado: true, inventarioVehiculos: true };
    abiertos = [pedido];
    render(<PedidosClientesYonke yonkeId="Y1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Responder' }));
    fireEvent.click(screen.getByRole('button', { name: 'No la tengo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar respuesta' }));
    await waitFor(() => expect(responderPedido).toHaveBeenCalled());
    expect(screen.queryByText('¿Tienes el vehículo completo?')).not.toBeInTheDocument();
  });
});

describe('sección "Vehículos completos"', () => {
  const civic = { id: 'honda_civic_2020', marca: 'Honda', modelo: 'Civic', ano: 2020, estado: 'activo', venceEn: new Date(Date.now() + 10 * DIA), piezasAlerta: ['Alternador', 'Faro'], piezasVendidas: ['Faro'] };

  it('sin la bandera no se muestra', async () => {
    vehiculos = [civic];
    const { container } = render(<VehiculosCompletosYonke yonkeId="Y1" />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('registro viejo: 1 unidad, la pieza vendida sale "(1 de 1)" sin más ventas; "Ya lo vendí" (un toque) y "Quitar vehículo"', async () => {
    config = { habilitado: true, inventarioVehiculos: true };
    vehiculos = [civic];
    render(<VehiculosCompletosYonke yonkeId="Y1" />);
    expect(await screen.findByText('Honda Civic 2020 · 1 unidad')).toBeInTheDocument();
    expect(screen.getByText('Faro (1 de 1)')).toBeInTheDocument();
    const botones = screen.getAllByRole('button', { name: 'Ya lo vendí' }); // Alternador, Faro y "otra pieza"
    expect(botones).toHaveLength(3);
    expect(botones[1]).toBeDisabled();
    fireEvent.click(botones[0]);
    await waitFor(() => expect(marcarPiezaVendida).toHaveBeenCalledWith('Y1', 'honda_civic_2020', 'Alternador'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar vehículo' }));
    await waitFor(() => expect(quitarVehiculoAlerta).toHaveBeenCalledWith('Y1', 'honda_civic_2020'));
  });

  it('varias unidades: muestra "3 unidades", el conteo, "Deshacer", "+1" y "−1"', async () => {
    config = { habilitado: true, inventarioVehiculos: true };
    vehiculos = [{ ...civic, unidades: 3, ventasPiezas: { alternador: 1 }, piezasVendidas: [] }];
    render(<VehiculosCompletosYonke yonkeId="Y1" />);
    expect(await screen.findByText('Honda Civic 2020 · 3 unidades')).toBeInTheDocument();
    expect(screen.getByText('Alternador (1 de 3)')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Ya lo vendí' })[0]).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    await waitFor(() => expect(deshacerVentaPieza).toHaveBeenCalledWith('Y1', 'honda_civic_2020', 'Alternador'));
    fireEvent.click(screen.getByRole('button', { name: '+1 / Tengo otro igual' }));
    await waitFor(() => expect(sumarUnidad).toHaveBeenCalledWith('Y1', 'honda_civic_2020'));
    expect(await screen.findByText(/4 unidades, vigente 30 días más/)).toBeInTheDocument();
  });

  it('"−1" sin poder bajar por ventas marcadas muestra el aviso', async () => {
    config = { habilitado: true, inventarioVehiculos: true };
    vehiculos = [{ ...civic, unidades: 2, ventasPiezas: { alternador: 2 } }];
    restarUnidad.mockImplementation(async () => {
      const error = new Error('Ya marcaste ventas de esa pieza. Primero deshaz una venta.');
      error.codigo = 'ventas';
      throw error;
    });
    render(<VehiculosCompletosYonke yonkeId="Y1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Restar una unidad/ }));
    expect(await screen.findByText('Ya marcaste ventas de esa pieza. Primero deshaz una venta.')).toBeInTheDocument();
  });

  it('Básico: "Sigo manteniendo mis vehículos" se ve pero explica que es Premium y no renueva', async () => {
    config = { habilitado: true, inventarioVehiculos: true };
    vehiculos = [civic];
    render(<VehiculosCompletosYonke yonkeId="Y1" />);
    const boton = await screen.findByRole('button', { name: new RegExp(TEXTO_BOTON_RENOVAR) });
    expect(boton).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(boton);
    expect(screen.getByText(/Esta función es del plan premium. Renueva todo tu inventario con un solo toque./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Quiero Premium/ })).toBeInTheDocument();
    expect(renovarVehiculosVigentes).not.toHaveBeenCalled();
  });

  it('Premium: renueva con un toque', async () => {
    sesion = { puedeEditarYonke: true, premiumVigente: true };
    config = { habilitado: true, inventarioVehiculos: true };
    vehiculos = [civic];
    render(<VehiculosCompletosYonke yonkeId="Y1" />);
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(TEXTO_BOTON_RENOVAR) }));
    await waitFor(() => expect(renovarVehiculosVigentes).toHaveBeenCalledWith('Y1', vehiculos));
    expect(await screen.findByText(/Renovamos 2 vehículo/)).toBeInTheDocument();
  });
});
