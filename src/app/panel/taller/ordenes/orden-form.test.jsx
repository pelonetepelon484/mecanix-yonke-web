// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('../../../lib/SelectorMarcaModelo', () => ({ default: () => null }));

const { default: OrdenForm } = await import('./OrdenForm.js');
const { ADVERTENCIA_VEHICULO, ADVERTENCIA_OBSERVACIONES, MENSAJES_ORDEN } = await import('../../../../lib/ordenes');

const DIA = 86400000;
const formato = (d) => d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
const inicial = {
  folio: 'O251011-7KQ4', estado: 'recibido', cliente: {},
  vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 },
  fallaReportada: 'Ruido al frenar', observaciones: '', estadoRecepcion: '', pertenencias: '',
  trabajos: [{ descripcion: 'Cambio de balatas', cantidad: 1, precioUnitario: 500 }], piezas: [],
};
const entregada = {
  ...inicial, estado: 'entregado', garantiaDias: 30,
  fechaEntrega: { toDate: () => new Date(Date.now() - 5 * DIA) }, expiraAt: { toDate: () => new Date(Date.now() + 33 * DIA) },
};

afterEach(() => cleanup());

describe('formulario de orden de servicio', () => {
  it('los tres campos de texto libre llevan la advertencia y su límite; observaciones, la de cotizaciones', () => {
    render(<OrdenForm onGuardar={() => {}} onCancelar={() => {}} />);
    expect(screen.getAllByText(ADVERTENCIA_VEHICULO)).toHaveLength(3);
    expect(screen.getByText(ADVERTENCIA_OBSERVACIONES)).toBeInTheDocument();
    expect(screen.getByLabelText('Falla reportada')).toHaveAttribute('maxLength', '1000');
    expect(screen.getByLabelText('Estado del vehículo al recibirlo')).toHaveAttribute('maxLength', '500');
    expect(screen.getByLabelText('Pertenencias dentro del vehículo')).toHaveAttribute('maxLength', '500');
    expect(screen.getByLabelText('Observaciones del vehículo')).toHaveAttribute('maxLength', '1000');
  });
  it('no pide nombre, teléfono, placas, VIN ni fotos del cliente', () => {
    render(<OrdenForm onGuardar={() => {}} onCancelar={() => {}} />);
    for (const t of [/nombre/i, /tel[eé]fono/i, /placas/i, /vin/i, /foto/i]) expect(screen.queryByLabelText(t)).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
  it('al elegir "Entregado" pide la garantía y no deja guardar sin ella', async () => {
    const onGuardar = vi.fn();
    render(<OrdenForm inicial={inicial} onGuardar={onGuardar} onCancelar={() => {}} />);
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'entregado' } });
    const garantia = screen.getByLabelText(/Días de garantía/);
    expect(garantia).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAJES_ORDEN.garantia);
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    fireEvent.change(garantia, { target: { value: '400' } });
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    fireEvent.change(garantia, { target: { value: '30' } });
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
    expect(screen.getByTestId('borrado-previsto')).toHaveTextContent(`se eliminará el ${formato(new Date(Date.now() + 38 * DIA))} (al terminar la garantía)`);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onGuardar).toHaveBeenCalled());
    expect(onGuardar.mock.calls[0][0]).toMatchObject({ estado: 'entregado', garantiaDias: 30 });
  });
  it('si una entregada regresa a otro estado: quita la garantía y avisa el borrado a 88 días desde ese guardado', async () => {
    const onGuardar = vi.fn();
    render(<OrdenForm inicial={entregada} onGuardar={onGuardar} onCancelar={() => {}} />);
    expect(screen.getByTestId('borrado-previsto')).toHaveTextContent(formato(new Date(Date.now() + 33 * DIA)));
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'reparacion' } });
    expect(screen.queryByLabelText(/Días de garantía/)).not.toBeInTheDocument();
    expect(screen.getByTestId('borrado-previsto')).toHaveTextContent(`se eliminará el ${formato(new Date(Date.now() + 88 * DIA))}`);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onGuardar).toHaveBeenCalled());
    expect(onGuardar.mock.calls[0][0].estado).toBe('reparacion');
    expect('garantiaDias' in onGuardar.mock.calls[0][0]).toBe(false);
  });
  it('subtotal, IVA y total de trabajos + piezas', () => {
    render(<OrdenForm inicial={{ ...inicial, piezas: [{ descripcion: 'Balatas', cantidad: 2, precioUnitario: 250 }] }} onGuardar={() => {}} onCancelar={() => {}} />);
    expect(screen.getByText('Subtotal: $1,000.00')).toBeInTheDocument();
    expect(screen.getByText('IVA (16 %): $160.00')).toBeInTheDocument();
    expect(screen.getByText('Total: $1,160.00')).toBeInTheDocument();
  });
  it('renglones mal formados no rompen la pantalla y el texto se muestra como texto (no como HTML)', () => {
    const raro = { ...inicial, trabajos: [null, { descripcion: '<img src=x onerror="alert(1)">', cantidad: 'x', precioUnitario: null }, 7], piezas: 'basura', fallaReportada: '<b>negritas</b>' };
    render(<OrdenForm inicial={raro} onGuardar={() => {}} onCancelar={() => {}} />);
    expect(screen.getByDisplayValue('<img src=x onerror="alert(1)">')).toBeInTheDocument();
    expect(screen.getByLabelText('Falla reportada')).toHaveValue('<b>negritas</b>');
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('b')).toBeNull();
  });
  it('sin datos del cliente no muestra "Quitar datos del cliente"', () => {
    render(<OrdenForm inicial={inicial} onQuitarDatos={() => {}} puedeEliminar onEliminar={() => {}} onGuardar={() => {}} onCancelar={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Quitar datos del cliente' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar orden' })).toBeInTheDocument();
  });
  it('en solo lectura no se puede guardar', () => {
    render(<OrdenForm inicial={inicial} soloLectura onGuardar={() => {}} onCancelar={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
  });
  it('con datosCliente: pide nombre, teléfono y placas (opcionales) y los guarda', async () => {
    const onGuardar = vi.fn();
    render(<OrdenForm inicial={inicial} datosCliente onGuardar={onGuardar} onCancelar={() => {}} />);
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Juan Pérez' } });
    fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '664 111 2233' } });
    fireEvent.change(screen.getByLabelText('Placas (opcional)'), { target: { value: 'abc123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onGuardar).toHaveBeenCalled());
    expect(onGuardar.mock.calls[0][0].cliente).toEqual({ nombre: 'Juan Pérez', telefono: '664 111 2233' });
    expect(onGuardar.mock.calls[0][0].vehiculo.placas).toBe('ABC123');
  });
  it('sin datosCliente (bandera apagada, aviso pendiente u orden vieja): no hay campos y no se manda nada del cliente', async () => {
    const onGuardar = vi.fn();
    render(<OrdenForm inicial={{ ...inicial, cliente: { nombre: 'Juan' }, vehiculo: { ...inicial.vehiculo, placas: 'ABC123' } }} onGuardar={onGuardar} onCancelar={() => {}} />);
    expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Placas/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onGuardar).toHaveBeenCalled());
    expect(onGuardar.mock.calls[0][0].cliente).toEqual({});
    expect('placas' in onGuardar.mock.calls[0][0].vehiculo).toBe(false);
  });
  it('con datos del cliente guardados aparece "Quitar datos del cliente"', () => {
    render(<OrdenForm inicial={{ ...inicial, cliente: { nombre: 'Juan' } }} datosCliente onQuitarDatos={() => {}} onGuardar={() => {}} onCancelar={() => {}} />);
    expect(screen.getByRole('button', { name: 'Quitar datos del cliente' })).toBeInTheDocument();
  });
});

