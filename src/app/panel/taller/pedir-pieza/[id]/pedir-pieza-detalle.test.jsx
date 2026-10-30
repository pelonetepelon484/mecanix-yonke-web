// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const push = vi.fn();
const elegirYonke = vi.fn(async () => {});
const cancelarSolicitud = vi.fn(async () => {});
let solicitudActual = null;
let respuestasActuales = [];

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), useParams: () => ({ id: 'S1' }) }));
vi.mock('../datos', () => ({
  leerSolicitud: vi.fn(async () => solicitudActual),
  escucharRespuestas: (id, cb) => { cb(respuestasActuales); return () => {}; },
  elegirYonke: (...args) => elegirYonke(...args),
  cancelarSolicitud: (...args) => cancelarSolicitud(...args),
  leerWhatsappYonke: vi.fn(async () => '6649999999'),
}));

const { default: SolicitudPiezaDetalle } = await import('./page.js');

afterEach(() => { cleanup(); elegirYonke.mockClear(); cancelarSolicitud.mockClear(); push.mockClear(); vi.restoreAllMocks(); });

function solicitud(extra = {}) {
  return { id: 'S1', pieza: 'Defensa', vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 }, nota: '', estadoSolicitud: 'abierta', yonkeElegido: null, ...extra };
}

describe('Detalle de un pedido de pieza (taller)', () => {
  it('solicitud abierta sin respuestas: no hay botón Elegir, sí Cancelar', async () => {
    solicitudActual = solicitud();
    respuestasActuales = [];
    render(<SolicitudPiezaDetalle />);
    expect(await screen.findByText('Defensa')).toBeInTheDocument();
    expect(screen.getByText('Todavía no hay respuestas.')).toBeInTheDocument();
    expect(screen.getByText('Cancelar pedido')).toBeInTheDocument();
    expect(screen.queryByText('Elegir')).not.toBeInTheDocument();
  });

  it('respuesta "la tengo" muestra el botón Elegir; "no la tengo" no', async () => {
    solicitudActual = solicitud();
    respuestasActuales = [
      { yonkeId: 'Y1', yonkeNombre: 'Yonke Uno', tieneLaPieza: true, precio: 500, nota: '' },
      { yonkeId: 'Y2', yonkeNombre: 'Yonke Dos', tieneLaPieza: false, nota: '' },
    ];
    render(<SolicitudPiezaDetalle />);
    expect(await screen.findByText('Yonke Uno')).toBeInTheDocument();
    expect(screen.getByText(/La tiene — \$500/)).toBeInTheDocument();
    expect(screen.getByText('No la tiene')).toBeInTheDocument();
    expect(screen.getAllByText('Elegir')).toHaveLength(1);
  });

  it('elegir llama a elegirYonke con el id del yonke', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    solicitudActual = solicitud();
    respuestasActuales = [{ yonkeId: 'Y1', yonkeNombre: 'Yonke Uno', tieneLaPieza: true, precio: 500, nota: '' }];
    render(<SolicitudPiezaDetalle />);
    fireEvent.click(await screen.findByText('Elegir'));
    await waitFor(() => expect(elegirYonke).toHaveBeenCalledWith('S1', 'Y1'));
  });

  it('cerrada: no se puede elegir ni cancelar; se ve el WhatsApp del elegido', async () => {
    solicitudActual = solicitud({ estadoSolicitud: 'cerrada', yonkeElegido: 'Y1' });
    respuestasActuales = [{ yonkeId: 'Y1', yonkeNombre: 'Yonke Uno', tieneLaPieza: true, precio: 500, nota: '' }];
    render(<SolicitudPiezaDetalle />);
    expect(await screen.findByText(/WhatsApp: 6649999999/)).toBeInTheDocument();
    expect(screen.queryByText('Elegir')).not.toBeInTheDocument();
    expect(screen.queryByText('Cancelar pedido')).not.toBeInTheDocument();
  });

  it('cancelar llama a cancelarSolicitud', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    solicitudActual = solicitud();
    respuestasActuales = [];
    render(<SolicitudPiezaDetalle />);
    fireEvent.click(await screen.findByText('Cancelar pedido'));
    await waitFor(() => expect(cancelarSolicitud).toHaveBeenCalledWith('S1'));
  });

  it('solicitud inexistente muestra el aviso de "ya no existe"', async () => {
    solicitudActual = null;
    respuestasActuales = [];
    render(<SolicitudPiezaDetalle />);
    expect(await screen.findByText('Este pedido ya no existe.')).toBeInTheDocument();
  });
});

describe('Detalle de un pedido de pieza (taller): precio a tratar', () => {
  it('sugerida por Mecanix: "Precio a tratar", la etiqueta, y se puede elegir', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    solicitudActual = solicitud();
    respuestasActuales = [{ yonkeId: 'Y5', yonkeNombre: 'Yonke Sugerido', tieneLaPieza: true, precioATratar: true, creadoPorAdmin: true, nota: '' }];
    render(<SolicitudPiezaDetalle />);
    expect(await screen.findByText('La tiene — Precio a tratar')).toBeInTheDocument();
    expect(screen.getByText('Confirmado por Mecanix')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/NaN|\$0\b/);
    fireEvent.click(screen.getByText('Elegir'));
    await waitFor(() => expect(elegirYonke).toHaveBeenCalledWith('S1', 'Y5'));
  });

  it('respuesta del yonke sin precio válido (por cualquier motivo): "Precio a tratar", nunca "$NaN"', async () => {
    solicitudActual = solicitud();
    respuestasActuales = [{ yonkeId: 'Y1', yonkeNombre: 'Yonke Uno', tieneLaPieza: true, nota: '' }];
    render(<SolicitudPiezaDetalle />);
    expect(await screen.findByText('La tiene — Precio a tratar')).toBeInTheDocument();
    expect(screen.queryByText('Confirmado por Mecanix')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/NaN/);
  });
});
