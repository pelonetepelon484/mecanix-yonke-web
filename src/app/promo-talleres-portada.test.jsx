// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// "N meses de Premium gratis al registrarte" (config/talleres) en la portada: pestaña "¿Tienes un
// taller?" y tarjeta Premium de talleres. Solo con la promoción encendida; si no, la portada es la
// de siempre. La bandera se lee en el servidor (page.js), sin lecturas por visitante.
let docs = {};
vi.mock('./lib/firebase', () => ({ db: 'db' }));
vi.mock('./lib/firebase-server', () => ({ dbServer: 'dbServer' }));
vi.mock('firebase/firestore', () => ({
  doc: (...a) => a.slice(1).join('/'),
  collection: (...a) => a.slice(1).join('/'),
  query: (...a) => a[0], where: () => null, orderBy: () => null, limit: () => null,
  getDoc: vi.fn(async (ruta) => ({ exists: () => ruta in docs, data: () => docs[ruta] })),
  getDocs: vi.fn(async () => ({ docs: [], empty: true, size: 0, forEach: () => {} })),
  addDoc: vi.fn(async () => ({ id: 'x' })),
}));

const { default: HomeClient } = await import('./HomeClient');
const { TarjetasPlanesTaller } = await import('./TarjetasPlanes');
const { leerPromoTalleres } = await import('../lib/premiumGratis');

afterEach(() => { cleanup(); docs = {}; vi.unstubAllEnvs(); });

const abrirTaller = () => fireEvent.click(screen.getByRole('button', { name: '🔧 ¿Tienes un taller?' }));

describe('portada: pestaña "¿Tienes un taller?"', () => {
  it('con la promoción: el mensaje con los meses', () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    render(<HomeClient textoSeoEstados="" mesesPromoTaller={3} />);
    abrirTaller();
    expect(screen.getByText(/3 meses de Premium gratis al registrarte/)).toBeInTheDocument();
  });
  it('sin la promoción: nada (mismo HTML que sin la propiedad)', () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    const sin = render(<HomeClient textoSeoEstados="" />);
    abrirTaller();
    expect(screen.queryByText(/Premium gratis/)).not.toBeInTheDocument();
    const html = sin.container.innerHTML;
    cleanup();
    render(<HomeClient textoSeoEstados="" mesesPromoTaller={null} />);
    abrirTaller();
    expect(document.body.firstChild.innerHTML).toBe(html);
  });
});

describe('tarjetas de planes de talleres', () => {
  it('con meses: la nota en la tarjeta Premium; sin meses: como siempre', () => {
    render(<TarjetasPlanesTaller mesesPromo={1} />);
    expect(screen.getByText(/1 mes de Premium gratis al registrarte/)).toBeInTheDocument();
    cleanup();
    render(<TarjetasPlanesTaller />);
    expect(screen.queryByText(/Premium gratis/)).not.toBeInTheDocument();
  });
});

describe('lectura de config/talleres para las páginas públicas', () => {
  it('meses solo con la bandera encendida y meses válidos; si falla, null', async () => {
    expect(await leerPromoTalleres('db')).toBeNull();
    docs['config/talleres'] = { premiumGratisHabilitado: false, mesesPremiumGratis: 3 };
    expect(await leerPromoTalleres('db')).toBeNull();
    docs['config/talleres'] = { premiumGratisHabilitado: true };
    expect(await leerPromoTalleres('db')).toBe(3);
    docs['config/talleres'] = { premiumGratisHabilitado: true, mesesPremiumGratis: 6 };
    expect(await leerPromoTalleres('db')).toBe(6);
    docs['config/talleres'] = { premiumGratisHabilitado: true, mesesPremiumGratis: 0 };
    expect(await leerPromoTalleres('db')).toBeNull();
    const { getDoc } = await import('firebase/firestore');
    getDoc.mockRejectedValueOnce(new Error('sin red'));
    expect(await leerPromoTalleres('db')).toBeNull();
  });
});
