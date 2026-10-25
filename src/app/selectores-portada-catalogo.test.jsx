// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

// Los dos selectores de marca/modelo de la página principal (Búsqueda avanzada y el aviso
// "pieza sin vehículo") leen la misma lista que el resto: catálogo base + catálogo vivo.
// Firestore simulado: el catálogo vivo NO tiene MG, BYD, Atoz ni Gladiator, y sí un modelo que
// solo existe en vivo ("Modelo Solo Vivo").
const CATALOGO_VIVO = { Dodge: ['Ram 1500', 'Modelo Solo Vivo'], Nissan: ['Tsuru'] };
let escrituras = 0;
vi.mock('./lib/firebase', () => ({ db: 'db' }));
vi.mock('firebase/firestore', () => ({
  doc: (...a) => a.slice(1).join('/'),
  collection: (...a) => a.slice(1).join('/'),
  query: (...a) => a[0], where: () => null, orderBy: () => null, limit: () => null,
  getDoc: vi.fn(async (ruta) => (ruta === 'config/catalogoVehiculos'
    ? { exists: () => true, data: () => ({ catalogo: CATALOGO_VIVO }) }
    : { exists: () => false, data: () => ({}) })),
  getDocs: vi.fn(async () => ({ docs: [], empty: true, size: 0, forEach: () => {} })),
  addDoc: vi.fn(async () => { escrituras += 1; return { id: 'x' }; }),
  setDoc: vi.fn(async () => { escrituras += 1; }),
  updateDoc: vi.fn(async () => { escrituras += 1; }),
}));

const { default: HomeClient } = await import('./HomeClient');

beforeEach(() => {
  escrituras = 0;
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ estado: 'pieza_sin_vehiculo', mensaje: '¿Para qué vehículo es?', pieza: 'Faro', ejemplo: 'faro tsuru 2005' }),
  }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const opciones = (select) => within(select).getAllByRole('option').map((o) => o.textContent);

async function selectoresBusquedaAvanzada() {
  fireEvent.click(screen.getByText(/Búsqueda avanzada/));
  // El selector de marca es el que trae la opción "Otra marca (escribir)".
  return waitFor(() => {
    const marca = screen.getAllByRole('combobox').find((s) => opciones(s).some((t) => t.includes('Otra marca')));
    expect(marca).toBeTruthy();
    expect(opciones(marca)).toContain('MG');
    return marca;
  });
}

async function selectorAvisoPiezaSinVehiculo() {
  fireEvent.change(screen.getByPlaceholderText('¿Qué pieza necesitas?'), { target: { value: 'faro' } });
  fireEvent.click(screen.getByRole('button', { name: /Buscar con IA/ }));
  await screen.findByText('¿Para qué vehículo es?');
  const aviso = screen.getByText('¿Para qué vehículo es?').closest('div').parentElement;
  return within(aviso).getAllByRole('combobox')[0];
}

describe('selectores de marca y modelo de la página principal', () => {
  it('Búsqueda avanzada: MG, BYD, Hyundai Atoz y Jeep Gladiator aunque el catálogo vivo no los tenga; el modelo solo del vivo sigue', async () => {
    render(<HomeClient textoSeoEstados="" />);
    const marca = await selectoresBusquedaAvanzada();
    expect(opciones(marca)).toEqual(expect.arrayContaining(['MG', 'BYD', 'Hyundai', 'Jeep', 'Dodge', 'Nissan']));
    const modeloDe = (m) => {
      fireEvent.change(marca, { target: { value: m } });
      const modelo = screen.getAllByRole('combobox').find((s) => opciones(s).some((t) => t.includes('Otro modelo')));
      return opciones(modelo);
    };
    expect(modeloDe('Hyundai')).toContain('Atoz');
    expect(modeloDe('Jeep')).toContain('Gladiator');
    expect(modeloDe('BYD')).toContain('Dolphin');
    expect(modeloDe('Dodge')).toEqual(expect.arrayContaining(['Modelo Solo Vivo', 'Ram 1500', 'Atos']));
  });

  it('aviso "pieza sin vehículo": la misma lista combinada', async () => {
    render(<HomeClient textoSeoEstados="" />);
    const marca = await selectorAvisoPiezaSinVehiculo();
    await waitFor(() => expect(opciones(marca)).toEqual(expect.arrayContaining(['MG', 'BYD', 'Hyundai', 'Jeep', 'Dodge'])));
    const aviso = marca.parentElement;
    const modeloDe = (m) => {
      fireEvent.change(marca, { target: { value: m } });
      return opciones(within(aviso).getAllByRole('combobox')[1]);
    };
    expect(modeloDe('Hyundai')).toContain('Atoz');
    expect(modeloDe('Jeep')).toContain('Gladiator');
    expect(modeloDe('Dodge')).toContain('Modelo Solo Vivo');
  });

  it('solo lee el catálogo vivo: no escribe nada en Firestore', async () => {
    render(<HomeClient textoSeoEstados="" />);
    await selectoresBusquedaAvanzada();
    expect(escrituras).toBe(0);
  });
});
