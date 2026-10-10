// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const HORA = 60 * 60 * 1000;
const hace = (horas) => ({ toDate: () => new Date(Date.now() - horas * HORA) });
let docs = [];

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../../lib/firebase', () => ({ db: 'db' }));
vi.mock('../../../lib/busqueda/corteBusquedasConfiables', () => ({ filtroBusquedasConfiables: () => 'corte' }));
vi.mock('firebase/firestore', () => ({
  collection: (...a) => a.join('/'),
  query: (...a) => a,
  where: (...a) => a,
  orderBy: (...a) => a,
  limit: (n) => n,
  Timestamp: { fromDate: (d) => d },
  getDocs: vi.fn(async () => ({ docs: docs.map((d) => ({ data: () => d })) })),
}));

const { default: MapaBusquedasPage } = await import('./page.js');
const { formatearFechaTijuana } = await import('./fechas.js');

afterEach(() => { cleanup(); docs = []; });

const son = { estadoGeografico: 'son', marca: 'Nissan', modelo: 'Sentra', anio: 2005 };

async function abrirSonora() {
  render(<MapaBusquedasPage />);
  fireEvent.click(await screen.findByRole('cell', { name: 'Sonora' }));
}

describe('mapa de búsquedas: fechas por estado', () => {
  it('la tabla del estado muestra "Última vez" (la más nueva de cada fila) y marca lo de las últimas 24 h', async () => {
    const reciente = hace(2);
    const vieja = hace(72);
    docs = [
      { ...son, pieza: 'Alternador', fecha: reciente, conResultado: true },
      { ...son, pieza: 'Alternador', fecha: hace(50), conResultado: false },
      { ...son, pieza: 'Faro', fecha: vieja, conResultado: false },
    ];
    await abrirSonora();
    const tabla = screen.getByRole('columnheader', { name: 'Última vez' }).closest('table');
    const filaAlternador = within(tabla).getByRole('cell', { name: 'Alternador — Nissan Sentra 2005' }).closest('tr');
    expect(filaAlternador).toHaveTextContent(formatearFechaTijuana(reciente));
    expect(within(filaAlternador).getByText('● Últimas 24 h')).toBeInTheDocument();
    const filaFaro = within(tabla).getByRole('cell', { name: 'Faro — Nissan Sentra 2005' }).closest('tr');
    expect(filaFaro).toHaveTextContent(formatearFechaTijuana(vieja));
    expect(within(filaFaro).queryByText('● Últimas 24 h')).not.toBeInTheDocument();
  });

  it('lista "Búsquedas recientes en Sonora": máximo 20, la más nueva primero, con fecha, qué buscaron y resultado', async () => {
    docs = Array.from({ length: 25 }, (_, i) => ({ ...son, pieza: `Pieza ${i}`, fecha: hace(i * 10), conResultado: i % 2 === 0 }));
    docs.push({ estadoGeografico: 'bcn', pieza: 'Otra', fecha: hace(1) }); // de otro estado: no sale
    await abrirSonora();
    const lista = screen.getByRole('list', { name: 'Búsquedas recientes en Sonora' });
    const items = within(lista).getAllByRole('listitem');
    expect(items).toHaveLength(20);
    expect(items[0]).toHaveTextContent('Pieza 0 — Nissan Sentra 2005');
    expect(items[0]).toHaveTextContent(formatearFechaTijuana(docs[0].fecha));
    expect(items[0]).toHaveTextContent('✓ Con resultado');
    expect(items[1]).toHaveTextContent('✗ Sin resultado');
    // 0 h, 10 h y 20 h → últimas 24 h; 30 h en adelante, no.
    expect(within(items[2]).getByText('● Últimas 24 h')).toBeInTheDocument();
    expect(within(items[3]).queryByText('● Últimas 24 h')).not.toBeInTheDocument();
    expect(within(lista).queryByText(/Otra/)).not.toBeInTheDocument();
  });
});
