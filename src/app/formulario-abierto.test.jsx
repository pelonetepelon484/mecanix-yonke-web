// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Opción abiertoDeEntrada (config/pedidosClientes.formularioAbierto): el formulario de la alerta sale
// abierto, sin tocar el botón. Mismo formulario, mismos textos.
vi.mock('./lib/banderaPedidosClientes', () => ({
  leerBanderaFormularioAbierto: async () => false, // config/pedidosClientes.formularioAbierto apagada: igual que hoy
  leerBanderaAlertaUnPaso: async () => true,
  leerBanderaOtrosEstados: async () => true,
  leerBanderaPedidosClientes: async () => true,
}));
vi.mock('./lib/estados', () => ({ ESTADO_DEFAULT: 'baja-california', cargarEstados: vi.fn(async () => [{ id: 'baja-california', nombre: 'Baja California' }]) }));
vi.mock('./lib/SelectorMarcaModelo', () => ({
  default: ({ marca, modelo, onMarca, onModelo }) => (
    <>
      <input aria-label="Marca" value={marca} onChange={(e) => onMarca(e.target.value)} />
      <input aria-label="Modelo" value={modelo} onChange={(e) => onModelo(e.target.value)} />
    </>
  ),
}));

const { default: AlertaUnPaso, TITULO_SIN_RESULTADOS, textoSinResultados } = await import('./AlertaUnPaso.js');
const { default: AvisarYonkes, TEXTO_BOTON_ALERTA, TEXTO_CASILLA_OTROS_ESTADOS, TEXTO_CONSENTIMIENTO_OTROS_ESTADOS } = await import('./AvisarYonkes.js');

const ESTADOS = [{ id: 'baja-california', nombre: 'Baja California' }, { id: 'sonora', nombre: 'Sonora' }];
const completo = { marca: 'Nissan', modelo: 'Sentra', anio: '2005', pieza: 'Alternador', estado: 'sonora', estados: ESTADOS };

afterEach(() => { cleanup(); });

// Lo que el formulario abierto siempre debe tener, igual que hoy al tocar el botón.
function esperarFormularioCompleto() {
  expect(screen.getByLabelText('Tu WhatsApp')).toBeInTheDocument();
  expect(screen.getByText(TEXTO_CASILLA_OTROS_ESTADOS)).toBeInTheDocument();
  expect(screen.getByText(TEXTO_CONSENTIMIENTO_OTROS_ESTADOS)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '🚨 Enviar alerta' })).toBeInTheDocument();
  expect(screen.getByText(/Al enviar aceptas los/)).toHaveTextContent('Al enviar aceptas los términos y el aviso de privacidad.');
  expect(screen.getByRole('link', { name: 'términos' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'aviso de privacidad' })).toBeInTheDocument();
}

describe('AlertaUnPaso con abiertoDeEntrada', () => {
  it('protagonista: sale abierta, con su título y su texto encima del formulario (sin el botón)', async () => {
    render(<AlertaUnPaso {...completo} abiertoDeEntrada />);
    await act(async () => {});
    expect(screen.getByText(TITULO_SIN_RESULTADOS)).toBeInTheDocument();
    expect(screen.getByText(textoSinResultados('Sonora'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TEXTO_BOTON_ALERTA })).not.toBeInTheDocument();
    esperarFormularioCompleto();
    // El título del recuadro va antes que el formulario.
    const titulo = screen.getByText(TITULO_SIN_RESULTADOS);
    expect(titulo.compareDocumentPosition(screen.getByLabelText('Tu WhatsApp')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('con el título y el texto de otros estados, esos quedan encima', async () => {
    render(<AlertaUnPaso {...completo} titulo="Lo encontramos en otros estados" texto="Texto de otros estados" abiertoDeEntrada />);
    await act(async () => {});
    expect(screen.getByText('Lo encontramos en otros estados')).toBeInTheDocument();
    expect(screen.getByText('Texto de otros estados')).toBeInTheDocument();
    expect(screen.queryByText(TITULO_SIN_RESULTADOS)).not.toBeInTheDocument();
    esperarFormularioCompleto();
  });

  it('"Cancelar" regresa al recuadro con el botón, como hoy', async () => {
    render(<AlertaUnPaso {...completo} abiertoDeEntrada />);
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('button', { name: TEXTO_BOTON_ALERTA })).toBeInTheDocument();
    expect(screen.queryByLabelText('Tu WhatsApp')).not.toBeInTheDocument();
  });

  it('sin la opción: cerrada, con el botón, igual que hoy', async () => {
    render(<AlertaUnPaso {...completo} />);
    await act(async () => {});
    expect(screen.getByRole('button', { name: TEXTO_BOTON_ALERTA })).toBeInTheDocument();
    expect(screen.queryByLabelText('Tu WhatsApp')).not.toBeInTheDocument();
  });
});

describe('AvisarYonkes con abiertoDeEntrada', () => {
  it('sale abierto con el mismo formulario; sin la opción, cerrado como hoy', async () => {
    render(<AvisarYonkes abiertoDeEntrada />);
    await act(async () => {});
    esperarFormularioCompleto();
    cleanup();
    render(<AvisarYonkes />);
    await act(async () => {});
    expect(screen.getByRole('button', { name: TEXTO_BOTON_ALERTA })).toBeInTheDocument();
    expect(screen.queryByLabelText('Tu WhatsApp')).not.toBeInTheDocument();
  });
});
