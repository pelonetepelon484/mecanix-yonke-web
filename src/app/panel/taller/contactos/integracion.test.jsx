// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';

// Piezas compartidas con cotizaciones, órdenes y citas: sugerencias (autocompletar) y
// "Guardar en mis contactos". Las dos se esconden sin config/contactos.habilitado.
const push = vi.fn();
let configContactos = { habilitado: true };
let lista = { items: [], cursor: null, hayMas: false };
const listarContactos = vi.fn(async () => lista);
const buscarContactos = vi.fn(async () => []);
const crearContacto = vi.fn(async () => 'c03');

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('./config', () => ({ leerConfigContactos: vi.fn(async () => configContactos) }));
vi.mock('./datos', () => ({
  listarContactos: (...a) => listarContactos(...a),
  buscarContactos: (...a) => buscarContactos(...a),
  crearContacto: (...a) => crearContacto(...a),
}));

const { default: SugerenciasContactos } = await import('./SugerenciasContactos.js');
const { default: GuardarComoContacto } = await import('./GuardarComoContacto.js');

const juan = { id: 'c01', nombre: 'Juan Pérez', telefono: '6641234567', vehiculos: [{ marca: 'Nissan', modelo: 'Versa', anio: 2018, placas: 'ABC123' }, { marca: 'Ford', modelo: 'Ka' }] };
const ana = { id: 'c02', nombre: 'Ana López', telefono: '', vehiculos: [] };

function Campo({ onElegir }) {
  const [texto, setTexto] = useState('');
  return (
    <>
      <input aria-label="Nombre" value={texto} onChange={(e) => setTexto(e.target.value)} />
      <SugerenciasContactos tallerId="T1" texto={texto} onElegir={(c, v) => { setTexto(c.nombre); onElegir(c, v); }} />
    </>
  );
}

afterEach(() => {
  cleanup(); push.mockClear();
  [listarContactos, buscarContactos, crearContacto].forEach((f) => f.mockClear());
  buscarContactos.mockResolvedValue([]);
  configContactos = { habilitado: true };
  lista = { items: [], cursor: null, hayMas: false };
});

describe('SugerenciasContactos', () => {
  it('con 2 letras sugiere (una opción por vehículo) y al elegir se cierra', async () => {
    lista = { items: [juan, ana], cursor: null, hayMas: false };
    const onElegir = vi.fn();
    render(<Campo onElegir={onElegir} />);
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'j' } });
    await new Promise((r) => setTimeout(r, 20));
    expect(listarContactos).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'ju' } });
    const opciones = await screen.findAllByRole('option');
    expect(opciones).toHaveLength(2);
    expect(screen.getByText('🚗 Ford Ka')).toBeInTheDocument();
    expect(screen.queryByText('Ana López')).not.toBeInTheDocument();
    fireEvent.click(opciones[0]);
    expect(onElegir).toHaveBeenCalledWith(juan, juan.vehiculos[0]);
    await waitFor(() => expect(screen.queryByRole('option')).not.toBeInTheDocument());
    expect(listarContactos).toHaveBeenCalledTimes(1);
  });
  it('sin config/contactos no lee ni muestra nada', async () => {
    configContactos = null;
    lista = { items: [juan], cursor: null, hayMas: false };
    render(<Campo onElegir={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'juan' } });
    await new Promise((r) => setTimeout(r, 30));
    expect(listarContactos).not.toHaveBeenCalled();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });
  it('con más de 50 contactos también busca en Firestore', async () => {
    lista = { items: [ana], cursor: null, hayMas: true };
    buscarContactos.mockResolvedValue([juan]);
    render(<Campo onElegir={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'juan' } });
    expect(await screen.findAllByText('Juan Pérez', {}, { timeout: 2000 })).toHaveLength(2);
    expect(buscarContactos).toHaveBeenCalledWith('T1', 'juan');
  });
});

describe('GuardarComoContacto', () => {
  const datos = { nombre: 'Juan Pérez', telefono: '6641234567', vehiculo: { marca: 'Nissan', modelo: 'Versa', anio: 2018, placas: 'ABC123' } };
  it('guarda el contacto y deja abrirlo', async () => {
    render(<GuardarComoContacto tallerId="T1" taller={{ plan: 'basico' }} puedeEscribir datos={datos} />);
    fireEvent.click(await screen.findByRole('button', { name: '📇 Guardar en mis contactos' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Guardado en tus contactos.');
    expect(crearContacto).toHaveBeenCalledWith({
      tallerId: 'T1', premium: false,
      datos: { nombre: 'Juan Pérez', telefono: '6641234567', nota: '', vehiculos: [{ marca: 'Nissan', modelo: 'Versa', anio: 2018, placas: 'ABC123' }] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ver contacto' }));
    expect(push).toHaveBeenCalledWith('/panel/taller/contactos/c03');
  });
  it('si ya existe ese WhatsApp no crea otro', async () => {
    buscarContactos.mockResolvedValueOnce([juan]);
    render(<GuardarComoContacto tallerId="T1" taller={{}} puedeEscribir datos={datos} />);
    fireEvent.click(await screen.findByRole('button', { name: '📇 Guardar en mis contactos' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Este cliente ya está en tus contactos.');
    expect(crearContacto).not.toHaveBeenCalled();
  });
  it('Básico lleno: muestra el mensaje de la libreta', async () => {
    crearContacto.mockRejectedValueOnce(new Error('Llegaste a 25 contactos del plan Básico.'));
    render(<GuardarComoContacto tallerId="T1" taller={{}} puedeEscribir datos={{ nombre: 'Ana' }} />);
    fireEvent.click(await screen.findByRole('button', { name: '📇 Guardar en mis contactos' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Llegaste a 25 contactos');
  });
  it('no aparece sin bandera, sin permiso o sin nombre', async () => {
    for (const [cfg, puede, d] of [[null, true, datos], [{ habilitado: true }, false, datos], [{ habilitado: true }, true, { nombre: ' ' }]]) {
      configContactos = cfg;
      render(<GuardarComoContacto tallerId="T1" taller={{}} puedeEscribir={puede} datos={d} />);
      await new Promise((r) => setTimeout(r, 20));
      expect(screen.queryByRole('button', { name: '📇 Guardar en mis contactos' })).not.toBeInTheDocument();
      cleanup();
    }
  });
});
