// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const cambiar = vi.fn(async () => []);
const quitar = vi.fn(async () => []);
const agregar = vi.fn(async () => []);
vi.mock('./datos', () => ({
  recordatoriosDe: (v) => v.recordatorios || [],
  cambiarRecordatorioDelVehiculo: (...a) => cambiar(...a),
  quitarRecordatorioDelVehiculo: (...a) => quitar(...a),
  agregarRecordatorios: (...a) => agregar(...a),
}));
const { default: Recordatorios } = await import('./Recordatorios.js');

const F = new Date(2026, 5, 15, 12).getTime();
const rec = (id, extra = {}) => ({ id, tipo: `Servicio ${id}`, fecha: F, avisarDiasAntes: 15, folio: 'O1', estado: 'pendiente', creadoAt: 0, ...extra });
const vehiculo = { id: 'V1', recordatorios: [rec('b', { estado: 'atendido', tipo: 'Frenos' }), rec('a', { tipo: 'Cambio de aceite' })] };
afterEach(() => { cleanup(); cambiar.mockClear(); quitar.mockClear(); agregar.mockClear(); vi.restoreAllMocks(); });

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

describe('"Agregar recordatorio" en un vehículo ya existente', () => {
  const ts = (d) => ({ toMillis: () => d.getTime() });
  const VIEJO = new Date(2026, 0, 10, 12);
  const NUEVO = new Date(2026, 2, 20, 12);
  // Vehículo de la etapa 2: sin recordatorios; el último servicio (por fecha) es O2 aunque esté primero.
  const v2 = { id: 'V2', servicios: [{ folio: 'O2', fecha: ts(NUEVO) }, { folio: 'O1', fecha: ts(VIEJO) }] };

  it('solo con permiso de escribir y con servicios', () => {
    render(<Recordatorios tallerId="T1" vehiculo={v2} puedeEscribir={false} onGuardado={() => {}} />);
    expect(screen.queryByRole('button', { name: '+ Agregar recordatorio' })).not.toBeInTheDocument();
    cleanup();
    render(<Recordatorios tallerId="T1" vehiculo={{ id: 'V3', servicios: [] }} puedeEscribir onGuardado={() => {}} />);
    expect(screen.queryByRole('button', { name: '+ Agregar recordatorio' })).not.toBeInTheDocument();
    cleanup();
    render(<Recordatorios tallerId="T1" vehiculo={v2} puedeEscribir onGuardado={() => {}} />);
    expect(screen.getByRole('button', { name: '+ Agregar recordatorio' })).toBeInTheDocument();
  });

  it('servicio periódico con meses editables desde la entrega del ÚLTIMO servicio (su folio)', async () => {
    const onGuardado = vi.fn();
    render(<Recordatorios tallerId="T1" vehiculo={v2} puedeEscribir onGuardado={onGuardado} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar recordatorio' }));
    fireEvent.change(screen.getByLabelText('Servicio del recordatorio'), { target: { value: 'Batería' } });
    expect(screen.getByLabelText('Meses del recordatorio')).toHaveValue(24);
    fireEvent.change(screen.getByLabelText('Meses del recordatorio'), { target: { value: '18' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar recordatorio' }));
    await act(async () => {});
    expect(agregar).toHaveBeenCalledWith('T1', 'V2', [{ tipo: 'Batería', meses: 18 }], { fechaEntrega: NUEVO.getTime(), folio: 'O2' });
    expect(onGuardado).toHaveBeenCalled();
  });

  it('otro servicio con la fecha elegida a mano', async () => {
    render(<Recordatorios tallerId="T1" vehiculo={v2} puedeEscribir onGuardado={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar recordatorio' }));
    fireEvent.change(screen.getByLabelText('Servicio del recordatorio'), { target: { value: '__otro__' } });
    fireEvent.change(screen.getByLabelText('Otro servicio'), { target: { value: 'Clima' } });
    fireEvent.click(screen.getByLabelText(/Elegir la fecha/));
    fireEvent.change(screen.getByLabelText('Fecha elegida'), { target: { value: '2026-09-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar recordatorio' }));
    await act(async () => {});
    expect(agregar).toHaveBeenCalledWith('T1', 'V2', [{ tipo: 'Clima', fecha: new Date('2026-09-01T12:00:00').getTime() }], { fechaEntrega: NUEVO.getTime(), folio: 'O2' });
  });

  it('sin servicio escrito, meses fuera de rango o sin fecha: mensaje y no guarda', async () => {
    render(<Recordatorios tallerId="T1" vehiculo={v2} puedeEscribir onGuardado={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar recordatorio' }));
    fireEvent.change(screen.getByLabelText('Meses del recordatorio'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar recordatorio' }));
    expect(screen.getByRole('alert')).toHaveTextContent('1 a 120 meses');
    fireEvent.click(screen.getByLabelText(/Elegir la fecha/));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar recordatorio' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Elige la fecha');
    fireEvent.change(screen.getByLabelText('Servicio del recordatorio'), { target: { value: '__otro__' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar recordatorio' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe el servicio');
    expect(agregar).not.toHaveBeenCalled();
  });

  it('si la lista está llena de pendientes: muestra el mensaje', async () => {
    agregar.mockRejectedValueOnce(new Error('Este vehículo ya tiene 10 recordatorios. Borra algunos atendidos.'));
    render(<Recordatorios tallerId="T1" vehiculo={v2} puedeEscribir onGuardado={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar recordatorio' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar recordatorio' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('ya tiene 10 recordatorios');
  });
});
