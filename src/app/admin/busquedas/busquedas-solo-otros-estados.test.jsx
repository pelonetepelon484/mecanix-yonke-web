// @vitest-environment jsdom
// Tarjeta "Solo en otros estados" cuando su conteo falla: sin el índice compuesto
// alcanceResultado + fecha (vista "Todo"), o por cualquier otro error. La tarjeta muestra "—" y un
// aviso discreto; las 9 tarjetas, el total y las tablas siguen igual y el panel no se queda cargando.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const CORTE = 'corte';
let fallaMexico = null;
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../lib/firebase', () => ({ db: 'db' }));
vi.mock('../../lib/busqueda/corteBusquedasConfiables', () => ({ filtroBusquedasConfiables: () => CORTE }));
vi.mock('firebase/firestore', () => ({
  collection: () => 'busquedas',
  query: (_ref, ...filtros) => filtros,
  where: (...a) => a,
  orderBy: () => null,
  limit: () => null,
  getDocs: async () => ({ docs: [] }),
  getCountFromServer: async (filtros) => {
    const alcance = filtros.some((f) => Array.isArray(f) && f[0] === 'alcanceResultado');
    if (alcance && filtros.includes(CORTE)) throw Object.assign(new Error('The query requires an index'), { code: 'failed-precondition' });
    if (alcance && fallaMexico) throw fallaMexico;
    return { data: () => ({ count: alcance ? 4 : 7 }) };
  },
}));

const { default: AdminBusquedasPage } = await import('./page.js');
afterEach(() => { cleanup(); fallaMexico = null; });
vi.spyOn(console, 'error').mockImplementation(() => {});

const valorDe = (etiqueta) => screen.getByText(etiqueta).parentElement.querySelectorAll('p')[1].textContent;

describe('tarjeta "Solo en otros estados" si su conteo falla', () => {
  it('sin índice ("Todo"): "—" y el aviso; "Solo México" sí cuenta; lo demás sigue igual', async () => {
    render(<AdminBusquedasPage />);
    await screen.findByText('Total de búsquedas');
    await waitFor(() => expect(valorDe('↗ Solo en otros estados')).toBe('4'));
    expect(screen.queryByText('Aún no disponible (falta índice en Firestore)')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '🌐 Todo' }));
    expect(valorDe('↗ Solo en otros estados')).toBe('—');
    expect(screen.getByText('Aún no disponible (falta índice en Firestore)')).toBeInTheDocument();
    expect(valorDe('Total de búsquedas')).toBe('7');
    expect(valorDe('Con resultados')).toBe('7(100%)');
    expect(screen.getByText('Piezas sin inventario más buscadas')).toBeInTheDocument();
    expect(screen.queryByText(/Cargando/)).not.toBeInTheDocument();
  });

  it('otro error: "—" y "No se pudo cargar"', async () => {
    fallaMexico = Object.assign(new Error('sin red'), { code: 'unavailable' });
    render(<AdminBusquedasPage />);
    await screen.findByText('Total de búsquedas');
    expect(await screen.findByText('No se pudo cargar')).toBeInTheDocument();
    expect(valorDe('↗ Solo en otros estados')).toBe('—');
    expect(valorDe('Total de búsquedas')).toBe('7');
  });
});
