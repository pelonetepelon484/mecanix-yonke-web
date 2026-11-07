// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Formulario de cotización: sugerencias de la libreta de contactos (solo con datos del cliente,
// tallerId y sin solo lectura).
vi.mock('../../../lib/SelectorMarcaModelo', () => ({ default: ({ marca, modelo }) => <p>vehículo: {marca} {modelo}</p> }));
vi.mock('../contactos/config', () => ({ leerConfigContactos: vi.fn(async () => ({ habilitado: true })) }));
vi.mock('../contactos/datos', () => ({
  listarContactos: vi.fn(async () => ({ items: [{ id: 'c01', nombre: 'Juan Pérez', telefono: '6641234567', vehiculos: [{ marca: 'Nissan', modelo: 'Versa', anio: 2018, placas: 'ABC123' }] }], hayMas: false })),
  buscarContactos: vi.fn(async () => []),
}));

const { default: CotizacionForm } = await import('./CotizacionForm.js');
const campo = (texto) => screen.getByText(texto).nextElementSibling;

afterEach(() => cleanup());

describe('cotización: sugerencias de contactos', () => {
  it('al escribir el nombre sugiere y llena teléfono, vehículo y placas', async () => {
    render(<CotizacionForm tallerId="T1" onGuardar={() => {}} onCancelar={() => {}} />);
    fireEvent.change(campo('Nombre'), { target: { value: 'jua' } });
    fireEvent.click(await screen.findByRole('option', { name: /Juan Pérez/ }));
    expect(campo('Nombre')).toHaveValue('Juan Pérez');
    expect(campo('Teléfono')).toHaveValue('6641234567');
    expect(campo('Placas (opcional)')).toHaveValue('ABC123');
    expect(campo('Año')).toHaveValue(2018);
    expect(screen.getByText('vehículo: Nissan Versa')).toBeInTheDocument();
  });
  it('sin tallerId o en solo lectura no sugiere', async () => {
    for (const props of [{}, { tallerId: 'T1', soloLectura: true }]) {
      render(<CotizacionForm {...props} onGuardar={() => {}} onCancelar={() => {}} />);
      fireEvent.change(campo('Nombre'), { target: { value: 'jua' } });
      await new Promise((r) => setTimeout(r, 30));
      expect(screen.queryByRole('option', { name: /Juan Pérez/ })).not.toBeInTheDocument();
      cleanup();
    }
  });
});
