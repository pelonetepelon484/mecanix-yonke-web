// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const push = vi.fn();
let contexto = {};
let datosCliente = false;
const convertir = vi.fn();
const borrar = vi.fn(async () => {});
const cotizacion = {
  folio: 'C261008-AB12', estado: 'enviada', archivada: false, vigenciaDias: 15, observaciones: '',
  cliente: { nombre: 'Juan Pérez' }, vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2010, placas: 'ABC1234' },
  renglones: [{ tipo: 'pieza', descripcion: 'Alternador', cantidad: 1, precioUnitario: 1500 }],
  expiraAt: { toDate: () => new Date(Date.now() + 30 * 86400000) },
};
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }), useParams: () => ({ id: 'C261008-AB12' }) }));
vi.mock('../../../lib/SelectorMarcaModelo', () => ({ default: () => null }));
vi.mock('./contexto', () => ({ useCotizaciones: () => contexto }));
vi.mock('./pdf', () => ({ descargarPdfCotizacion: vi.fn() }));
vi.mock('../../solicitudesPiezasDatos', () => ({ leerConfigSolicitudesPiezas: vi.fn(async () => null) }));
vi.mock('./datos', () => ({
  leerCotizacion: vi.fn(async () => cotizacion),
  borrarCotizacionCompleta: (...a) => borrar(...a), cambiarArchivada: vi.fn(), duplicarCotizacion: vi.fn(), guardarCotizacion: vi.fn(), quitarDatosCliente: vi.fn(),
}));
vi.mock('../ordenes/datos', () => ({
  leerConfigOrdenes: vi.fn(async () => ({ habilitado: true, datosClienteHabilitados: true, avisoOrdenVersion: 'aviso-orden-1' })),
  convertirCotizacionEnOrden: (...a) => convertir(...a),
}));
vi.mock('../../../../lib/avisoOrden', () => ({ datosClienteDisponibles: () => datosCliente }));

const { default: EditarCotizacion } = await import('./[id]/page.js');

beforeEach(() => {
  contexto = { tallerId: 'T1', taller: { activo: true }, puedeEditar: true, datosClienteHabilitados: true, avisoVersion: 'v1', recargar: vi.fn() };
  datosCliente = false;
  convertir.mockReset();
  borrar.mockClear();
  push.mockReset();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function abrir() {
  render(<EditarCotizacion />);
  await screen.findByText(/Folio C261008-AB12/);
}

describe('etapa 5: "No aprobada: eliminar ahora"', () => {
  it('pide la confirmación aprobada y borra al instante', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: 'No aprobada: eliminar ahora' }));
    expect(confirmar).toHaveBeenCalledWith('La cotización y todos sus renglones se eliminarán ahora y no se podrán recuperar. ¿Continuar?');
    await waitFor(() => expect(borrar).toHaveBeenCalledWith('T1', 'C261008-AB12'));
    expect(push).toHaveBeenCalledWith('/panel/taller/cotizaciones');
  });
  it('si cancela, no se borra nada', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: 'No aprobada: eliminar ahora' }));
    expect(borrar).not.toHaveBeenCalled();
  });
  it('con términos VIEJOS (solo lectura) el taller activo sí ve el botón; desactivado, no', async () => {
    contexto = { ...contexto, puedeEditar: false };
    await abrir();
    expect(screen.getByRole('button', { name: 'No aprobada: eliminar ahora' })).toBeInTheDocument();
    cleanup();
    contexto = { ...contexto, puedeEditar: false, taller: { activo: false } };
    await abrir();
    expect(screen.queryByRole('button', { name: 'No aprobada: eliminar ahora' })).not.toBeInTheDocument();
  });
});

describe('etapa 4: convertir con datos del cliente', () => {
  it('con datos del cliente disponibles: confirmación de UNA línea (no avisa de pérdida) y copia los datos', async () => {
    datosCliente = true;
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
    convertir.mockResolvedValue('O261011-ZZZZ');
    await abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Convertir en orden' }));
    expect(confirmar).toHaveBeenCalledWith('Se creará una orden de servicio y esta cotización se eliminará. ¿Continuar?');
    await waitFor(() => expect(convertir).toHaveBeenCalledWith(expect.objectContaining({ copiarCliente: true, avisoVersion: 'aviso-orden-1' })));
  });
  it('sin datos del cliente disponibles (aviso pendiente): avisa de la pérdida y no los copia', async () => {
    datosCliente = false;
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
    convertir.mockResolvedValue('O261011-ZZZZ');
    await abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Convertir en orden' }));
    expect(confirmar.mock.calls[0][0]).toContain('Los datos del cliente (nombre, teléfono y placas) no pasan a la orden');
    await waitFor(() => expect(convertir).toHaveBeenCalledWith(expect.objectContaining({ copiarCliente: false })));
  });
});
