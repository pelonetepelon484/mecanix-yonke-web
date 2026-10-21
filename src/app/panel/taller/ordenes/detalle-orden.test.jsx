// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const expira = new Date(Date.now() + 40 * 86400000);
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), useParams: () => ({ id: 'O251011-7KQ4' }) }));
vi.mock('../../../lib/SelectorMarcaModelo', () => ({ default: () => null }));
vi.mock('./contexto', () => ({ useOrdenes: () => ({ tallerId: 'T1', taller: { activo: true }, puedeEditar: true, puedeBorrar: true }) }));
vi.mock('./datos', () => ({
  leerOrden: vi.fn(async () => ({
    folio: 'O251011-7KQ4', estado: 'recibido', cliente: {}, vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 },
    fallaReportada: '', observaciones: '', estadoRecepcion: '', pertenencias: '', trabajos: [], piezas: [],
    expiraAt: { toDate: () => expira },
  })),
  guardarOrden: vi.fn(), borrarOrden: vi.fn(), quitarDatosClienteOrden: vi.fn(),
}));

const { default: DetalleOrden } = await import('./[id]/page.js');

afterEach(() => cleanup());

describe('detalle de la orden', () => {
  it('muestra cuándo se eliminará y que el taller descargue su copia antes', async () => {
    render(<DetalleOrden />);
    const aviso = await screen.findByTestId('se-eliminara');
    const fecha = expira.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
    expect(aviso).toHaveTextContent(`Se eliminará el ${fecha}. Descarga tu copia antes de esa fecha. Mecanix no conserva tus documentos después.`);
  });
});
