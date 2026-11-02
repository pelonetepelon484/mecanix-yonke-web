// @vitest-environment jsdom
// Reclamo de número ajeno: desactiva primero, retira sus respuestas una por una, no toca la que el
// taller ya eligió y no ofrece avisar al yonke por ese número.
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const orden = [];
const datos = {
  buscarRespuestasDeYonke: vi.fn(),
  desactivarYonke: vi.fn(async () => { orden.push('desactivar'); }),
  quitarRespuesta: vi.fn(async (_c, id) => { orden.push(id); }),
  leerWhatsappSolicitante: vi.fn(async () => '6649998877'),
  listarYonkesActivosDeEstado: vi.fn(async () => []),
  sugerirYonke: vi.fn(),
};
vi.mock('../../pedidos/datos', () => datos);
const { default: ReclamoNumero } = await import('./ReclamoNumero.js');

const r = { yonkeId: 'Y1', yonkeNombre: 'Yonke', whatsapp: '6641112222' };
const vehiculo = { marca: 'Ford', modelo: 'Focus', anio: 2012 };
const lista = () => [
  { coleccion: 'pedidosClientes', pedido: { id: 'P1', pieza: 'Faro', vehiculo }, respuesta: r },
  { coleccion: 'solicitudesPiezas', pedido: { id: 'S1', pieza: 'Puerta', vehiculo, tallerId: 'T1' }, respuesta: r },
  { coleccion: 'solicitudesPiezas', pedido: { id: 'S2', pieza: 'Motor', vehiculo, tallerId: 'T1', yonkeElegido: 'Y1' }, respuesta: r },
];

beforeEach(() => {
  orden.length = 0;
  vi.clearAllMocks();
  datos.buscarRespuestasDeYonke.mockResolvedValue(lista());
  window.confirm = vi.fn(() => true);
});
afterEach(cleanup);

async function hastaAtender(onDesactivado = () => {}) {
  render(<ReclamoNumero yonkeId="Y1" onDesactivado={onDesactivado} />);
  fireEvent.click(screen.getByRole('button', { name: 'Ver sus respuestas' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Desactivar y retirar respuestas' }));
}

describe('Reclamo de número', () => {
  it('muestra el procedimiento y no busca hasta que se lo pides', () => {
    render(<ReclamoNumero yonkeId="Y1" onDesactivado={() => {}} />);
    expect(screen.getByText(/desde ese número/)).toBeInTheDocument();
    expect(datos.buscarRespuestasDeYonke).not.toHaveBeenCalled();
  });
  it('desactiva primero y retira todas menos la elegida por el taller', async () => {
    const onDesactivado = vi.fn();
    await hastaAtender(onDesactivado);
    expect(await screen.findByText('Cuenta desactivada. Respuestas retiradas: 2.')).toBeInTheDocument();
    expect(orden).toEqual(['desactivar', 'P1', 'S1']);
    expect(onDesactivado).toHaveBeenCalled();
    expect(datos.quitarRespuesta).toHaveBeenCalledWith('pedidosClientes', 'P1', r, 'numeroAjeno');
    expect(screen.getByText(/Motor: el taller ya la eligió/)).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Avisar al cliente' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Avisar al taller' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Avisar al yonke' })).not.toBeInTheDocument();
  });
  it('sin confirmar no hace nada', async () => {
    window.confirm = vi.fn(() => false);
    await hastaAtender();
    expect(datos.desactivarYonke).not.toHaveBeenCalled();
  });
  it('si no se pudo desactivar, no retira nada', async () => {
    datos.desactivarYonke.mockRejectedValueOnce(new Error('x'));
    await hastaAtender();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se retiró ninguna respuesta');
    expect(datos.quitarRespuesta).not.toHaveBeenCalled();
  });
  it('dice cuántas fallaron y deja reintentar solo esas', async () => {
    datos.quitarRespuesta.mockRejectedValueOnce(new Error('x'));
    await hastaAtender();
    expect(await screen.findByRole('alert')).toHaveTextContent('1 respuesta(s) no se pudieron retirar');
    await waitFor(() => expect(datos.quitarRespuesta).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(datos.quitarRespuesta).toHaveBeenCalledTimes(3));
    expect(datos.quitarRespuesta.mock.calls[2][1]).toBe('P1');
  });
});
