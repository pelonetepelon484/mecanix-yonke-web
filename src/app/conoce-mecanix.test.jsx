// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// "¿Quieres saber más sobre Mecanix?" (ConoceMecanix.js): botones a /bienvenida con la pestaña
// elegida, y su lugar en la portada (en vez del diagrama solo con config/portada.bienvenida).
vi.mock('./lib/firebase', () => ({ db: 'db' }));
vi.mock('firebase/firestore', () => ({
  doc: (...a) => a.slice(1).join('/'),
  collection: (...a) => a.slice(1).join('/'),
  query: (...a) => a[0], where: () => null, orderBy: () => null, limit: () => null,
  getDoc: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
  getDocs: vi.fn(async () => ({ docs: [], empty: true, size: 0, forEach: () => {} })),
  addDoc: vi.fn(async () => ({ id: 'x' })),
}));

const { default: ConoceMecanix, TITULO_CONOCE, TEXTO_CONOCE } = await import('./ConoceMecanix');
const { TITULO_COMO_FUNCIONA } = await import('./ComoFuncionaBuscador');
const { default: HomeClient } = await import('./HomeClient');

afterEach(() => { cleanup(); delete window.gtag; });

describe('ConoceMecanix', () => {
  it('título, texto y los tres botones con su pestaña de /bienvenida', () => {
    render(<ConoceMecanix conTalleres />);
    expect(screen.getByRole('heading', { name: TITULO_CONOCE })).toBeInTheDocument();
    expect(screen.getByText(TEXTO_CONOCE)).toBeInTheDocument();
    expect(screen.getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['🚗 Soy cliente', '/bienvenida?soy=cliente#primeros-pasos'],
      ['🏪 Tengo un yonke', '/bienvenida?soy=yonke#primeros-pasos'],
      ['🔧 Tengo un taller', '/bienvenida?soy=taller#primeros-pasos'],
    ]);
  });

  it('sin talleres no aparece "Tengo un taller"', () => {
    render(<ConoceMecanix />);
    expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual(['🚗 Soy cliente', '🏪 Tengo un yonke']);
  });

  it('registra el clic en Google Analytics', () => {
    window.gtag = vi.fn();
    render(<ConoceMecanix />);
    const enlace = screen.getByRole('link', { name: '🚗 Soy cliente' });
    enlace.addEventListener('click', (e) => e.preventDefault());
    fireEvent.click(enlace);
    expect(window.gtag).toHaveBeenCalledWith('event', 'conoce_mecanix', { tipo: 'cliente' });
  });
});

describe('portada (HomeClient)', () => {
  it('con /bienvenida encendida: la tarjeta en vez del diagrama', () => {
    render(<HomeClient textoSeoEstados="" bienvenida />);
    const caja = screen.getByRole('heading', { name: TITULO_CONOCE }).closest('section');
    expect(within(caja).getByRole('link', { name: '🚗 Soy cliente' })).toBeInTheDocument();
    expect(screen.queryByText(TITULO_COMO_FUNCIONA)).not.toBeInTheDocument();
  });

  it('apagada: sigue el diagrama y no hay enlace a /bienvenida', () => {
    render(<HomeClient textoSeoEstados="" />);
    expect(screen.getByText(TITULO_COMO_FUNCIONA)).toBeInTheDocument();
    expect(screen.queryByText(TITULO_CONOCE)).not.toBeInTheDocument();
  });
});
