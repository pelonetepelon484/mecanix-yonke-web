// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const DIA = 86400000;
let items = [];
const listarOrdenes = vi.fn(async () => ({ items, cursor: null, hayMas: false }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('./contexto', () => ({ useOrdenes: () => ({ tallerId: 'T1', taller: {}, puedeEditar: true }) }));
vi.mock('./datos', () => ({ listarOrdenes: (...a) => listarOrdenes(...a) }));
vi.mock('./DescargarDocumentos', () => ({ default: () => <button type="button">Descargar mis documentos</button> }));

const { default: ListaOrdenes } = await import('./page.js');
const orden = (folio, dias) => ({
  folio, estado: 'recibido', vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 }, totalCentavos: 0,
  expiraAt: { toDate: () => new Date(Date.now() + dias * DIA - 60000) },
});

beforeEach(() => { listarOrdenes.mockClear(); });
afterEach(() => cleanup());

describe('lista de órdenes: aviso de 15 días, selector y descarga', () => {
  it('marca "Se elimina en X días" solo en las que les faltan 15 días o menos', async () => {
    items = [orden('O261011-AAAA', 3), orden('O261011-BBBB', 15), orden('O261011-CCCC', 40), orden('O261011-DDDD', 1)];
    render(<ListaOrdenes />);
    const tarjeta = async (folio) => (await screen.findByText(folio)).closest('button');
    expect(within(await tarjeta('O261011-AAAA')).getByText('Se elimina en 3 días')).toBeInTheDocument();
    expect(within(await tarjeta('O261011-BBBB')).getByText('Se elimina en 15 días')).toBeInTheDocument();
    expect(within(await tarjeta('O261011-DDDD')).getByText('Se elimina en 1 día')).toBeInTheDocument();
    expect(within(await tarjeta('O261011-CCCC')).queryByText(/Se elimina en/)).not.toBeInTheDocument();
  });
  it('aviso general con el número de órdenes por vencer (plural y singular)', async () => {
    items = [orden('O261011-AAAA', 3), orden('O261011-BBBB', 10), orden('O261011-CCCC', 40)];
    render(<ListaOrdenes />);
    expect(await screen.findByText('Tienes 2 órdenes que se eliminarán en 15 días o menos. Descarga tu copia.')).toBeInTheDocument();
    cleanup();
    items = [orden('O261011-AAAA', 3)];
    render(<ListaOrdenes />);
    expect(await screen.findByText('Tienes 1 orden que se eliminará en 15 días o menos. Descarga tu copia.')).toBeInTheDocument();
  });
  it('sin órdenes por vencer: NO hay aviso general (ni "no tienes", ni un cero)', async () => {
    items = [orden('O261011-CCCC', 40)];
    render(<ListaOrdenes />);
    await screen.findByText('O261011-CCCC');
    expect(screen.queryByText(/Tienes .* órdenes?|por vencer|Tienes 0/)).not.toBeInTheDocument();
  });
  it('selector: "Más antiguas primero" pide la lista al revés; con filtro de estado se desactiva y explica por qué', async () => {
    items = [];
    render(<ListaOrdenes />);
    const selector = await screen.findByLabelText('Ordenar');
    fireEvent.change(selector, { target: { value: 'asc' } });
    await waitFor(() => expect(listarOrdenes).toHaveBeenLastCalledWith('T1', expect.objectContaining({ direccion: 'asc', estado: 'todos' })));
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'listo' } });
    expect(screen.getByLabelText('Ordenar')).toBeDisabled();
    expect(screen.getByText('Para ver las más antiguas primero, elige "Todos los estados".')).toBeInTheDocument();
  });
  it('tiene el botón "Descargar mis documentos"', async () => {
    items = [];
    render(<ListaOrdenes />);
    expect(await screen.findByRole('button', { name: 'Descargar mis documentos' })).toBeInTheDocument();
  });
});
