// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const cambiar = vi.fn(async () => []);
const quitar = vi.fn(async () => []);
vi.mock('./datos', () => ({
  recordatoriosDe: (v) => v.recordatorios,
  cambiarRecordatorioDelVehiculo: (...a) => cambiar(...a),
  quitarRecordatorioDelVehiculo: (...a) => quitar(...a),
}));
const { default: Recordatorios } = await import('./Recordatorios.js');

const F = new Date(2026, 5, 15, 12).getTime();
const rec = (id, extra = {}) => ({ id, tipo: `Servicio ${id}`, fecha: F, avisarDiasAntes: 15, folio: 'O1', estado: 'pendiente', creadoAt: 0, ...extra });
const vehiculo = { id: 'V1', recordatorios: [rec('b', { estado: 'atendido', tipo: 'Frenos' }), rec('a', { tipo: 'Cambio de aceite' })] };
afterEach(() => { cleanup(); cambiar.mockClear(); quitar.mockClear(); vi.restoreAllMocks(); });

describe('recordatorios del vehículo', () => {
  it('pendientes primero; sin poder escribir solo se ven (sin botones)', () => {
    render(<Recordatorios tallerId="T1" vehiculo={vehiculo} puedeEscribir={false} onGuardado={() => {}} />);
    const titulos = screen.getAllByText(/Cambio de aceite|Frenos/).map((e) => e.textContent);
    expect(titulos[0]).toContain('Cambio de aceite');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('adelantar la fecha, cambiar días y marcar atendido', async () => {
    const onGuardado = vi.fn();
    render(<Recordatorios tallerId="T1" vehiculo={vehiculo} puedeEscribir onGuardado={onGuardado} />);
    fireEvent.change(screen.getByLabelText('Fecha de Cambio de aceite'), { target: { value: '2026-04-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar fecha' }));
    await act(async () => {});
    expect(cambiar).toHaveBeenCalledWith('T1', vehiculo, 'a', { fecha: new Date('2026-04-01T12:00:00').getTime() });
    fireEvent.change(screen.getByLabelText('Días de aviso de Cambio de aceite'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar días' }));
    await act(async () => {});
    expect(cambiar).toHaveBeenLastCalledWith('T1', vehiculo, 'a', { avisarDiasAntes: 30 });
    fireEvent.click(screen.getByRole('button', { name: 'Atendido' }));
    await act(async () => {});
    expect(cambiar).toHaveBeenLastCalledWith('T1', vehiculo, 'a', { estado: 'atendido' });
    expect(onGuardado).toHaveBeenCalledTimes(3);
  });
  it('días fuera de 0 a 60: mensaje y no guarda', async () => {
    render(<Recordatorios tallerId="T1" vehiculo={vehiculo} puedeEscribir onGuardado={() => {}} />);
    fireEvent.change(screen.getByLabelText('Días de aviso de Cambio de aceite'), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar días' }));
    await act(async () => {});
    expect(screen.getByRole('alert')).toHaveTextContent('0 a 60');
    expect(cambiar).not.toHaveBeenCalled();
  });
  it('quitar pide confirmación', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Recordatorios tallerId="T1" vehiculo={vehiculo} puedeEscribir onGuardado={() => {}} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Quitar' })[0]);
    await act(async () => {});
    expect(quitar).toHaveBeenCalledWith('T1', vehiculo, 'a');
  });
});
