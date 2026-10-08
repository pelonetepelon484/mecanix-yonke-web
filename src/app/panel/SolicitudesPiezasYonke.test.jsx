// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const responder = vi.fn(async () => {});
const leerYonkeEstadoActivo = vi.fn(async () => ({ estado: 'baja-california', activo: true, nombre: 'Yonke Prueba', whatsapp: '6641234567' }));
const leerConfigSolicitudesPiezas = vi.fn(async () => ({ habilitado: true }));
let abiertas = [];
let ganadas = [];
let yaRespondioMock = vi.fn(async () => null);

vi.mock('./solicitudesPiezasDatos', () => ({
  leerYonkeEstadoActivo: (...args) => leerYonkeEstadoActivo(...args),
  leerConfigSolicitudesPiezas: (...args) => leerConfigSolicitudesPiezas(...args),
  escucharSolicitudesAbiertas: (estado, cb) => { cb(abiertas); return () => {}; },
  escucharSolicitudesGanadas: (yonkeId, cb) => { cb(ganadas); return () => {}; },
  yaRespondio: (...args) => yaRespondioMock(...args),
  leerContactoTaller: vi.fn(async () => '6649999999'),
  responder: (...args) => responder(...args),
}));

const { default: SolicitudesPiezasYonke } = await import('./SolicitudesPiezasYonke.js');

afterEach(() => {
  cleanup(); abiertas = []; ganadas = []; responder.mockClear(); yaRespondioMock = vi.fn(async () => null);
  leerYonkeEstadoActivo.mockClear();
  leerConfigSolicitudesPiezas.mockReset();
  leerConfigSolicitudesPiezas.mockResolvedValue({ habilitado: true });
});

describe('Piezas en pedido (lado del yonke)', () => {
  it('no muestra nada si no hay abiertas ni ganadas', async () => {
    render(<SolicitudesPiezasYonke yonkeId="Y1" />);
    await waitFor(() => expect(screen.queryByText(/Piezas en pedido/)).not.toBeInTheDocument());
  });

  it('muestra una solicitud abierta sin responder, con su taller y pieza', async () => {
    abiertas = [{ id: 'S1', pieza: 'Defensa', vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 }, tallerNombre: 'Taller Uno' }];
    render(<SolicitudesPiezasYonke yonkeId="Y1" />);
    expect(await screen.findByText(/Piezas en pedido \(1\)/)).toBeInTheDocument();
    expect(screen.getByText('Defensa')).toBeInTheDocument();
    expect(screen.getByText('Taller: Taller Uno')).toBeInTheDocument();
  });

  it('una solicitud ya respondida no aparece en pendientes', async () => {
    abiertas = [{ id: 'S1', pieza: 'Defensa', vehiculo: { marca: 'N', modelo: 'S', anio: 2001 }, tallerNombre: 'T1' }];
    yaRespondioMock = vi.fn(async () => ({ tieneLaPieza: true }));
    render(<SolicitudesPiezasYonke yonkeId="Y1" />);
    await waitFor(() => expect(screen.queryByText(/Piezas en pedido/)).not.toBeInTheDocument());
  });

  it('responder "la tengo" sin precio muestra error y no llama a responder()', async () => {
    abiertas = [{ id: 'S1', pieza: 'Defensa', vehiculo: { marca: 'N', modelo: 'S', anio: 2001 }, tallerNombre: 'T1' }];
    render(<SolicitudesPiezasYonke yonkeId="Y1" />);
    fireEvent.click(await screen.findByText('Responder'));
    fireEvent.click(screen.getByText('Enviar respuesta'));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(responder).not.toHaveBeenCalled();
  });

  it('responder "la tengo" con precio válido llama a responder() con los datos del yonke', async () => {
    abiertas = [{ id: 'S1', pieza: 'Defensa', vehiculo: { marca: 'N', modelo: 'S', anio: 2001 }, tallerNombre: 'T1' }];
    render(<SolicitudesPiezasYonke yonkeId="Y1" />);
    fireEvent.click(await screen.findByText('Responder'));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '500' } });
    fireEvent.click(screen.getByText('Enviar respuesta'));
    await waitFor(() => expect(responder).toHaveBeenCalledWith('S1', 'Y1', expect.objectContaining({
      tieneLaPieza: true, precio: 500, yonkeNombre: 'Yonke Prueba', whatsapp: '6641234567',
    })));
  });

  it('responder "no la tengo" no exige precio', async () => {
    abiertas = [{ id: 'S1', pieza: 'Defensa', vehiculo: { marca: 'N', modelo: 'S', anio: 2001 }, tallerNombre: 'T1' }];
    render(<SolicitudesPiezasYonke yonkeId="Y1" />);
    fireEvent.click(await screen.findByText('Responder'));
    fireEvent.click(screen.getByText('No la tengo'));
    fireEvent.click(screen.getByText('Enviar respuesta'));
    await waitFor(() => expect(responder).toHaveBeenCalledWith('S1', 'Y1', expect.objectContaining({ tieneLaPieza: false })));
  });

  it('muestra una sección "Te eligieron" con el WhatsApp del taller', async () => {
    ganadas = [{ id: 'S2', pieza: 'Defensa', vehiculo: { marca: 'N', modelo: 'S', anio: 2001 }, tallerNombre: 'Taller Dos' }];
    render(<SolicitudesPiezasYonke yonkeId="Y1" />);
    expect(await screen.findByText(/Te eligieron/)).toBeInTheDocument();
    expect(await screen.findByText(/WhatsApp 6649999999/)).toBeInTheDocument();
  });

  it('yonke inactivo: no muestra nada aunque haya solicitudes abiertas', async () => {
    leerYonkeEstadoActivo.mockResolvedValueOnce({ estado: 'baja-california', activo: false, nombre: '', whatsapp: '' });
    abiertas = [{ id: 'S1', pieza: 'Defensa', vehiculo: { marca: 'N', modelo: 'S', anio: 2001 }, tallerNombre: 'T1' }];
    render(<SolicitudesPiezasYonke yonkeId="Y1" />);
    await waitFor(() => expect(screen.queryByText(/Piezas en pedido/)).not.toBeInTheDocument());
  });

  it('sin config/solicitudesPiezas: no muestra nada y no lee el yonke ni las solicitudes', async () => {
    leerConfigSolicitudesPiezas.mockResolvedValue(null);
    abiertas = [{ id: 'S1', pieza: 'Defensa', vehiculo: { marca: 'N', modelo: 'S', anio: 2001 }, tallerNombre: 'T1' }];
    render(<SolicitudesPiezasYonke yonkeId="Y1" />);
    await waitFor(() => expect(leerConfigSolicitudesPiezas).toHaveBeenCalled());
    expect(screen.queryByText(/Piezas en pedido/)).not.toBeInTheDocument();
    expect(leerYonkeEstadoActivo).not.toHaveBeenCalled();
  });

  it('con habilitado=false: lo mismo', async () => {
    leerConfigSolicitudesPiezas.mockResolvedValue({ habilitado: false });
    render(<SolicitudesPiezasYonke yonkeId="Y1" />);
    await waitFor(() => expect(leerConfigSolicitudesPiezas).toHaveBeenCalled());
    expect(leerYonkeEstadoActivo).not.toHaveBeenCalled();
  });
});
