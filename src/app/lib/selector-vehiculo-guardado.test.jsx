// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// SelectorMarcaModelo al abrir un vehículo ya guardado: reconoce la marca y el modelo con la misma
// clave que cargarCatalogoCombinado() (sin mayúsculas, acentos ni espacios sobrantes), sin cambiar
// lo guardado. Firestore simulado: catálogo vivo vacío (solo el catálogo base).
vi.mock('./firebase', () => ({ db: 'db' }));
vi.mock('firebase/firestore', () => ({
  doc: () => 'config/catalogoVehiculos',
  getDoc: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
}));

const { default: SelectorMarcaModelo } = await import('./SelectorMarcaModelo');

afterEach(() => { cleanup(); });

// Formulario mínimo como el de inventario: guarda lo que el selector le reporta.
function Formulario({ inicial, onGuardar }) {
  const [marca, setMarca] = useState(inicial.marca);
  const [modelo, setModelo] = useState(inicial.modelo);
  return (
    <>
      <SelectorMarcaModelo marca={marca} modelo={modelo} onMarca={setMarca} onModelo={setModelo} />
      <button type="button" onClick={() => onGuardar({ marca, modelo })}>Guardar</button>
    </>
  );
}

async function abrir(inicial) {
  const onGuardar = vi.fn();
  render(<Formulario inicial={inicial} onGuardar={onGuardar} />);
  // Espera a que cargue el catálogo (aparecen los <select>).
  const marca = await waitFor(() => {
    const s = screen.getAllByRole('combobox')[0];
    expect(s).toBeTruthy();
    return s;
  });
  const guardar = () => { fireEvent.click(screen.getByRole('button', { name: 'Guardar' })); return onGuardar.mock.calls.at(-1)[0]; };
  return { marca, modeloSelect: () => screen.getAllByRole('combobox')[1], guardar };
}

describe('SelectorMarcaModelo con un vehículo ya guardado', () => {
  it('"dodge" se selecciona como "Dodge" (no "Otra marca")', async () => {
    const { marca, modeloSelect } = await abrir({ marca: 'dodge', modelo: 'Neon' });
    await waitFor(() => expect(marca).toHaveValue('Dodge'));
    expect(modeloSelect()).toHaveValue('Neon');
    expect(screen.queryByPlaceholderText('Escribe la marca nueva')).not.toBeInTheDocument();
  });

  it('"Civic " se selecciona como "Civic" (no "Otro modelo")', async () => {
    const { marca, modeloSelect } = await abrir({ marca: 'Honda', modelo: 'Civic ' });
    await waitFor(() => expect(marca).toHaveValue('Honda'));
    expect(modeloSelect()).toHaveValue('Civic');
    expect(screen.queryByPlaceholderText('Escribe el modelo nuevo')).not.toBeInTheDocument();
  });

  it('abrir y guardar sin tocar el selector no cambia la marca ni el modelo guardados', async () => {
    const { marca, guardar } = await abrir({ marca: ' DODGE ', modelo: 'neon ' });
    await waitFor(() => expect(marca).toHaveValue('Dodge'));
    expect(guardar()).toEqual({ marca: ' DODGE ', modelo: 'neon ' });
  });

  it('si el yonke cambia la marca (y el modelo), se guarda la opción elegida', async () => {
    const { marca, modeloSelect, guardar } = await abrir({ marca: 'dodge', modelo: 'Neon' });
    await waitFor(() => expect(marca).toHaveValue('Dodge'));
    fireEvent.change(marca, { target: { value: 'Nissan' } });
    expect(guardar()).toEqual({ marca: 'Nissan', modelo: '' });
    fireEvent.change(modeloSelect(), { target: { value: 'Tsuru' } });
    expect(guardar()).toEqual({ marca: 'Nissan', modelo: 'Tsuru' });
  });

  it('una marca que no está en el catálogo sigue mostrando "Otra marca" con lo guardado', async () => {
    const { marca, guardar } = await abrir({ marca: 'Marca Rara', modelo: 'X1' });
    await waitFor(() => expect(marca).toHaveValue('OTRA'));
    expect(screen.getByPlaceholderText('Escribe la marca nueva')).toHaveValue('Marca Rara');
    expect(guardar()).toEqual({ marca: 'Marca Rara', modelo: 'X1' });
  });

  it('"crv" y "CR-V" siguen siendo distintos: "crv" sale como "Otro modelo"', async () => {
    const { marca, modeloSelect } = await abrir({ marca: 'Honda', modelo: 'crv' });
    await waitFor(() => expect(marca).toHaveValue('Honda'));
    expect(modeloSelect()).toHaveValue('OTRA');
    expect(screen.getByPlaceholderText('Escribe el modelo nuevo')).toHaveValue('crv');
  });
});
