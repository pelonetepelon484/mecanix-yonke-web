// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Bloque "Ecosistema de soluciones automotrices" (config/portada.ecosistema): el componente y su
// lugar en la portada (al final de la pestaña cliente, después del bloque SEO). Firestore simulado.
vi.mock('./lib/firebase', () => ({ db: 'db' }));
vi.mock('firebase/firestore', () => ({
  doc: (...a) => a.slice(1).join('/'),
  collection: (...a) => a.slice(1).join('/'),
  query: (...a) => a[0], where: () => null, orderBy: () => null, limit: () => null,
  getDoc: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
  getDocs: vi.fn(async () => ({ docs: [], empty: true, size: 0, forEach: () => {} })),
  addDoc: vi.fn(async () => ({ id: 'x' })),
}));

const { default: EcosistemaMecanix } = await import('./EcosistemaMecanix');
const { default: HomeClient } = await import('./HomeClient');

afterEach(() => { cleanup(); });

const TITULO = 'Ecosistema de soluciones automotrices';
const ENTRADA = 'Mecanix conecta yonkes, talleres y más soluciones automotrices en un solo lugar.';
const TARJETAS = [
  ['Yonkes', 'Autopartes usadas.'],
  ['Talleres y servicios', 'Cotizaciones, pedido de piezas y órdenes de servicio para talleres.'],
  ['Refacciones nuevas', 'Piezas nuevas de refaccionarias.'],
  ['Especialistas', 'Más especialidades automotrices.'],
  ['Servicios futuros', 'Nuevas soluciones para el sector automotriz.'],
];

describe('EcosistemaMecanix', () => {
  it('título h2, línea de entrada y las 5 tarjetas (h3) en orden, con sus textos exactos', () => {
    render(<EcosistemaMecanix />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(TITULO);
    expect(screen.getByText(ENTRADA)).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(TARJETAS.map(([t]) => t));
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(5);
    TARJETAS.forEach(([t, d], i) => {
      expect(within(items[i]).getByRole('heading', { level: 3 })).toHaveTextContent(t);
      expect(within(items[i]).getByText(d)).toBeInTheDocument();
    });
  });

  it('las 2 activas sin etiqueta; las 3 de "Próximamente" con la etiqueta; ninguna con enlace ni botón', () => {
    render(<EcosistemaMecanix />);
    const items = screen.getAllByRole('listitem');
    items.slice(0, 2).forEach((li) => expect(within(li).queryByText('Próximamente')).not.toBeInTheDocument());
    items.slice(2).forEach((li) => expect(within(li).getByText('Próximamente')).toBeInTheDocument());
    for (const li of items) {
      expect(within(li).queryByRole('link')).not.toBeInTheDocument();
      expect(within(li).queryByRole('button')).not.toBeInTheDocument();
    }
  });

  it('no pide datos (sin formularios ni campos) ni usa "nuestros", "nuestra" o "recuperadas"', () => {
    const { container } = render(<EcosistemaMecanix />);
    expect(container.querySelector('form, input, select, textarea, button, a')).toBeNull();
    expect(container.textContent).not.toMatch(/nuestros|nuestra|recuperadas/i);
  });

  it('no repite el bloque SEO de la portada', () => {
    const { container } = render(<EcosistemaMecanix />);
    expect(container.textContent).not.toMatch(/Refacciones y autopartes usadas en México|buscador de refacciones y autopartes usadas/);
  });
});

describe('portada (HomeClient)', () => {
  it('bandera apagada: el bloque no aparece (la portada queda igual que hoy)', () => {
    render(<HomeClient textoSeoEstados="" />);
    expect(screen.queryByText(TITULO)).not.toBeInTheDocument();
    render(<HomeClient textoSeoEstados="" ecosistema={false} />);
    expect(screen.queryByText(TITULO)).not.toBeInTheDocument();
  });

  it('bandera encendida: aparece en la pestaña cliente, justo después del bloque SEO', () => {
    render(<HomeClient textoSeoEstados="" ecosistema />);
    const titulo = screen.getByRole('heading', { level: 2, name: TITULO });
    const seo = screen.getByRole('heading', { level: 2, name: 'Refacciones y autopartes usadas en México' });
    expect(seo.compareDocumentPosition(titulo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Inmediatamente después: la caja del bloque SEO y la del ecosistema son hermanas seguidas.
    expect(seo.parentElement.nextElementSibling).toBe(titulo.closest('section'));
  });
});
