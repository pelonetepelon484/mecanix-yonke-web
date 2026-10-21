// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const push = vi.fn();
let config = { habilitado: true };
let yaEsta = null;
const agregar = vi.fn(async () => 'V9');
const agregarRec = vi.fn(async () => []);
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('../historial/datos', () => ({
  leerConfigHistorial: async () => config,
  ordenEnHistorial: async () => yaEsta,
  agregarOrdenAlHistorial: (...a) => agregar(...a),
  agregarRecordatorios: (...a) => agregarRec(...a),
}));

const { default: AgregarAlHistorial } = await import('./AgregarAlHistorial.js');
const enDias = (n) => new Date(Date.now() + n * 86400000);
const PREMIUM = { plan: 'premium', premiumHasta: enDias(30) };
const entregada = (vehiculo = {}) => ({ estado: 'entregado', fechaEntrega: 'ENTREGA', vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001, placas: 'abc 123', ...vehiculo } });
const props = (extra = {}) => ({ tallerId: 'T1', taller: PREMIUM, folio: 'O1', orden: entregada(), puedeEditar: true, ...extra });

afterEach(() => { cleanup(); config = { habilitado: true }; yaEsta = null; agregar.mockClear(); agregarRec.mockClear(); push.mockClear(); });

async function dibujar(p) {
  const r = render(<AgregarAlHistorial {...p} />);
  await act(async () => {});
  return r;
}

describe('"Agregar al historial" (debajo de "Descargar PDF")', () => {
  it.each([
    ['orden sin entregar', { orden: { ...entregada(), estado: 'listo' } }],
    ['sin poder editar (términos viejos o taller desactivado)', { puedeEditar: false }],
    ['sin Premium', { taller: { plan: 'freemium' } }],
    ['con Premium vencido', { taller: { plan: 'premium', premiumHasta: enDias(-1) } }],
  ])('no aparece: %s', async (_, extra) => {
    const { container } = await dibujar(props(extra));
    expect(container).toBeEmptyDOMElement();
  });

  it('no aparece sin config/historialTaller o con habilitado false', async () => {
    config = null;
    expect((await dibujar(props())).container).toBeEmptyDOMElement();
    cleanup();
    config = { habilitado: false };
    expect((await dibujar(props())).container).toBeEmptyDOMElement();
  });

  it('con todo: muestra las placas de la orden y agrega', async () => {
    await dibujar(props());
    expect(screen.getByText('ABC123')).toBeInTheDocument();
    expect(screen.getByText(/No escribas nombres ni teléfonos de clientes en las descripciones/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar al historial' }));
    await act(async () => {});
    expect(agregar).toHaveBeenCalledWith({ tallerId: 'T1', folio: 'O1', placasEscritas: '' });
    expect(await screen.findByText(/Esta orden ya está en el historial/)).toBeInTheDocument();
  });

  it('orden sin placas: el taller debe escribirlas (obligatorias)', async () => {
    await dibujar(props({ orden: entregada({ placas: undefined }) }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar al historial' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe las placas del vehículo');
    expect(agregar).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Placas del vehículo'), { target: { value: 'xyz 9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar al historial' }));
    await act(async () => {});
    expect(agregar).toHaveBeenCalledWith({ tallerId: 'T1', folio: 'O1', placasEscritas: 'xyz 9' });
  });

  it('si ya está en el historial: lo dice y lleva al vehículo', async () => {
    yaEsta = 'V1';
    await dibujar(props());
    expect(screen.queryByRole('button', { name: 'Agregar al historial' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver en el historial' }));
    expect(push).toHaveBeenCalledWith('/panel/taller/historial/V1');
  });

  it('un error de guardado se muestra en español', async () => {
    agregar.mockRejectedValueOnce(new Error('No pudimos agregar la orden al historial. Revisa tu conexión e intenta de nuevo.'));
    await dibujar(props());
    fireEvent.click(screen.getByRole('button', { name: 'Agregar al historial' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos agregar la orden al historial');
  });
});

describe('recordatorios al agregar (etapa 3)', () => {
  it('sin marcar nada: no crea recordatorios', async () => {
    await dibujar(props());
    fireEvent.click(screen.getByRole('button', { name: 'Agregar al historial' }));
    await act(async () => {});
    expect(agregarRec).not.toHaveBeenCalled();
  });
  it('servicios periódicos marcados (intervalo editable) y uno propio', async () => {
    await dibujar(props());
    fireEvent.click(screen.getByLabelText(/Cambio de aceite/));
    fireEvent.change(screen.getByLabelText('Meses para Cambio de aceite'), { target: { value: '4' } });
    fireEvent.click(screen.getByLabelText(/Batería/));
    fireEvent.change(screen.getByLabelText('Otro servicio'), { target: { value: 'Clima' } });
    fireEvent.change(screen.getByLabelText('Meses del otro servicio'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar al historial' }));
    await act(async () => {});
    expect(agregarRec).toHaveBeenCalledWith('T1', 'V9', [
      { tipo: 'Cambio de aceite', meses: 4 }, { tipo: 'Batería', meses: 24 }, { tipo: 'Clima', meses: 12 },
    ], { fechaEntrega: 'ENTREGA', folio: 'O1' });
  });
  it('meses inválidos: mensaje y no agrega nada', async () => {
    await dibujar(props());
    fireEvent.change(screen.getByLabelText('Otro servicio'), { target: { value: 'Clima' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar al historial' }));
    expect(screen.getByRole('alert')).toHaveTextContent('1 a 120 meses');
    expect(agregar).not.toHaveBeenCalled();
  });
  it('si fallan los recordatorios: el servicio sí queda y se avisa', async () => {
    agregarRec.mockRejectedValueOnce(new Error('sin conexión'));
    await dibujar(props());
    fireEvent.click(screen.getByLabelText(/Frenos/));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar al historial' }));
    await act(async () => {});
    expect(screen.getByText(/Esta orden ya está en el historial/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Se agregó al historial, pero no pudimos guardar los recordatorios');
  });
});
