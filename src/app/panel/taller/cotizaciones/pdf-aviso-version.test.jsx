// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Botón "Descargar PDF" del detalle de la cotización: mensajes claros cuando la versión del aviso
// de la cotización no está en el archivo (falla cerrada, como en las órdenes).
// Función simple (no vi.fn): lo que haga el PDF falso en cada prueba.
let resultadoPdf = async () => ({ conAviso: true });
let llamadas = 0;
const cotizacion = {
  folio: 'C261008-AB12', estado: 'enviada', archivada: false, vigenciaDias: 15, observaciones: '', avisoVersion: 'aviso-taller-9',
  cliente: {}, vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2010 },
  renglones: [{ tipo: 'pieza', descripcion: 'Alternador', cantidad: 1, precioUnitario: 1500 }],
  expiraAt: { toDate: () => new Date(Date.now() + 30 * 86400000) },
};
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useParams: () => ({ id: 'C261008-AB12' }) }));
vi.mock('../../../lib/SelectorMarcaModelo', () => ({ default: () => null }));
vi.mock('./contexto', () => ({
  useCotizaciones: () => ({ tallerId: 'T1', taller: { activo: true }, puedeEditar: true, versionVigente: true, datosClienteHabilitados: true, avisoVersion: 'aviso-taller-1', recargar: vi.fn() }),
}));
vi.mock('./pdf', async (original) => ({ ...(await original()), descargarPdfCotizacion: async () => { llamadas += 1; return resultadoPdf(); } }));
vi.mock('../../solicitudesPiezasDatos', () => ({ leerConfigSolicitudesPiezas: vi.fn(async () => null) }));
vi.mock('./datos', () => ({
  leerCotizacion: vi.fn(async () => cotizacion),
  borrarCotizacionCompleta: vi.fn(), cambiarArchivada: vi.fn(), duplicarCotizacion: vi.fn(), guardarCotizacion: vi.fn(), quitarDatosCliente: vi.fn(),
}));
vi.mock('../ordenes/datos', () => ({ leerConfigOrdenes: vi.fn(async () => null), convertirCotizacionEnOrden: vi.fn() }));

const { default: EditarCotizacion } = await import('./[id]/page.js');
const { CotizacionSinAviso, MENSAJES_AVISO_COTIZACION } = await import('./pdf');

beforeEach(() => { llamadas = 0; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function pedirPdf() {
  render(<EditarCotizacion />);
  await screen.findByText(/Folio C261008-AB12/);
  fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }));
}

describe('PDF de la cotización según la versión de su aviso', () => {
  it('con su aviso: no muestra ningún mensaje', async () => {
    resultadoPdf = async () => ({ conAviso: true });
    await pedirPdf();
    await vi.waitFor(() => expect(llamadas).toBe(1));
    await screen.findByRole('button', { name: 'Descargar PDF' });
    expect(screen.queryByText(MENSAJES_AVISO_COTIZACION.sinHoja)).not.toBeInTheDocument();
  });
  it('sin datos del cliente y sin aviso: avisa que salió sin la hoja del aviso', async () => {
    resultadoPdf = async () => ({ conAviso: false });
    await pedirPdf();
    expect(await screen.findByText(MENSAJES_AVISO_COTIZACION.sinHoja)).toBeInTheDocument();
  });
  it('con datos del cliente y sin aviso: explica por qué no se generó', async () => {
    resultadoPdf = async () => { throw new CotizacionSinAviso('C261008-AB12'); };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await pedirPdf();
    expect(await screen.findByText(MENSAJES_AVISO_COTIZACION.sinPdf)).toBeInTheDocument();
  });
  it('otro error: el mensaje de siempre', async () => {
    resultadoPdf = async () => { throw new Error('sin conexión'); };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await pedirPdf();
    expect(await screen.findByText('No pudimos generar el PDF. Intenta de nuevo.')).toBeInTheDocument();
  });
});
