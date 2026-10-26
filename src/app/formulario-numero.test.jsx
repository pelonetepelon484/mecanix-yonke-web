// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// AlertaUnPaso en modo número (config/pedidosClientes.formularioAbierto, en los 4 casos sin
// resultado): sin la palabra "alerta" (salvo en la casilla y el consentimiento aprobados, que no
// cambian), sin promesas de aviso, "📲 Enviar" y su propia confirmación. Sin el modo, igual que hoy.
vi.mock('./lib/banderaPedidosClientes', () => ({
  leerBanderaAlertaUnPaso: async () => true,
  leerBanderaOtrosEstados: async () => true,
  leerBanderaPedidosClientes: async () => true,
}));
vi.mock('./lib/estados', () => ({ ESTADO_DEFAULT: 'baja-california', cargarEstados: vi.fn(async () => []) }));
vi.mock('./lib/SelectorMarcaModelo', () => ({ default: () => null }));

const {
  default: AlertaUnPaso, TITULO_SIN_RESULTADOS, TEXTO_MODO_NUMERO, TEXTO_ENVIAR_NUMERO, TEXTO_NUNCA_VEN_NUMERO, TEXTO_CONFIRMACION_NUMERO,
} = await import('./AlertaUnPaso.js');
const { TEXTO_BOTON_ALERTA, TEXTO_CASILLA_OTROS_ESTADOS, TEXTO_CONSENTIMIENTO_OTROS_ESTADOS } = await import('./AvisarYonkes.js');

const ESTADOS = [{ id: 'sonora', nombre: 'Sonora' }];
const completo = { marca: 'Nissan', modelo: 'Sentra', anio: '2005', pieza: 'Alternador', estado: 'sonora', estados: ESTADOS };
const ENLACE = 'https://mecanixyonkevirtual.com/mi-pedido/Pedido00000000000001?c=abc';
const LINEA_VIEJA = 'Tu WhatsApp solo lo usa Mecanix para avisarte y no se comparte con los yonkes.';

afterEach(() => { cleanup(); delete global.fetch; });

// Texto visible sin la casilla ni el consentimiento (aprobados por el abogado; no cambian).
const textoSinLegales = (container) => container.textContent
  .replace(TEXTO_CASILLA_OTROS_ESTADOS, '').replace(TEXTO_CONSENTIMIENTO_OTROS_ESTADOS, '');

async function abrir(props) {
  const r = render(<AlertaUnPaso variante="protagonista" {...completo} abiertoDeEntrada modoNumero {...props} />);
  await act(async () => {});
  return r;
}

describe('modo número (bandera encendida)', () => {
  it('encima solo el texto nuevo; sin "alerta", sin el botón naranja, sin "Cancelar"', async () => {
    const { container } = await abrir();
    expect(screen.getByText(TEXTO_MODO_NUMERO)).toBeInTheDocument();
    expect(screen.queryByText(TITULO_SIN_RESULTADOS)).not.toBeInTheDocument();
    expect(screen.queryByText(TEXTO_BOTON_ALERTA)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
    expect(textoSinLegales(container)).not.toMatch(/alerta/i);
    expect(container.textContent).not.toMatch(/te avisamos|avisarte/i);
  });

  it('"📲 Enviar" y "Nunca ven tu número de WhatsApp."; WhatsApp, casilla, consentimiento y "Al enviar aceptas…" igual', async () => {
    await abrir();
    expect(screen.getByRole('button', { name: TEXTO_ENVIAR_NUMERO })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '🚨 Enviar alerta' })).not.toBeInTheDocument();
    expect(screen.getByText(TEXTO_NUNCA_VEN_NUMERO)).toBeInTheDocument();
    expect(screen.queryByText(LINEA_VIEJA, { exact: false })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Tu WhatsApp')).toBeInTheDocument();
    expect(screen.getByText(TEXTO_CASILLA_OTROS_ESTADOS)).toBeInTheDocument();
    expect(screen.getByText(TEXTO_CONSENTIMIENTO_OTROS_ESTADOS)).toBeInTheDocument();
    expect(screen.getByText(/Al enviar aceptas los/)).toHaveTextContent('Al enviar aceptas los términos y el aviso de privacidad.');
  });

  it('"Lo encontramos en otros estados": conserva ese título y pone debajo el texto nuevo (no el viejo)', async () => {
    const { container } = await abrir({ titulo: 'Lo encontramos en otros estados', texto: 'Texto viejo con alerta' });
    const titulo = screen.getByText('Lo encontramos en otros estados');
    const nuevo = screen.getByText(TEXTO_MODO_NUMERO);
    expect(titulo.compareDocumentPosition(nuevo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText('Texto viejo con alerta')).not.toBeInTheDocument();
    expect(textoSinLegales(container)).not.toMatch(/alerta/i);
  });

  it('confirmación: el texto nuevo, el enlace y "Guardar mi enlace por WhatsApp"; sin "alerta" ni "la ven"', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, enlace: ENLACE }) }));
    const { container } = await abrir();
    fireEvent.change(screen.getByLabelText('Tu WhatsApp'), { target: { value: '6641234567' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: TEXTO_ENVIAR_NUMERO })); });
    expect(screen.getByText(TEXTO_CONFIRMACION_NUMERO)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: ENLACE })).toHaveAttribute('href', ENLACE);
    expect(screen.getByRole('link', { name: /Guardar mi enlace por WhatsApp/ })).toBeInTheDocument();
    expect(screen.queryByText('Ver mi alerta')).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/alerta|la ven|la pueden ver|te avisamos|avisarte/i);
  });
});

describe('sin el modo número (bandera apagada): igual que hoy', () => {
  it('formulario abierto con los textos de siempre', async () => {
    render(<AlertaUnPaso variante="protagonista" {...completo} abiertoDeEntrada />);
    await act(async () => {});
    expect(screen.getByText(TITULO_SIN_RESULTADOS)).toBeInTheDocument();
    expect(screen.getByText(TEXTO_BOTON_ALERTA)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '🚨 Enviar alerta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(screen.getByText(LINEA_VIEJA, { exact: false })).toBeInTheDocument();
    expect(screen.queryByText(TEXTO_MODO_NUMERO)).not.toBeInTheDocument();
  });

  it('confirmación de siempre', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, enlace: ENLACE }) }));
    render(<AlertaUnPaso variante="protagonista" {...completo} abiertoDeEntrada />);
    await act(async () => {});
    fireEvent.change(screen.getByLabelText('Tu WhatsApp'), { target: { value: '6641234567' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '🚨 Enviar alerta' })); });
    expect(screen.getByText('Ver mi alerta')).toBeInTheDocument();
    expect(screen.queryByText(TEXTO_CONFIRMACION_NUMERO)).not.toBeInTheDocument();
  });
});
