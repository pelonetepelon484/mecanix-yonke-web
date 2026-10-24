// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'A'.repeat(20) }),
  useSearchParams: () => new URLSearchParams('c=codigo'),
}));

const { default: MiPedidoCliente, TEXTO_AVISO_PAGO } = await import('./MiPedidoCliente.js');
const { metadata } = await import('./page.js');
const { CONSEJOS_ENVIO } = await import('../../../lib/pedidosClientes');

afterEach(() => { cleanup(); });

describe('página del cliente con las respuestas de los yonkes', () => {
  const respuestaDe = (extra = {}) => ({
    status: 200, ok: true,
    json: async () => ({
      ok: true,
      pedido: { pieza: 'Alternador', vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2005 }, estado: 'baja-california', estadoNombre: 'Baja California', estadoPedido: 'abierta', vencido: false, vence: '2026-10-14T20:00:00Z' },
      respuestas: [
        { tieneLaPieza: true, precio: 1500, nota: '', whatsapp: '6641111111', verificado: false, yonkeNombre: 'Yonke Nuevo', estadoYonke: 'baja-california', estadoYonkeNombre: 'Baja California', otroEstado: false },
        { tieneLaPieza: true, precio: 1700, nota: '', whatsapp: '6642222222', verificado: true, yonkeNombre: 'Yonke Viejo', estadoYonke: 'baja-california', estadoYonkeNombre: 'Baja California', otroEstado: false },
      ],
      ...extra,
    }),
  });

  it('sin la bandera: sin advertencia de pago y la etiqueta de siempre', async () => {
    global.fetch = vi.fn(async () => respuestaDe());
    render(<MiPedidoCliente />);
    expect(await screen.findByText('⚠️ Yonke nuevo, sin verificar')).toBeInTheDocument();
    expect(screen.queryByText(TEXTO_AVISO_PAGO)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ver consejos de compra segura →' })).not.toBeInTheDocument();
  });

  it('con la bandera: advertencia arriba de las respuestas, enlace a compra segura y "· confirma antes de pagar" solo en los sin verificar', async () => {
    global.fetch = vi.fn(async () => respuestaDe({ avisoPago: true }));
    render(<MiPedidoCliente />);
    expect(await screen.findByText(TEXTO_AVISO_PAGO)).toBeInTheDocument();
    expect(TEXTO_AVISO_PAGO).toBe('🛡️ Antes de pagar, confirma la pieza directamente con el yonke. Con yonkes sin verificar, evita pagos por adelantado. Mecanix no participa en la venta ni en el pago.');
    expect(screen.getByRole('link', { name: 'Ver consejos de compra segura →' })).toHaveAttribute('href', '/compra-segura');
    expect(screen.getByText('⚠️ Yonke nuevo, sin verificar · confirma antes de pagar')).toBeInTheDocument();
    expect(screen.getByText('✅ Verificado')).toBeInTheDocument();
    // La advertencia va antes de la lista de respuestas.
    const aviso = screen.getByText(TEXTO_AVISO_PAGO);
    const titulo = screen.getByText(/^Respuestas \(/);
    expect(aviso.compareDocumentPosition(titulo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

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

  it('cada respuesta dice el estado del yonke; las de otro estado llevan el aviso (con o sin Envíos nacionales)', async () => {
    const base = { tieneLaPieza: true, precio: 1500, nota: '', whatsapp: '3331111111', verificado: true };
    global.fetch = vi.fn(async () => ({
      status: 200, ok: true,
      json: async () => ({
        ok: true,
        pedido: { pieza: 'Alternador', vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2005 }, estado: 'baja-california', estadoNombre: 'Baja California', estadoPedido: 'abierta', vencido: false, vence: '2026-10-14T20:00:00Z' },
        respuestas: [
          { ...base, yonkeNombre: 'Yonke Tijuana', estadoYonke: 'baja-california', estadoYonkeNombre: 'Baja California', otroEstado: false },
          { ...base, yonkeNombre: 'Yonke Guadalajara', estadoYonke: 'jalisco', estadoYonkeNombre: 'Jalisco', otroEstado: true, enviosNacionales: true },
          { ...base, tieneLaPieza: false, precio: null, yonkeNombre: 'Yonke Hermosillo', estadoYonke: 'sonora', estadoYonkeNombre: 'Sonora', otroEstado: true, enviosNacionales: true },
          { ...base, yonkeNombre: 'Yonke Monterrey', estadoYonke: 'nuevo-leon', estadoYonkeNombre: 'Nuevo León', otroEstado: true, enviosNacionales: false },
        ],
      }),
    }));
    render(<MiPedidoCliente />);
    const tarjeta = async (nombre) => (await screen.findByText(nombre)).closest('div').parentElement;
    // Mismo estado: como hoy, solo su estado, sin insignia ni aviso.
    const local = await tarjeta('Yonke Tijuana');
    expect(local).toHaveTextContent('📍 Baja California');
    expect(local).not.toHaveTextContent('📦');
    expect(local).not.toHaveTextContent('distinto al de tu pedido');

    // Otro estado CON Envíos nacionales: insignia y el aviso que lo afirma.
    const lejos = await tarjeta('Yonke Guadalajara');
    expect(lejos).toHaveTextContent('📍 Jalisco');
    expect(lejos).toHaveTextContent('📦 Envíos nacionales');
    expect(lejos).toHaveTextContent('Este yonke es de Jalisco, distinto al de tu pedido, pero respondió tu solicitud. Este yonke hace envíos nacionales hasta tu estado; confírmalo directamente con él antes de pagar.');
    expect(lejos).toHaveTextContent(CONSEJOS_ENVIO);
    expect(lejos).not.toHaveTextContent('Te la enviaría');

    // Otro estado SIN la insignia: sin "📦 Envíos nacionales" y el aviso dice que es posible.
    const sinInsignia = await tarjeta('Yonke Monterrey');
    expect(sinInsignia).not.toHaveTextContent('Envíos nacionales');
    expect(sinInsignia).toHaveTextContent('Este yonke es de Nuevo León, distinto al de tu pedido, pero respondió tu solicitud. Es posible que pueda hacer el envío hasta tu estado; confírmalo directamente con él antes de pagar.');

    // Si no la tiene, no hay nada que enviar: sin el aviso.
    const sinPieza = await tarjeta('Yonke Hermosillo');
    expect(sinPieza).toHaveTextContent('📦 Envíos nacionales');
    expect(sinPieza).not.toHaveTextContent('distinto al de tu pedido');
  });
});
