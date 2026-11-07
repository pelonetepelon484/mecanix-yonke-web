// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// "Convertir en orden" desde una cita: /panel/taller/ordenes/nueva?cita=ID llena el formulario con
// la cita y, al guardar, marca la cita como atendida. Sin ?cita, la orden nueva queda como antes.
const replace = vi.fn();
const push = vi.fn();
let configOrdenes = { habilitado: true };
let cita = { id: 'C1', nombre: 'Juan Pérez', telefono: '6641234567', vehiculo: 'Nissan Versa 2018', placas: 'ABC123', motivo: 'Frenos' };
let props = null;
const guardarOrden = vi.fn(async () => 'O123');
const cambiarEstadoCita = vi.fn(async () => {});
const leerCita = vi.fn(async () => cita);

vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }));
vi.mock('./contexto', () => ({ useOrdenes: () => ({ tallerId: 'T1', taller: { activo: true }, puedeEditar: true, avisoVersion: 'aviso-orden-2', configOrdenes }) }));
vi.mock('./datos', () => ({ guardarOrden: (...a) => guardarOrden(...a) }));
vi.mock('../citas/datos', () => ({ leerCita: (...a) => leerCita(...a), cambiarEstadoCita: (...a) => cambiarEstadoCita(...a) }));
vi.mock('./OrdenForm', () => ({ default: (p) => { props = p; return <p>formulario</p>; } }));
vi.mock('../../../../lib/avisoOrden', () => ({ datosClienteDisponibles: (c) => c?.datosClienteHabilitados === true, ordenConSeguimiento: () => false }));

const { default: NuevaOrden } = await import('./nueva/page.js');
const irA = (q) => window.history.replaceState({}, '', `/panel/taller/ordenes/nueva${q}`);

afterEach(() => {
  cleanup(); props = null; irA('');
  [replace, push, guardarOrden, cambiarEstadoCita, leerCita].forEach((f) => f.mockClear());
  configOrdenes = { habilitado: true };
});

describe('orden nueva desde una cita', () => {
  it('sin ?cita: como siempre, sin leer citas', async () => {
    render(<NuevaOrden />);
    expect(await screen.findByText('formulario')).toBeInTheDocument();
    expect(props.prellenado).toBeNull();
    expect(leerCita).not.toHaveBeenCalled();
    await props.onGuardar({});
    expect(cambiarEstadoCita).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/panel/taller/ordenes/O123');
  });
  it('con ?cita y datos del cliente: llena todo y al guardar marca la cita atendida', async () => {
    configOrdenes = { habilitado: true, datosClienteHabilitados: true };
    irA('?cita=C1');
    render(<NuevaOrden />);
    expect(await screen.findByText(/Datos tomados de la cita de Juan Pérez/)).toBeInTheDocument();
    expect(leerCita).toHaveBeenCalledWith('T1', 'C1');
    expect(props.prellenado).toEqual({
      cliente: { nombre: 'Juan Pérez', telefono: '6641234567' },
      vehiculo: { marca: 'Nissan', modelo: 'Versa', anio: 2018, placas: 'ABC123' },
      fallaReportada: 'Frenos',
    });
    await props.onGuardar({});
    expect(cambiarEstadoCita).toHaveBeenCalledWith({ tallerId: 'T1', id: 'C1', estado: 'atendida' });
    expect(replace).toHaveBeenCalledWith('/panel/taller/ordenes/O123');
  });
  it('sin datos del cliente: solo vehículo y falla; si no se puede marcar la cita, la orden queda igual', async () => {
    irA('?cita=C1');
    cambiarEstadoCita.mockRejectedValueOnce(new Error('permission-denied'));
    render(<NuevaOrden />);
    await waitFor(() => expect(props?.prellenado).toBeTruthy());
    expect(props.prellenado.cliente).toEqual({});
    expect(props.prellenado.vehiculo).not.toHaveProperty('placas');
    await props.onGuardar({});
    expect(replace).toHaveBeenCalledWith('/panel/taller/ordenes/O123');
  });
});
