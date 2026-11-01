// @vitest-environment jsdom
// Panel del yonke ligero: solo búsquedas activas de su estado, con tope propio.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const ID = 'Pedido00000000000001';
const pedido = { id: ID, pieza: 'Alternador', vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2005 }, estado: 'baja-california', expiraAt: 'X' };
const replace = vi.fn();
const push = vi.fn();
const salir = vi.fn(async () => {});
let sesion;
let yonke;
let config;
let abiertos;
let usadas;
const responderPedido = vi.fn(async () => {});
const guardarVehiculoCompleto = vi.fn();
const leerVehiculoAlertaDePedido = vi.fn(async () => null);
const escucharOtros = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }));
vi.mock('firebase/auth', () => ({ signOut: (...a) => salir(...a), EmailAuthProvider: {}, reauthenticateWithCredential: vi.fn(), updatePassword: vi.fn() }));
vi.mock('../../lib/firebase', () => ({ auth: 'auth', db: {} }));
vi.mock('../AuthContext', () => ({ useAuth: () => sesion }));
vi.mock('../BotonAvisos', () => ({ default: () => <p>Activar avisos</p> }));
vi.mock('../solicitudesPiezasDatos', () => ({ leerYonkeEstadoActivo: vi.fn(async () => yonke) }));
vi.mock('../pedidosClientesDatos', () => ({
  leerConfigPedidosClientes: vi.fn(async () => config),
  escucharPedidosClientesAbiertos: (_e, cb) => { cb(abiertos); return () => {}; },
  escucharPedidosClientesOtrosEstados: (cb) => { escucharOtros(); cb([]); return () => {}; },
  yaRespondioPedido: vi.fn(async () => null),
  responderPedido: (...a) => responderPedido(...a),
  leerRespuestasHoy: vi.fn(async () => usadas),
  guardarVehiculoCompleto: (...a) => guardarVehiculoCompleto(...a),
  leerVehiculoAlertaDePedido: (...a) => leerVehiculoAlertaDePedido(...a),
}));
vi.mock('../../lib/estados', () => ({ cargarEstados: vi.fn(async () => []) }));

const { default: PanelLigero } = await import('./page.js');

beforeEach(() => {
  sesion = { user: { uid: 'l1' }, yonkeId: 'YL', loading: false, esLigero: true, premiumVigente: false, puedeEditarYonke: true };
  yonke = { estado: 'baja-california', activo: true, nombre: 'Yonke Tigre', whatsapp: '6641234567', verificado: false, enviosNacionales: false };
  config = { habilitado: true, limiteRespuestasLigero: 15, limiteRespuestasDiarias: 50, inventarioVehiculos: true, otrosEstados: true };
  abiertos = [pedido];
  usadas = 3;
  window.history.replaceState(null, '', '/panel/ligero');
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('panel del yonke ligero', () => {
  it('muestra su nombre, completar registro, avisos, cuántas le quedan y las búsquedas', async () => {
    render(<PanelLigero />);
    expect(await screen.findByRole('heading', { name: 'Yonke Tigre' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Completar mi registro/ })).toHaveAttribute('href', '/panel/ligero/completar');
    expect(screen.getByText('Activar avisos')).toBeInTheDocument();
    expect(await screen.findByText('Te quedan 12 respuestas hoy')).toBeInTheDocument();
    expect(await screen.findByText('Alternador')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cambiar contraseña' })).toBeInTheDocument();
  });
  it('mientras carga no dice "no hay búsquedas" ni un contador falso', async () => {
    render(<PanelLigero />);
    await screen.findByRole('heading', { name: 'Yonke Tigre' });
    expect(screen.queryByText('Te quedan 15 respuestas hoy')).not.toBeInTheDocument();
    expect(screen.queryByText('Por ahora no hay búsquedas activas en tu estado.')).not.toBeInTheDocument();
    await screen.findByText('Alternador');
    expect(screen.queryByText('Por ahora no hay búsquedas activas en tu estado.')).not.toBeInTheDocument();
  });
  it('sin búsquedas lo dice, en vez de quedar en blanco', async () => {
    abiertos = [];
    render(<PanelLigero />);
    expect(await screen.findByText('Por ahora no hay búsquedas activas en tu estado.')).toBeInTheDocument();
  });
  it('responde con su tope de 15, y no pregunta por el vehículo ni toca inventario', async () => {
    window.history.replaceState(null, '', `/panel/ligero?pedido=${ID}`);
    render(<PanelLigero />);
    fireEvent.change(await screen.findByRole('spinbutton'), { target: { value: '1500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar respuesta' }));
    await waitFor(() => expect(responderPedido).toHaveBeenCalled());
    const [, , datos, opciones] = responderPedido.mock.calls[0];
    expect(datos).toMatchObject({ yonkeNombre: 'Yonke Tigre', whatsapp: '6641234567', tieneLaPieza: true, precio: 1500 });
    expect(opciones).toEqual({ limite: 15 });
    expect(await screen.findByText('Te quedan 11 respuestas hoy')).toBeInTheDocument();
    expect(leerVehiculoAlertaDePedido).not.toHaveBeenCalled();
    expect(guardarVehiculoCompleto).not.toHaveBeenCalled();
  });
  it('dice "1 respuesta" en singular', async () => {
    usadas = 14;
    render(<PanelLigero />);
    expect(await screen.findByText('Te quedan 1 respuesta hoy')).toBeInTheDocument();
  });
  it('al llegar al tope: sigue viendo, no responde, y ofrece completar (no Premium)', async () => {
    usadas = 15;
    render(<PanelLigero />);
    expect(await screen.findByText('Llegaste a tus 15 respuestas de hoy. Completa tu registro y responde hasta 50 al día.')).toBeInTheDocument();
    expect(await screen.findByText('Alternador')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Responder' })).toBeDisabled();
    expect(screen.getAllByRole('link', { name: /Completar mi registro/ })).toHaveLength(2);
    expect(screen.queryByText(/premium/i)).not.toBeInTheDocument();
  });
  it('con Premium sigue con su tope: el ilimitado es del registro completo', async () => {
    sesion = { ...sesion, premiumVigente: true };
    usadas = 15;
    render(<PanelLigero />);
    expect(await screen.findByText(/Llegaste a tus 15 respuestas/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Responder' })).toBeDisabled();
  });
  it('sin limiteRespuestasLigero: lo avisa y no deja responder', async () => {
    config = { habilitado: true, limiteRespuestasDiarias: 50 };
    render(<PanelLigero />);
    expect(await screen.findByText('Por ahora no se pueden responder búsquedas. Intenta más tarde.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Responder' })).toBeDisabled();
    expect(screen.queryByText(/Te quedan/)).not.toBeInTheDocument();
  });
  it('no ofrece otros estados aunque el admin lo marque Verificado con envíos', async () => {
    yonke = { ...yonke, verificado: true, enviosNacionales: true, verAlertasOtrosEstados: true };
    render(<PanelLigero />);
    await screen.findByText(/Te quedan/);
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(escucharOtros).not.toHaveBeenCalled();
  });
  it('desactivado por el admin: el mensaje, sin búsquedas', async () => {
    yonke = { ...yonke, activo: false };
    render(<PanelLigero />);
    expect(await screen.findByText(/Tu yonke está desactivado/)).toBeInTheDocument();
    expect(screen.queryByText('Alternador')).not.toBeInTheDocument();
  });
  it('sin sesión va a entrar; una cuenta que no es ligera no ve nada', async () => {
    sesion = { user: null, yonkeId: null, loading: false };
    render(<PanelLigero />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/panel'));
    cleanup();
    sesion = { user: { uid: 'c' }, yonkeId: 'Y1', loading: false, esLigero: false };
    render(<PanelLigero />);
    expect(screen.queryByText('Alternador')).not.toBeInTheDocument();
  });
  it('cerrar sesión', async () => {
    render(<PanelLigero />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/panel'));
    expect(salir).toHaveBeenCalled();
  });
});
