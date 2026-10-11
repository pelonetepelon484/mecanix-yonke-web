// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const ordenGuardada = {
  folio: 'O251011-7KQ4', estado: 'recibido', cliente: {}, vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 },
  fallaReportada: '', observaciones: '', estadoRecepcion: '', pertenencias: '', trabajos: [], piezas: [],
  expiraAt: { toDate: () => new Date(Date.now() + 40 * 86400000) },
};
const descargarPdfOrden = vi.fn(async () => {});
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), useParams: () => ({ id: 'O251011-7KQ4' }) }));
vi.mock('../../../lib/SelectorMarcaModelo', () => ({ default: () => null }));
vi.mock('./contexto', () => ({ useOrdenes: () => ({ tallerId: 'T1', taller: { nombre: 'Taller', activo: true }, puedeEditar: true }) }));
vi.mock('./datos', () => ({ leerOrden: vi.fn(async () => ordenGuardada), guardarOrden: vi.fn(), borrarOrden: vi.fn(), quitarDatosClienteOrden: vi.fn() }));
vi.mock('./pdf', () => ({ descargarPdfOrden: (...a) => descargarPdfOrden(...a) }));

const { default: DetalleOrden } = await import('./[id]/page.js');

afterEach(() => cleanup());

describe('"Descargar PDF" en el detalle de la orden', () => {
  it('descarga el PDF de lo guardado, con los datos del taller', async () => {
    render(<DetalleOrden />);
    fireEvent.click(await screen.findByRole('button', { name: 'Descargar PDF' }));
    await waitFor(() => expect(descargarPdfOrden).toHaveBeenCalledWith({ orden: ordenGuardada, taller: { nombre: 'Taller', activo: true } }));
  });
});
