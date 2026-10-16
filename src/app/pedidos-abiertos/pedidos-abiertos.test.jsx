// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('../lib/estados', () => ({
  ESTADO_DEFAULT: 'baja-california',
  cargarEstados: async () => [{ id: 'baja-california', nombre: 'Baja California' }, { id: 'sonora', nombre: 'Sonora' }],
}));
const { default: PedidosAbiertosCliente, TEXTO_ELIGE_ESTADO_PEDIDOS } = await import('./PedidosAbiertosCliente.js');

const pedido = (id, estado, estadoNombre) => ({ id, pieza: `Pieza ${id}`, vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2005 }, estado, estadoNombre, creadoAt: '2026-10-16T18:00:00Z' });
afterEach(() => { cleanup(); delete global.fetch; });

describe('/pedidos-abiertos arranca con el estado del visitante', () => {
  it('pide ?estado=auto y marca en el selector el estado que eligió el servidor', async () => {
    global.fetch = vi.fn(async (url) => ({
      ok: true, status: 200,
      json: async () => (url.includes('estado=auto')
        ? { ok: true, estado: 'sonora', pedidos: [pedido('S1', 'sonora', 'Sonora')] }
        : { ok: true, estado: 'baja-california', pedidos: [pedido('B1', 'baja-california', 'Baja California')] }),
    }));
    render(<PedidosAbiertosCliente />);
    expect(await screen.findByText('Pieza S1')).toBeInTheDocument();
    expect(global.fetch.mock.calls[0][0]).toBe('/api/pedidos-abiertos?estado=auto');
    await waitFor(() => expect(screen.getByLabelText('Estado')).toHaveValue('sonora'));
    expect(global.fetch).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'baja-california' } });
    expect(await screen.findByText('Pieza B1')).toBeInTheDocument();
  });

  it('si no se sabe el estado: pide elegirlo y no muestra pedidos', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, estado: null, pedidos: [] }) }));
    render(<PedidosAbiertosCliente />);
    expect(await screen.findByText(TEXTO_ELIGE_ESTADO_PEDIDOS)).toBeInTheDocument();
    expect(screen.getByLabelText('Estado')).toHaveValue('');
  });
});
