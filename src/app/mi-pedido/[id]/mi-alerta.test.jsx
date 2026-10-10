// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'A'.repeat(20) }),
  useSearchParams: () => new URLSearchParams('c=codigo'),
}));

const { default: MiPedidoCliente } = await import('./MiPedidoCliente.js');
const { metadata } = await import('./page.js');

afterEach(() => { cleanup(); });

describe('página del cliente con las respuestas de los yonkes', () => {
  it('se titula "Mi alerta de búsqueda" (en la página y en la pestaña del navegador)', async () => {
    global.fetch = vi.fn(async () => ({
      status: 200, ok: true,
      json: async () => ({
        ok: true,
        pedido: { pieza: 'Alternador', vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2005 }, estadoNombre: 'Sonora', estadoPedido: 'abierta', vencido: false, vence: '2026-10-14T20:00:00Z' },
        respuestas: [],
      }),
    }));
    render(<MiPedidoCliente />);
    expect(await screen.findByText('Alternador')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Mi alerta de búsqueda');
    expect(screen.queryByText('Mi pedido de pieza')).not.toBeInTheDocument();
    expect(metadata.title).toBe('Mi alerta de búsqueda | Mecanix Yonke Virtual');
  });
});
