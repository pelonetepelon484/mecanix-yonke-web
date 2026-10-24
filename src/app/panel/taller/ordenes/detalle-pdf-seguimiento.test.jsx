// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Detalle de una orden v3 con enlace: el PDF usa lo que ya leyó el bloque de seguimiento (0 lecturas extra).
const TOKEN = 'Q'.repeat(40) + 'abc';
const orden = {
  folio: 'O261023-ABCD', estado: 'reparacion', avisoVersion: 'aviso-orden-3', seguimientoToken: TOKEN, cliente: {},
  vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 }, fallaReportada: '', observaciones: '', estadoRecepcion: '', pertenencias: '',
  trabajos: [], piezas: [], expiraAt: { toDate: () => new Date(Date.now() + 40 * 86400000) },
};
const descargarPdfOrden = vi.fn(async () => {});
const leerSeguimiento = vi.fn();
let configOrdenes = null;
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), useParams: () => ({ id: 'O261023-ABCD' }) }));
vi.mock('../../../lib/SelectorMarcaModelo', () => ({ default: () => null }));
vi.mock('./contexto', () => ({ useOrdenes: () => ({ tallerId: 'T1', taller: { nombre: 'Taller', activo: true }, puedeEditar: true, configOrdenes }) }));
vi.mock('./datos', () => ({
  leerOrden: vi.fn(async () => orden), guardarOrden: vi.fn(), borrarOrden: vi.fn(), quitarDatosClienteOrden: vi.fn(),
  leerSeguimiento: (...a) => leerSeguimiento(...a), activarSeguimiento: vi.fn(), desactivarSeguimiento: vi.fn(), guardarNotaSeguimiento: vi.fn(),
}));
vi.mock('./pdf', () => ({ descargarPdfOrden: (...a) => descargarPdfOrden(...a) }));

const { default: DetalleOrden } = await import('./[id]/page.js');
const LIGA = `https://www.mecanixyonkevirtual.com/seguimiento/${TOKEN}`;

beforeEach(() => { descargarPdfOrden.mockClear(); leerSeguimiento.mockReset(); });
afterEach(() => cleanup());

async function descargar() {
  render(<DetalleOrden />);
  await waitFor(() => expect(leerSeguimiento).toHaveBeenCalledTimes(1));
  await screen.findByRole('heading', { name: 'Seguimiento en línea' });
  fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }));
  await waitFor(() => expect(descargarPdfOrden).toHaveBeenCalled());
  return descargarPdfOrden.mock.calls[0][0].ligaSeguimiento;
}

describe('"Descargar PDF" con el seguimiento en el PDF', () => {
  it('banderas encendidas y enlace activo: lleva la liga, y el enlace se leyó UNA sola vez (el del bloque)', async () => {
    configOrdenes = { habilitado: true, seguimientoHabilitado: true, seguimientoEnPdf: true };
    leerSeguimiento.mockResolvedValue({ expiraAt: { toDate: () => new Date(Date.now() + 86400000) } });
    expect(await descargar()).toBe(LIGA);
    expect(leerSeguimiento).toHaveBeenCalledTimes(1);
  });
  it('si la lectura del enlace falló: sin liga', async () => {
    configOrdenes = { habilitado: true, seguimientoHabilitado: true, seguimientoEnPdf: true };
    leerSeguimiento.mockRejectedValue(new Error('sin red'));
    expect(await descargar()).toBeNull();
  });
  it('sin la bandera del PDF: sin liga aunque el enlace esté activo', async () => {
    configOrdenes = { habilitado: true, seguimientoHabilitado: true };
    leerSeguimiento.mockResolvedValue({ expiraAt: { toDate: () => new Date(Date.now() + 86400000) } });
    expect(await descargar()).toBeNull();
  });
});
