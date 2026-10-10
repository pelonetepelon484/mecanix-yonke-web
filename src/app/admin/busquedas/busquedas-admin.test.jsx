// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../lib/firebase', () => ({ db: 'db' }));
vi.mock('../../lib/busqueda/corteBusquedasConfiables', () => ({ filtroBusquedasConfiables: () => 'corte' }));
const colecciones = [];
vi.mock('firebase/firestore', () => ({
  collection: (_db, nombre) => { colecciones.push(nombre); return nombre; },
  query: (...a) => a,
  where: (...a) => a,
  orderBy: (...a) => a,
  limit: (n) => n,
  getDocs: vi.fn(async () => ({ docs: [] })),
  getCountFromServer: vi.fn(async () => ({ data: () => ({ count: 0 }) })),
}));

const { default: AdminBusquedasPage } = await import('./page.js');

describe('panel de Búsquedas sin "Contactos pendientes"', () => {
  it('no muestra la sección ni el contador, y no lee busquedas_pendientes', async () => {
    render(<AdminBusquedasPage />);
    expect(await screen.findByText('Total de búsquedas')).toBeInTheDocument();
    expect(screen.getByText('Piezas sin inventario más buscadas')).toBeInTheDocument();
    expect(screen.queryByText(/Contactos pendientes/)).not.toBeInTheDocument();
    expect(screen.queryByText('Con contacto dejado')).not.toBeInTheDocument();
    expect(colecciones).not.toContain('busquedas_pendientes');
    expect(colecciones).toContain('busquedas');
  });
});
