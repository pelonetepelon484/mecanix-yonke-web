// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

let orden = null;
let contexto = {};
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), useParams: () => ({ id: 'O251011-7KQ4' }) }));
vi.mock('../../../lib/SelectorMarcaModelo', () => ({ default: () => null }));
vi.mock('./contexto', () => ({ useOrdenes: () => contexto }));
vi.mock('./datos', () => ({ leerOrden: vi.fn(async () => orden), guardarOrden: vi.fn(), borrarOrden: vi.fn(), quitarDatosClienteOrden: vi.fn() }));
vi.mock('./pdf', () => ({ descargarPdfOrden: vi.fn() }));
// Simula el texto final listo: solo la versión vigente (aviso-orden-1) admite datos del cliente.
vi.mock('../../../../lib/avisoOrden', () => ({ datosClienteDisponibles: (config, version) => config?.datosClienteHabilitados === true && (version === undefined || version === config.avisoOrdenVersion) }));

const { default: DetalleOrden } = await import('./[id]/page.js');
const base = {
  folio: 'O251011-7KQ4', estado: 'recibido', cliente: {}, vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 },
  fallaReportada: '', observaciones: '', estadoRecepcion: '', pertenencias: '', trabajos: [], piezas: [],
  expiraAt: { toDate: () => new Date(Date.now() + 40 * 86400000) },
};
const configOrdenes = { habilitado: true, datosClienteHabilitados: true, avisoOrdenVersion: 'aviso-orden-1' };

afterEach(() => cleanup());

describe('detalle de la orden: datos del cliente según la versión del aviso', () => {
  it('orden con la versión vigente: muestra nombre, teléfono y placas', async () => {
    orden = { ...base, avisoVersion: 'aviso-orden-1' };
    contexto = { tallerId: 'T1', taller: { activo: true }, puedeEditar: true, configOrdenes };
    render(<DetalleOrden />);
    expect(await screen.findByLabelText('Nombre')).toBeInTheDocument();
    expect(screen.getByLabelText('Placas (opcional)')).toBeInTheDocument();
  });
  it('orden VIEJA (aviso-orden-0): no muestra campos del cliente', async () => {
    orden = { ...base, avisoVersion: 'aviso-orden-0' };
    contexto = { tallerId: 'T1', taller: { activo: true }, puedeEditar: true, configOrdenes };
    render(<DetalleOrden />);
    await screen.findByText(/Folio O251011-7KQ4/);
    expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument();
  });
  it('con términos viejos el taller activo puede eliminar la orden', async () => {
    orden = { ...base, avisoVersion: 'aviso-orden-1' };
    contexto = { tallerId: 'T1', taller: { activo: true }, puedeEditar: false, configOrdenes };
    render(<DetalleOrden />);
    expect(await screen.findByRole('button', { name: 'Eliminar orden' })).toBeInTheDocument();
  });
});
