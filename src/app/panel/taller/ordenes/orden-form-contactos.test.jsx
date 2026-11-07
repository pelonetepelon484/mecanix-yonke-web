// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Formulario de orden: sugerencias de la libreta de contactos (solo con datos del cliente y
// tallerId) y "prellenado" (desde una cita) sin tratarlo como orden guardada.
vi.mock('../../../lib/SelectorMarcaModelo', () => ({ default: ({ marca, modelo }) => <p>vehículo: {marca} {modelo}</p> }));
vi.mock('../contactos/config', () => ({ leerConfigContactos: vi.fn(async () => ({ habilitado: true })) }));
vi.mock('../contactos/datos', () => ({
  listarContactos: vi.fn(async () => ({ items: [{ id: 'c01', nombre: 'Juan Pérez', telefono: '6641234567', vehiculos: [{ marca: 'Nissan', modelo: 'Versa', anio: 2018, placas: 'ABC123' }] }], hayMas: false })),
  buscarContactos: vi.fn(async () => []),
}));

const { default: OrdenForm } = await import('./OrdenForm.js');

afterEach(() => cleanup());

describe('orden: contactos y prellenado', () => {
  it('con datos del cliente: al escribir sugiere y llena nombre, teléfono, vehículo y placas', async () => {
    const onGuardar = vi.fn(async () => {});
    render(<OrdenForm datosCliente tallerId="T1" onGuardar={onGuardar} onCancelar={() => {}} />);
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'jua' } });
    fireEvent.click(await screen.findByRole('option', { name: /Juan Pérez/ }));
    expect(screen.getByLabelText('Nombre')).toHaveValue('Juan Pérez');
    expect(screen.getByLabelText('Teléfono')).toHaveValue('6641234567');
    expect(screen.getByLabelText('Placas (opcional)')).toHaveValue('ABC123');
    expect(screen.getByLabelText('Año')).toHaveValue(2018);
    expect(screen.getByText('vehículo: Nissan Versa')).toBeInTheDocument();
  });
  it('sin datos del cliente no hay sugerencias (no hay campo de nombre)', () => {
    render(<OrdenForm tallerId="T1" onGuardar={() => {}} onCancelar={() => {}} />);
    expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument();
  });
  it('prellenado llena el formulario de una orden nueva', () => {
    const prellenado = { cliente: { nombre: 'Ana', telefono: '6640001122' }, vehiculo: { marca: 'Ford', modelo: 'Ka', anio: 2010 }, fallaReportada: 'No arranca' };
    render(<OrdenForm datosCliente prellenado={prellenado} onGuardar={() => {}} onCancelar={() => {}} />);
    expect(screen.getByLabelText('Nombre')).toHaveValue('Ana');
    expect(screen.getByLabelText('Falla reportada')).toHaveValue('No arranca');
    expect(screen.getByText('vehículo: Ford Ka')).toBeInTheDocument();
    expect(screen.queryByText(/Eliminar/)).not.toBeInTheDocument();
  });
});
