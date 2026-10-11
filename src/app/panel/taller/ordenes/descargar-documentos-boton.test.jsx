// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('./datos', () => ({ listarOrdenes: vi.fn() }));
vi.mock('../cotizaciones/datos', () => ({ listarCotizaciones: vi.fn(), leerRenglones: vi.fn() }));
vi.mock('./pdf', () => ({ bytesPdfOrden: vi.fn() }));
vi.mock('../cotizaciones/pdf', () => ({ bytesPdfCotizacion: vi.fn() }));

const { default: DescargarDocumentos } = await import('./DescargarDocumentos.js');
const { MENSAJES_DESCARGA } = await import('./descargaDocumentos');

const pagina = (items) => vi.fn(async () => ({ items, cursor: null, hayMas: false }));
function fuentes({ n = 2, pausa } = {}) {
  return {
    listarOrdenes: pagina(Array.from({ length: n }, (_, i) => ({ folio: `O261011-000${i}` }))),
    listarCotizaciones: pagina([]),
    leerRenglones: vi.fn(async () => []),
    pdfOrden: vi.fn(async () => new Uint8Array([1, 2, 3])),
    pdfCotizacion: vi.fn(async () => new Uint8Array([1])),
    pausa: pausa ?? (async () => {}),
  };
}

beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => 'blob:x');
  global.URL.revokeObjectURL = vi.fn();
});
afterEach(() => cleanup());

describe('botón "Descargar mis documentos"', () => {
  it('descarga el .zip y dice cuántos documentos', async () => {
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<DescargarDocumentos tallerId="T1" taller={{}} fuentes={fuentes()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Descargar mis documentos' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Listo: se descargaron 2 documentos en documentos-mecanix-.*\.zip\./);
    expect(clic).toHaveBeenCalled();
    clic.mockRestore();
  });
  it('muestra el avance "Preparando N de M…" y se puede cancelar sin descargar nada', async () => {
    let soltar;
    const pausa = () => new Promise((r) => { soltar = r; });
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<DescargarDocumentos tallerId="T1" taller={{}} fuentes={fuentes({ n: 3, pausa })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Descargar mis documentos' }));
    expect(await screen.findByText('Preparando 1 de 3…')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    soltar();
    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAJES_DESCARGA.cancelado);
    expect(clic).not.toHaveBeenCalled();
    clic.mockRestore();
  });
  it('con más de 200 documentos: mensaje claro y no se descarga nada', async () => {
    render(<DescargarDocumentos tallerId="T1" taller={{}} fuentes={fuentes({ n: 201 })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Descargar mis documentos' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAJES_DESCARGA.tope);
  });
  it('si falla la conexión: mensaje claro', async () => {
    const f = fuentes();
    f.listarOrdenes = vi.fn(async () => { throw new Error('offline'); });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<DescargarDocumentos tallerId="T1" taller={{}} fuentes={f} />);
    fireEvent.click(screen.getByRole('button', { name: 'Descargar mis documentos' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(MENSAJES_DESCARGA.fallo));
  });
});
