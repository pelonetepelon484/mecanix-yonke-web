// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('../../../lib/SelectorMarcaModelo', () => ({ default: () => null }));

const { default: CotizacionForm } = await import('./CotizacionForm.js');

const inicial = {
  folio: 'C251006-7KQ4', archivada: false, estado: 'borrador', observaciones: '', vigenciaDias: 15,
  cliente: { nombre: 'Juan' }, vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 },
  renglones: [{ tipo: 'pieza', descripcion: 'Balata', cantidad: 1, precioUnitario: 500 }],
};

afterEach(() => cleanup());

describe('formulario de cotización', () => {
  it('muestra el aviso de observaciones y el límite de 1000 caracteres', () => {
    render(<CotizacionForm inicial={inicial} onGuardar={() => {}} onCancelar={() => {}} />);
    expect(screen.getByText('Solo observaciones del vehículo. No escribas nombres, teléfonos ni datos personales o sensibles.')).toBeInTheDocument();
    expect(document.querySelector('textarea').maxLength).toBe(1000);
  });
  it('con taller activo muestra "Quitar datos del cliente"', () => {
    render(<CotizacionForm inicial={inicial} tallerActivo onGuardar={() => {}} onCancelar={() => {}} onQuitarDatos={() => {}} />);
    expect(screen.getByRole('button', { name: 'Quitar datos del cliente' })).toBeInTheDocument();
  });
  it('con taller DESACTIVADO no muestra "Quitar datos del cliente"', () => {
    render(<CotizacionForm inicial={inicial} tallerActivo={false} onGuardar={() => {}} onCancelar={() => {}} onQuitarDatos={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Quitar datos del cliente' })).not.toBeInTheDocument();
  });
  it('muestra "Eliminar cotización" solo si puede eliminar', () => {
    const { unmount } = render(<CotizacionForm inicial={inicial} tallerActivo puedeEliminar onEliminar={() => {}} onGuardar={() => {}} onCancelar={() => {}} />);
    expect(screen.getByRole('button', { name: 'Eliminar cotización' })).toBeInTheDocument();
    unmount();
    render(<CotizacionForm inicial={inicial} tallerActivo puedeEliminar={false} onEliminar={() => {}} onGuardar={() => {}} onCancelar={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Eliminar cotización' })).not.toBeInTheDocument();
  });
  it('en solo lectura no muestra Guardar', () => {
    render(<CotizacionForm inicial={inicial} tallerActivo soloLectura onGuardar={() => {}} onCancelar={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
  });
  it('muestra subtotal, IVA (16 %) y total con IVA', () => {
    const conCentavos = {
      ...inicial,
      renglones: [
        { tipo: 'pieza', descripcion: 'Balata', cantidad: 3, precioUnitario: 19.99 },
        { tipo: 'manoObra', descripcion: 'Instalación', cantidad: 2, precioUnitario: 350.55 },
      ],
    };
    render(<CotizacionForm inicial={conCentavos} onGuardar={() => {}} onCancelar={() => {}} />);
    expect(screen.getByText('Subtotal: $761.07')).toBeInTheDocument();
    expect(screen.getByText('IVA (16 %): $121.77')).toBeInTheDocument();
    expect(screen.getByText('Total: $882.84')).toBeInTheDocument();
  });
  it('con un renglón inválido no muestra montos, pide revisar', () => {
    const sinDescripcion = { ...inicial, renglones: [{ tipo: 'pieza', descripcion: '', cantidad: 1, precioUnitario: 500 }] };
    render(<CotizacionForm inicial={sinDescripcion} onGuardar={() => {}} onCancelar={() => {}} />);
    expect(screen.getByText('Revisa los renglones')).toBeInTheDocument();
    expect(screen.queryByText(/^IVA/)).not.toBeInTheDocument();
  });
});
