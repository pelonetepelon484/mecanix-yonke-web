// @vitest-environment jsdom
// Insignia ⭐ Premium (Términos: "Premium: la cuenta tiene el plan Premium vigente."): solo con
// Premium vigente = plan 'premium' y (premiumHasta vacío o futuro), SIEMPRE, con o sin
// config/planes.limitesActivos. El orden ("premium primero") no cambia: sigue con el plan guardado.
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const DIA = 86400000;
const ts = (ms) => ({ toDate: () => new Date(Date.now() + ms) });
const YONKES = {
  V: { nombre: 'A Premium vigente', plan: 'premium', premiumHasta: ts(30 * DIA) },
  X: { nombre: 'B Premium vencido', plan: 'premium', premiumHasta: ts(-DIA) },
  S: { nombre: 'C Premium sin fecha', plan: 'premium' },
  F: { nombre: 'D Básico freemium', plan: 'freemium' },
  BA: { nombre: 'E Básico basico', plan: 'basico' },
};
const ficha = (id) => ({ ...YONKES[id], activo: true, ciudad: 'tijuana', estado: 'baja-california', telefono: '6640000000' });

vi.mock('./firebase-server', () => ({ dbServer: {} }));
vi.mock('firebase/firestore', async (original) => ({
  ...(await original()),
  collection: (_db, ...ruta) => ruta.join('/'),
  doc: (_db, ...ruta) => ruta.join('/'),
  query: (ref) => ref,
  where: () => null,
  getDocs: async (ref) => ({
    empty: ref !== 'yonkes',
    size: 0,
    docs: ref === 'yonkes' ? Object.keys(YONKES).map((id) => ({ id, data: () => ficha(id) })) : [],
    forEach: () => {},
  }),
  getDoc: async (ruta) => {
    const id = ruta.split('/')[1];
    return { id, exists: () => id in YONKES, data: () => ficha(id) };
  },
}));
vi.mock('./busqueda/estadosServer', () => ({ obtenerEstadosCombinado: async () => [{ id: 'baja-california', nombre: 'Baja California' }] }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('404'); } }));

const { getYonkesPorCiudad, getYonkeById } = await import('./yonkesServerData');
const { default: PaginaCiudad } = await import('../yonkes/[ciudad]/page.js');
const { default: PaginaFicha } = await import('../yonkes/[ciudad]/[yonkeId]/page.js');

afterEach(() => cleanup());

describe('dato premiumVigente de cada yonke público', () => {
  it('vigente con fecha futura y sin fecha: sí; vencido, freemium y basico: no', async () => {
    const porNombre = Object.fromEntries((await getYonkesPorCiudad('tijuana')).map((y) => [y.nombre, y.premiumVigente]));
    expect(porNombre).toEqual({
      'A Premium vigente': true, 'B Premium vencido': false, 'C Premium sin fecha': true, 'D Básico freemium': false, 'E Básico basico': false,
    });
  });
  it('el orden no cambia: primero todos los de plan "premium" (también el vencido), por nombre', async () => {
    expect((await getYonkesPorCiudad('tijuana')).map((y) => y.nombre)).toEqual([
      'A Premium vigente', 'B Premium vencido', 'C Premium sin fecha', 'D Básico freemium', 'E Básico basico',
    ]);
  });
  it('getYonkeById trae el mismo dato', async () => {
    expect((await getYonkeById('X', 'tijuana')).premiumVigente).toBe(false);
    expect((await getYonkeById('S', 'tijuana')).premiumVigente).toBe(true);
  });
});

describe('insignia ⭐ Premium en las páginas públicas', () => {
  it('lista por ciudad: solo en el vigente y el que no tiene fecha', async () => {
    render(await PaginaCiudad({ params: Promise.resolve({ ciudad: 'tijuana' }) }));
    expect(screen.getAllByText('⭐ Premium')).toHaveLength(2);
  });
  for (const [id, conInsignia] of [['V', true], ['S', true], ['X', false], ['F', false], ['BA', false]]) {
    it(`ficha pública de "${YONKES[id].nombre}": ${conInsignia ? 'con' : 'sin'} insignia`, async () => {
      render(await PaginaFicha({ params: Promise.resolve({ ciudad: 'tijuana', yonkeId: id }) }));
      expect(screen.queryAllByText('⭐ Premium')).toHaveLength(conInsignia ? 1 : 0);
    });
  }
});
