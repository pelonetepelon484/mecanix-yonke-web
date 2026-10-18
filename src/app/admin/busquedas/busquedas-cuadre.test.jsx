// @vitest-environment jsdom
// Cuadre del panel de búsquedas: con un conjunto de búsquedas simulado (cada conteo de Firestore se
// calcula filtrando estas búsquedas con los mismos filtros que arma la página), la suma de TODAS
// las tarjetas de categoría es igual al "Total de búsquedas" en las dos vistas, y ningún
// porcentaje de "Origen por país" pasa de 100%.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const CORTE = new Date('2026-09-24T05:53:44.000Z');
const ESTADOS = ['ok', 'sin_inventario', 'fuera_de_catalogo', 'parseo_parcial', 'fuera_de_giro', 'no_interpretada', 'numero_de_parte', 'marca_muy_general', 'pieza_sin_vehiculo'];
const ETIQUETAS = ['Con resultados', 'Sin inventario', 'Fuera de catálogo', 'Parseo parcial', 'Fuera de giro', 'No interpretada', 'Número de parte', 'Marca muy general', 'Pieza sin vehículo'];

// Búsquedas: antes y después del corte, de México, de fuera y sin país, de todos los estados.
const busquedas = [];
let n = 0;
for (const estado of ESTADOS) {
  for (const pais of ['MX', 'MX', 'US', undefined]) {
    for (const fecha of [new Date('2026-09-01'), new Date('2026-10-10'), new Date('2026-10-12')]) {
      if ((n++ % 5) === 0) continue; // que no salgan todos iguales
      busquedas.push({ estado, ...(pais ? { pais } : {}), fecha });
    }
  }
}

const cumple = (b, f) => {
  if (f.campo === 'fecha') return b.fecha >= f.valor;
  if (f.op === '==') return b[f.campo] === f.valor;
  if (f.op === '!=') return f.campo in b && b[f.campo] !== f.valor; // Firestore excluye los que no tienen el campo
  if (f.op === 'in') return f.valor.includes(b[f.campo]);
  return true;
};

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../lib/firebase', () => ({ db: 'db' }));
vi.mock('../../lib/busqueda/corteBusquedasConfiables', () => ({ filtroBusquedasConfiables: () => ({ campo: 'fecha', op: '>=', valor: CORTE }) }));
vi.mock('firebase/firestore', () => ({
  collection: () => 'busquedas',
  query: (_ref, ...filtros) => filtros.filter((f) => f && f.campo),
  where: (campo, op, valor) => ({ campo, op, valor }),
  orderBy: () => null,
  limit: () => null,
  getDocs: async () => ({ docs: [] }),
  getCountFromServer: async (filtros) => ({ data: () => ({ count: busquedas.filter((b) => filtros.every((f) => cumple(b, f))).length }) }),
}));

const { default: AdminBusquedasPage } = await import('./page.js');
afterEach(cleanup);

// Valor y porcentaje de una tarjeta por su etiqueta.
function tarjeta(etiqueta) {
  const texto = screen.getByText(etiqueta).parentElement.querySelectorAll('p')[1].textContent;
  const [, valor, pct] = texto.match(/^(\d+)(?:\((\d+)%\))?$/);
  return { valor: Number(valor), pct: pct === undefined ? null : Number(pct) };
}
const sumaCategorias = () => ETIQUETAS.reduce((s, e) => s + tarjeta(e).valor, 0);

describe('cuadre del panel de búsquedas', () => {
  it('"Solo México" y "Todo": todas las categorías (las 9) suman el Total de búsquedas', async () => {
    render(<AdminBusquedasPage />);
    await screen.findByText('Total de búsquedas');
    const totalMx = busquedas.filter((b) => b.pais === 'MX').length;
    expect(tarjeta('Total de búsquedas').valor).toBe(totalMx);
    expect(sumaCategorias()).toBe(totalMx);

    fireEvent.click(screen.getByRole('button', { name: '🌐 Todo' }));
    const totalTodo = busquedas.filter((b) => b.fecha >= CORTE).length;
    expect(tarjeta('Total de búsquedas').valor).toBe(totalTodo);
    expect(sumaCategorias()).toBe(totalTodo);
  });

  it('"Origen por país": las tres suman la base y ningún porcentaje pasa de 100%', async () => {
    render(<AdminBusquedasPage />);
    await screen.findByText('Total de búsquedas');
    const mx = tarjeta('🇲🇽 México (confirmado)');
    const fuera = tarjeta('🌎 Fuera de México (confirmado)');
    const desconocido = tarjeta('❓ País desconocido');
    expect(mx.valor + fuera.valor + desconocido.valor).toBe(busquedas.length);
    expect(desconocido.valor).toBe(busquedas.filter((b) => !b.pais).length);
    for (const t of [mx, fuera, desconocido]) expect(t.pct).toBeLessThanOrEqual(100);
  });
});
