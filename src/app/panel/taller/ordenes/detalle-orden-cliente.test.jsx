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
    contexto = { tallerId: 'T1', taller: { activo: true }, puedeEditar: true, puedeBorrar: true, configOrdenes };
    render(<DetalleOrden />);
    expect(await screen.findByLabelText('Nombre')).toBeInTheDocument();
    expect(screen.getByLabelText('Placas (opcional)')).toBeInTheDocument();
  });
  it('orden VIEJA (aviso-orden-0): no muestra campos del cliente', async () => {
    orden = { ...base, avisoVersion: 'aviso-orden-0' };
    contexto = { tallerId: 'T1', taller: { activo: true }, puedeEditar: true, puedeBorrar: true, configOrdenes };
    render(<DetalleOrden />);
    await screen.findByText(/Folio O251011-7KQ4/);
    expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument();
  });
  // Decisión del abogado: sin términos vigentes solo ver, reimprimir y descargar.
  it('con términos viejos: sin eliminar ni quitar datos, con mensaje claro; el PDF sigue', async () => {
    orden = { ...base, avisoVersion: 'aviso-orden-1', cliente: { nombre: 'Juan' } };
    contexto = { tallerId: 'T1', taller: { activo: true }, puedeEditar: false, puedeBorrar: false, versionVigente: false, configOrdenes };
    render(<DetalleOrden />);
    expect(await screen.findByRole('button', { name: 'Descargar PDF' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eliminar orden' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quitar datos del cliente' })).not.toBeInTheDocument();
    expect(screen.getByText('Acepta los términos vigentes para hacer cambios. Mientras tanto puedes ver, reimprimir y descargar.')).toBeInTheDocument();
  });
  it('con términos vigentes: sí puede eliminar y quitar datos', async () => {
    orden = { ...base, avisoVersion: 'aviso-orden-1', cliente: { nombre: 'Juan' } };
    contexto = { tallerId: 'T1', taller: { activo: true }, puedeEditar: true, puedeBorrar: true, versionVigente: true, configOrdenes };
    render(<DetalleOrden />);
    expect(await screen.findByRole('button', { name: 'Eliminar orden' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar datos del cliente' })).toBeInTheDocument();
  });
  // Candado Premium (config/ordenes.requierePremium): sin Premium no edita, pero SÍ borra.
  it('sin Premium (candado encendido): solo lectura, pero sí puede eliminar y quitar datos', async () => {
    orden = { ...base, avisoVersion: 'aviso-orden-1', cliente: { nombre: 'Juan' } };
    contexto = { tallerId: 'T1', taller: { activo: true }, puedeEditar: false, puedeBorrar: true, versionVigente: true, configOrdenes };
    render(<DetalleOrden />);
    expect(await screen.findByRole('heading', { name: 'Ver orden' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Guardar/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar orden' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar datos del cliente' })).toBeInTheDocument();
  });
});
