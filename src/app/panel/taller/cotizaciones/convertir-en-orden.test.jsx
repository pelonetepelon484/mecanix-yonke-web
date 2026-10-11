// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const push = vi.fn();
let configOrdenes = null;
let contexto = {};
let cotizacion = null;
const convertir = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }), useParams: () => ({ id: 'C261008-AB12' }) }));
vi.mock('../../../lib/SelectorMarcaModelo', () => ({ default: () => null }));
vi.mock('./contexto', () => ({ useCotizaciones: () => contexto }));
vi.mock('./pdf', () => ({ descargarPdfCotizacion: vi.fn() }));
vi.mock('../../solicitudesPiezasDatos', () => ({ leerConfigSolicitudesPiezas: vi.fn(async () => null) }));
vi.mock('./datos', () => ({
  leerCotizacion: vi.fn(async () => cotizacion),
  borrarCotizacionCompleta: vi.fn(), cambiarArchivada: vi.fn(), duplicarCotizacion: vi.fn(), guardarCotizacion: vi.fn(), quitarDatosCliente: vi.fn(),
}));
vi.mock('../ordenes/datos', () => ({
  leerConfigOrdenes: vi.fn(async () => configOrdenes),
  convertirCotizacionEnOrden: (...a) => convertir(...a),
}));

const { default: EditarCotizacion } = await import('./[id]/page.js');
const { leerConfigOrdenes } = await import('../ordenes/datos');

const UNA_LINEA = 'Se creará una orden de servicio y esta cotización se eliminará. ¿Continuar?';
const DOS_LINEAS = `${UNA_LINEA}\nLos datos del cliente (nombre, teléfono y placas) no pasan a la orden y se perderán al eliminar la cotización. Si los necesitas, anótalos antes.`;
const BOTON = { name: 'Convertir en orden' };
const base = {
  folio: 'C261008-AB12', estado: 'enviada', archivada: false, vigenciaDias: 15, observaciones: '',
  cliente: {}, vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2010 },
  renglones: [{ tipo: 'pieza', descripcion: 'Alternador', cantidad: 1, precioUnitario: 1500 }],
  expiraAt: { toDate: () => new Date(Date.now() + 30 * 86400000) },
};

beforeEach(() => {
  configOrdenes = { habilitado: true, datosClienteHabilitados: false, avisoOrdenVersion: 'aviso-orden-0' };
  contexto = { tallerId: 'T1', taller: { activo: true }, puedeEditar: true, datosClienteHabilitados: true, avisoVersion: 'v1', recargar: vi.fn() };
  cotizacion = { ...base };
  convertir.mockReset();
  push.mockReset();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function abrir() {
  render(<EditarCotizacion />);
  await screen.findByText(/Folio C261008-AB12/);
  await waitFor(() => expect(leerConfigOrdenes).toHaveBeenCalled());
}

describe('"Convertir en orden" en el detalle de la cotización', () => {
  it('aparece con config/ordenes encendida y el taller puede editar', async () => {
    await abrir();
    expect(await screen.findByRole('button', BOTON)).toBeInTheDocument();
  });
  it('no aparece sin config/ordenes, con habilitado != true, sin poder editar o con la cotización vencida', async () => {
    const casos = [
      () => { configOrdenes = null; },
      () => { configOrdenes = { habilitado: false }; },
      () => { contexto = { ...contexto, puedeEditar: false }; },
      () => { cotizacion = { ...base, expiraAt: { toDate: () => new Date(Date.now() - 1000) } }; },
    ];
    for (const preparar of casos) {
      configOrdenes = { habilitado: true };
      contexto = { ...contexto, puedeEditar: true };
      cotizacion = { ...base };
      preparar();
      await abrir();
      expect(screen.queryByRole('button', BOTON)).not.toBeInTheDocument();
      cleanup();
    }
  });
  it('SIN datos del cliente: confirma con la frase exacta de una línea; al aceptar convierte y lleva a la orden', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
    convertir.mockResolvedValue('O261011-ZZZZ');
    await abrir();
    fireEvent.click(await screen.findByRole('button', BOTON));
    expect(confirmar).toHaveBeenCalledWith(UNA_LINEA);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/panel/taller/ordenes/O261011-ZZZZ'));
    expect(convertir).toHaveBeenCalledWith({ tallerId: 'T1', folioCotizacion: 'C261008-AB12', avisoVersion: 'aviso-orden-0', copiarCliente: false });
  });
  it('CON datos del cliente: la confirmación agrega la segunda línea', async () => {
    cotizacion = { ...base, cliente: { nombre: 'Juan Pérez' }, vehiculo: { ...base.vehiculo, placas: 'ABC1234' } };
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
    convertir.mockResolvedValue('O261011-ZZZZ');
    await abrir();
    fireEvent.click(await screen.findByRole('button', BOTON));
    expect(confirmar).toHaveBeenCalledWith(DOS_LINEAS);
  });
  it('si el taller cancela, no se convierte nada', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await abrir();
    fireEvent.click(await screen.findByRole('button', BOTON));
    expect(convertir).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
  it('si falla, muestra el mensaje claro y se queda en la cotización', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    convertir.mockRejectedValue(new Error('No pudimos convertir la cotización en orden. La cotización no se cambió. Revisa tu conexión e intenta de nuevo.'));
    await abrir();
    fireEvent.click(await screen.findByRole('button', BOTON));
    expect(await screen.findByRole('status')).toHaveTextContent('La cotización no se cambió.');
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole('button', BOTON)).toBeEnabled();
  });
});
