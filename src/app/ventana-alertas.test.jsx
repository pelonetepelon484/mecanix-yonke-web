// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

let bandera = true;
let usuario = null;
vi.mock('./lib/banderaPedidosClientes', () => ({ leerBanderaAlertasPortada: async () => bandera }));
vi.mock('firebase/auth', () => ({ onAuthStateChanged: (_a, cb) => { cb(usuario); return () => {}; } }));
vi.mock('./lib/firebase', () => ({ auth: {} }));

const { default: VentanaAlertas, TEXTO_ELIGE_ESTADO, enlaceYoLaTengo } = await import('./VentanaAlertas.js');

// La hora del celular va 3 horas ADELANTADA: el texto debe salir con la hora del servidor.
const SERVIDOR = Date.parse('2026-10-16T18:00:00Z');
const alerta = (i, minAtras = i) => ({
  id: `Pedido0000000000000${i}`.slice(-20), pieza: `Pieza ${i}`, vehiculo: { marca: 'Honda', modelo: 'Civic', anio: 2020 }, estado: 'baja-california',
  creadoAt: new Date(SERVIDOR - minAtras * 60000).toISOString(),
});
function responder(cuerpo, status = 200) {
  global.fetch = vi.fn(async () => ({ ok: status === 200, status, json: async () => cuerpo }));
}
const ok = (alertas, extra = {}) => ({ ok: true, estado: 'baja-california', estadoNombre: 'Baja California', alertas, ahora: new Date(SERVIDOR).toISOString(), ...extra });

beforeEach(() => {
  bandera = true; usuario = null;
  vi.spyOn(Date, 'now').mockReturnValue(SERVIDOR + 3 * 60 * 60 * 1000);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); delete global.fetch; });

describe('ventana de alertas de la portada', () => {
  it('bandera apagada: nada, ni siquiera pide las alertas', async () => {
    bandera = false;
    responder(ok([alerta(1)]));
    const { container } = render(<VentanaAlertas estado="todos" />);
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sin alertas no deja hueco; con "Todos los estados" pide sin estado (ubicación del visitante)', async () => {
    responder(ok([]));
    const { container } = render(<VentanaAlertas estado="todos" />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/alertas-recientes'));
    expect(container).toBeEmptyDOMElement();
  });

  it('con un estado elegido lo pide; muestra pieza, vehículo, estado y "hace X" con la hora del servidor', async () => {
    responder(ok([alerta(0, 0.2), alerta(1, 12)]));
    render(<VentanaAlertas estado="baja-california" />);
    expect(await screen.findByText('Pieza 0')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/alertas-recientes?estado=baja-california');
    expect(screen.getAllByText('Honda Civic 2020')).toHaveLength(2);
    expect(screen.getByText('Baja California · hace un momento')).toBeInTheDocument();
    expect(screen.getByText('Baja California · hace 12 minutos')).toBeInTheDocument();
    expect(JSON.stringify(document.body.innerHTML)).not.toMatch(/whatsapp/i);
  });

  it('si no se sabe el estado del visitante, le pide elegirlo y no muestra alertas', async () => {
    responder(ok([], { estado: null, estadoNombre: null }));
    render(<VentanaAlertas estado="todos" />);
    expect(await screen.findByText(`🔔 ${TEXTO_ELIGE_ESTADO}`)).toBeInTheDocument();
  });

  it('"Yo la tengo": sin sesión al registro con la alerta; con sesión a Pedidos con la alerta', async () => {
    expect(enlaceYoLaTengo('ID', false)).toBe('/panel/registro?pedido=ID&desde=alertas');
    expect(enlaceYoLaTengo('ID', true)).toBe('/panel/reservaciones?pedido=ID');
    responder(ok([alerta(1)]));
    render(<VentanaAlertas estado="baja-california" />);
    const boton = await screen.findByRole('link', { name: 'Yo la tengo' });
    expect(boton).toHaveAttribute('href', `/panel/registro?pedido=${alerta(1).id}&desde=alertas`);
    cleanup();
    usuario = { uid: 'u1' };
    render(<VentanaAlertas estado="baja-california" />);
    expect(await screen.findByRole('link', { name: 'Yo la tengo' })).toHaveAttribute('href', `/panel/reservaciones?pedido=${alerta(1).id}`);
  });

  it('clic en la ventana: sin sesión al registro; con sesión al listado completo', async () => {
    const asignar = vi.fn();
    vi.stubGlobal('location', { ...window.location, set href(v) { asignar(v); } });
    responder(ok([alerta(1)]));
    render(<VentanaAlertas estado="baja-california" />);
    fireEvent.click(await screen.findByRole('link', { name: 'Ver todas las alertas de búsqueda' }));
    expect(asignar).toHaveBeenCalledWith('/panel/registro?desde=alertas');
    cleanup();
    usuario = { uid: 'u1' };
    render(<VentanaAlertas estado="baja-california" />);
    fireEvent.click(await screen.findByRole('link', { name: 'Ver todas las alertas de búsqueda' }));
    expect(asignar).toHaveBeenLastCalledWith('/panel/reservaciones');
    vi.unstubAllGlobals();
  });

  it('5 o menos quedan fijas; con más rota y muestra siempre 5', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    responder(ok(Array.from({ length: 7 }, (_, i) => alerta(i))));
    render(<VentanaAlertas estado="baja-california" />);
    await act(async () => {});
    await act(async () => {});
    expect(screen.getAllByRole('link', { name: 'Yo la tengo' })).toHaveLength(5);
    expect(screen.queryByText('Pieza 5')).not.toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(4000); });
    expect(screen.getByText('Pieza 5')).toBeInTheDocument();
    expect(screen.queryByText('Pieza 4')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Yo la tengo' })).toHaveLength(5);
  });

  it('se vuelve a pedir cada 90 s, pero no con la pestaña escondida', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    responder(ok([alerta(1)]));
    render(<VentanaAlertas estado="baja-california" />);
    await act(async () => {});
    expect(global.fetch).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(90000); });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const visibilidad = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await act(async () => { vi.advanceTimersByTime(180000); });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    visibilidad.mockRestore();
  });
});

describe('etiqueta de estado por alerta (config/pedidosClientes.alertasPortadaTodos)', () => {
  it('cada alerta muestra SU estado; las que no traen estadoNombre usan el del visitante (como hoy)', async () => {
    const deSonora = { ...alerta(2, 5), estado: 'sonora', estadoNombre: 'Sonora' };
    const deJalisco = { ...alerta(3, 7), estado: 'jalisco', estadoNombre: 'Jalisco' };
    responder(ok([alerta(1, 3), deSonora, deJalisco]));
    render(<VentanaAlertas estado="baja-california" />);
    expect(await screen.findByText('Pieza 1')).toBeInTheDocument();
    expect(screen.getByText('Baja California · hace 3 minutos')).toBeInTheDocument();
    expect(screen.getByText('Sonora · hace 5 minutos')).toBeInTheDocument();
    expect(screen.getByText('Jalisco · hace 7 minutos')).toBeInTheDocument();
    // "Yo la tengo" de una alerta de otro estado lleva a esa alerta, igual que las propias.
    expect(screen.getAllByRole('link', { name: 'Yo la tengo' })[1]).toHaveAttribute('href', enlaceYoLaTengo(deSonora.id, false));
  });
});
