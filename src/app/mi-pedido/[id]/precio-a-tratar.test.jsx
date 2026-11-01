// @vitest-environment jsdom
// /mi-pedido: respuestas de "Sugerir yonke" (las captura Mecanix, sin precio) muestran "Precio a
// tratar" y "Confirmación del yonke registrada por Mecanix"; ninguna respuesta que la tiene muestra "$0" ni "$NaN".
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'A'.repeat(20) }),
  useSearchParams: () => new URLSearchParams('c=codigo'),
}));

const { default: MiPedidoCliente } = await import('./MiPedidoCliente.js');

afterEach(() => { cleanup(); });

const base = { tieneLaPieza: true, nota: '', verificado: true, estadoYonke: 'baja-california', estadoYonkeNombre: 'Baja California', otroEstado: false };
function conRespuestas(respuestas) {
  global.fetch = vi.fn(async () => ({
    status: 200, ok: true,
    json: async () => ({
      ok: true,
      pedido: { pieza: 'Alternador', vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2005 }, estado: 'baja-california', estadoNombre: 'Baja California', estadoPedido: 'abierta', vencido: false, vence: '2026-10-14T20:00:00Z' },
      respuestas,
    }),
  }));
}

describe('/mi-pedido: precio a tratar', () => {
  it('sugerida por Mecanix: "Precio no informado", la etiqueta y WhatsApp sin precio', async () => {
    conRespuestas([{ ...base, yonkeNombre: 'Yonke Sugerido', whatsapp: '6645555555', precio: null, precioATratar: true, creadoPorAdmin: true }]);
    render(<MiPedidoCliente />);
    expect(await screen.findByText('Precio no informado')).toBeInTheDocument();
    expect(screen.getByText('Confirmación del yonke registrada por Mecanix')).toBeInTheDocument();
    expect(screen.getByText('Mecanix registró la confirmación que el yonke comunicó para esta búsqueda. Mecanix no inspeccionó físicamente la pieza ni garantiza su disponibilidad posterior, condición o compatibilidad.')).toBeInTheDocument();
    expect(screen.getByText('Solicita directamente al yonke el precio final de la pieza, incluyendo los costos de envío y cualquier cargo adicional, antes de realizar el pago.')).toBeInTheDocument();
    const enlace = screen.getByRole('link', { name: /Escribirle por WhatsApp/ });
    const texto = decodeURIComponent(enlace.getAttribute('href'));
    expect(texto).toContain('vi en Mecanix que tienes Alternador para Nissan Sentra 2005. ¿Sigue disponible?');
    expect(texto).not.toMatch(/ en \$/);
  });

  it('nunca "$0" ni "$NaN" aunque una respuesta llegue sin precio válido; las del yonke sin etiqueta', async () => {
    conRespuestas([
      { ...base, yonkeNombre: 'Sin precio', whatsapp: '6641111111', precio: null },
      { ...base, yonkeNombre: 'Precio cero', whatsapp: '6642222222', precio: 0 },
      { ...base, yonkeNombre: 'Con precio', whatsapp: '6643333333', precio: 1500 },
    ]);
    render(<MiPedidoCliente />);
    expect(await screen.findByText('$1,500')).toBeInTheDocument();
    expect(screen.getAllByText('Precio no informado')).toHaveLength(2);
    expect(screen.getAllByText('Solicita directamente al yonke el precio final de la pieza, incluyendo los costos de envío y cualquier cargo adicional, antes de realizar el pago.')).toHaveLength(2);
    expect(document.body.textContent).not.toMatch(/\$0\b|NaN/);
    expect(screen.queryByText('Confirmación del yonke registrada por Mecanix')).not.toBeInTheDocument();
    expect(screen.queryByText('Mecanix registró la confirmación que el yonke comunicó para esta búsqueda. Mecanix no inspeccionó físicamente la pieza ni garantiza su disponibilidad posterior, condición o compatibilidad.')).not.toBeInTheDocument();
  });
});
