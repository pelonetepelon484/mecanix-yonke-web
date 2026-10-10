// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../lib/firebase', () => ({ db: 'db' }));
vi.mock('../../lib/busqueda/corteBusquedasConfiables', () => ({ filtroBusquedasConfiables: () => 'corte' }));
const colecciones = [];
let sinInventario = [];
vi.mock('firebase/firestore', () => ({
  collection: (_db, nombre) => { colecciones.push(nombre); return nombre; },
  query: (...a) => a,
  where: (...a) => a,
  orderBy: (...a) => a,
  limit: (n) => n,
  // Solo la consulta de "sin inventario" devuelve búsquedas; las demás tablas quedan vacías.
  getDocs: vi.fn(async (q) => ({
    docs: (JSON.stringify(q).includes('"sin_inventario"') ? sinInventario : []).map((d) => ({ data: () => d })),
  })),
  getCountFromServer: vi.fn(async () => ({ data: () => ({ count: 0 }) })),
}));

const { default: AdminBusquedasPage } = await import('./page.js');

afterEach(() => { cleanup(); sinInventario = []; });

const fecha = (iso) => ({ toDate: () => new Date(iso) });

describe('panel de Búsquedas', () => {
  it('no muestra "Contactos pendientes" ni el contador, y no lee busquedas_pendientes', async () => {
    render(<AdminBusquedasPage />);
    expect(await screen.findByText('Total de búsquedas')).toBeInTheDocument();
    expect(screen.getByText('Piezas sin inventario más buscadas')).toBeInTheDocument();
    expect(screen.queryByText(/Contactos pendientes/)).not.toBeInTheDocument();
    expect(screen.queryByText('Con contacto dejado')).not.toBeInTheDocument();
    expect(colecciones).not.toContain('busquedas_pendientes');
    expect(colecciones).toContain('busquedas');
  });

  it('piezas sin inventario: columna Estados, filtro por estado, "Cualquier pieza" y hora de Tijuana', async () => {
    sinInventario = [
      { pais: 'MX', pieza: 'Alternador', marca: 'Nissan', modelo: 'Sentra', estadoGeografico: 'bcn', fecha: fecha('2026-10-09T21:35:00Z') },
      { pais: 'MX', pieza: 'Alternador', marca: 'Nissan', modelo: 'Sentra', estadoGeografico: 'son', fecha: fecha('2026-10-01T21:35:00Z') },
      { pais: 'MX', pieza: null, marca: 'Ford', modelo: 'Focus', estadoGeografico: 'son', fecha: fecha('2026-10-02T21:35:00Z') },
      // Sin país: solo aparece en la vista "Todo".
      { pieza: 'Faro', marca: 'VW', modelo: 'Jetta', estadoGeografico: 'desconocido', fecha: fecha('2026-10-03T21:35:00Z') },
    ];
    render(<AdminBusquedasPage />);
    await screen.findByText('Total de búsquedas');
    const tabla = () => screen.getByText('Piezas sin inventario más buscadas').parentElement.querySelector('table');
    const fila = (texto) => within(tabla()).getByRole('cell', { name: texto }).closest('tr');

    expect(within(tabla()).getByRole('columnheader', { name: 'Estados' })).toBeInTheDocument();
    expect(fila('Alternador — Nissan Sentra')).toHaveTextContent('2');
    expect(fila('Alternador — Nissan Sentra')).toHaveTextContent('9 oct 2026, 2:35 p.m.'); // horario de Tijuana
    expect(fila('Alternador — Nissan Sentra')).toHaveTextContent('Baja California (1), Sonora (1)');
    expect(fila('Cualquier pieza — Ford Focus')).toHaveTextContent('Sonora (1)');
    expect(within(tabla()).queryByText(/^\? —/)).not.toBeInTheDocument();

    // Filtro: solo Sonora.
    const filtro = screen.getByRole('combobox', { name: 'Estado:' });
    expect(within(filtro).getAllByRole('option').map((o) => o.textContent)).toEqual(['Todos', 'Sonora (2)', 'Baja California (1)']);
    fireEvent.change(filtro, { target: { value: 'son' } });
    expect(fila('Alternador — Nissan Sentra')).toHaveTextContent('1 oct 2026, 2:35 p.m.');
    expect(fila('Alternador — Nissan Sentra')).toHaveTextContent('Sonora (1)');
    expect(fila('Alternador — Nissan Sentra')).not.toHaveTextContent('Baja California');

    // Combinado con "Todo": aparece la búsqueda sin país, como "Sin ubicación".
    fireEvent.change(filtro, { target: { value: 'todos' } });
    fireEvent.click(screen.getByRole('button', { name: '🌐 Todo' }));
    expect(fila('Faro — VW Jetta')).toHaveTextContent('Sin ubicación (1)');
    fireEvent.change(screen.getByRole('combobox', { name: 'Estado:' }), { target: { value: 'sin_ubicacion' } });
    expect(within(tabla()).getAllByRole('row')).toHaveLength(2); // encabezado + Faro
  });
});
