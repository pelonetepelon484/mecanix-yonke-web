// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

let unPaso = true;
let otros = false;
vi.mock('./lib/banderaPedidosClientes', () => ({
  leerBanderaAlertaUnPaso: async () => unPaso,
  leerBanderaOtrosEstados: async () => otros,
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

const { default: AlertaUnPaso, TITULO_SIN_RESULTADOS, TEXTO_DISCRETO, TEXTO_COMPACTO } = await import('./AlertaUnPaso.js');
const { TEXTO_BOTON_ALERTA, TEXTO_CASILLA_OTROS_ESTADOS, TEXTO_CONSENTIMIENTO_OTROS_ESTADOS } = await import('./AvisarYonkes.js');

const ESTADOS = [{ id: 'baja-california', nombre: 'Baja California' }, { id: 'sonora', nombre: 'Sonora' }];
const ENLACE = 'https://mecanixyonkevirtual.com/mi-pedido/Pedido00000000000001?c=abc';
const completo = { marca: 'Nissan', modelo: 'Sentra', anio: '2005', pieza: 'Alternador', estado: 'sonora', estados: ESTADOS };

afterEach(() => { cleanup(); unPaso = true; otros = false; delete global.fetch; });

describe('alerta en un paso', () => {
  it('bandera apagada: no muestra nada', async () => {
    unPaso = false;
    const { container } = render(<AlertaUnPaso {...completo} />);
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
  });

  it('caso a con otros estados: cambian SOLO el título y el texto; el botón y el formulario son los mismos', async () => {
    otros = true;
    render(<AlertaUnPaso {...completo} titulo="Lo encontramos en otros estados" texto="No hay yonkes de Sonora con ese vehículo, pero abajo ves los de otros estados. ¿Lo quieres solo en tu estado? Activa la alerta de búsqueda." />);
    expect(await screen.findByText('Lo encontramos en otros estados')).toBeInTheDocument();
    expect(screen.getByText(/No hay yonkes de Sonora con ese vehículo/)).toBeInTheDocument();
    expect(screen.queryByText(TITULO_SIN_RESULTADOS)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: TEXTO_BOTON_ALERTA }));
    // El formulario de siempre, con su casilla y su consentimiento.
    expect(await screen.findByLabelText(TEXTO_CASILLA_OTROS_ESTADOS)).toBeChecked();
    expect(screen.getByText(TEXTO_CONSENTIMIENTO_OTROS_ESTADOS)).toBeInTheDocument();
  });

  it('sin resultados: título, texto con el estado real y el botón de siempre (más grande)', async () => {
    render(<AlertaUnPaso {...completo} />);
    expect(await screen.findByText(TITULO_SIN_RESULTADOS)).toBeInTheDocument();
    expect(screen.getByText('Crea una alerta: los yonkes de Sonora la verán y te responderán con su precio.')).toBeInTheDocument();
    const boton = screen.getByRole('button', { name: TEXTO_BOTON_ALERTA });
    expect(TEXTO_BOTON_ALERTA).toBe('🚨 Activar alerta de búsqueda 🚨');
    expect(boton.style.fontSize).toBe('clamp(12px, 3.7vw, 18px)');
  });

  it('un paso: todo prellenado, solo pide WhatsApp; crea la misma alerta y confirma con el enlace (sin "te contactaremos")', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, enlace: ENLACE }) }));
    render(<AlertaUnPaso {...completo} />);
    fireEvent.click(await screen.findByRole('button', { name: TEXTO_BOTON_ALERTA }));
    expect(screen.getByText('🚗 Nissan Sentra 2005')).toBeInTheDocument();
    expect(screen.getByText('🔧 Alternador')).toBeInTheDocument();
    expect(screen.getByText('📍 Sonora')).toBeInTheDocument();
    for (const etiqueta of ['Marca', 'Año', 'Pieza que buscas', '¿En qué estado la buscas?']) expect(screen.queryByLabelText(etiqueta)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Tu WhatsApp'), { target: { value: '664 123 4567' } });
    fireEvent.click(screen.getByRole('button', { name: '🚨 Enviar alerta' }));
    expect(await screen.findByText('✅ Listo, los yonkes de Sonora ya pueden ver tu búsqueda. Aquí verás sus respuestas:')).toBeInTheDocument();
    const [url, opciones] = global.fetch.mock.calls[0];
    expect(url).toBe('/api/pedir-pieza');
    expect(JSON.parse(opciones.body)).toEqual({ vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2005 }, pieza: 'Alternador', estado: 'sonora', whatsapp: '664 123 4567' });
    expect(screen.getByText(ENLACE)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '💬 Guardar mi enlace por WhatsApp' })).toHaveAttribute('href', expect.stringContaining('https://wa.me/526641234567'));
    expect(document.body.textContent).not.toMatch(/contactaremos|crear una cuenta/i);
  });

  it('WhatsApp inválido: no envía y explica', async () => {
    global.fetch = vi.fn();
    render(<AlertaUnPaso {...completo} />);
    fireEvent.click(await screen.findByRole('button', { name: TEXTO_BOTON_ALERTA }));
    fireEvent.change(screen.getByLabelText('Tu WhatsApp'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: '🚨 Enviar alerta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Escribe tu WhatsApp a 10 dígitos');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('estado desconocido ("Todos los estados"): lo pide, sin elegir uno por su cuenta', async () => {
    global.fetch = vi.fn();
    render(<AlertaUnPaso {...completo} estado="todos" />);
    expect(await screen.findByText('Crea una alerta: los yonkes de tu estado la verán y te responderán con su precio.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: TEXTO_BOTON_ALERTA }));
    expect(screen.getByLabelText('¿En qué estado la buscas?')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('Tu WhatsApp'), { target: { value: '6641234567' } });
    fireEvent.click(screen.getByRole('button', { name: '🚨 Enviar alerta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Elige el estado donde buscas la pieza.');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('pide solo lo que falta: sin pieza, el campo de pieza; sin vehículo completo, marca/modelo/año', async () => {
    render(<AlertaUnPaso {...completo} pieza="" />);
    fireEvent.click(await screen.findByRole('button', { name: TEXTO_BOTON_ALERTA }));
    expect(screen.getByLabelText('Pieza que buscas')).toBeInTheDocument();
    expect(screen.queryByLabelText('Marca')).not.toBeInTheDocument();
    cleanup();
    render(<AlertaUnPaso {...completo} anio="" />);
    fireEvent.click(await screen.findByRole('button', { name: TEXTO_BOTON_ALERTA }));
    expect(screen.getByLabelText('Marca')).toHaveValue('Nissan');
    expect(screen.getByLabelText('Año')).toHaveValue(null);
    expect(screen.queryByLabelText('Pieza que buscas')).not.toBeInTheDocument();
  });

  it('"Corregir" muestra los datos prellenados para cambiarlos', async () => {
    render(<AlertaUnPaso {...completo} />);
    fireEvent.click(await screen.findByRole('button', { name: TEXTO_BOTON_ALERTA }));
    fireEvent.click(screen.getByRole('button', { name: 'Corregir' }));
    expect(screen.getByLabelText('Pieza que buscas')).toHaveValue('Alternador');
    expect(screen.getByLabelText('¿En qué estado la buscas?')).toHaveValue('sonora');
  });

  it('con resultados (discreta): "¿No encontraste la pieza exacta? Crea una alerta" abre el mismo paso', async () => {
    render(<AlertaUnPaso {...completo} variante="discreta" />);
    fireEvent.click(await screen.findByRole('button', { name: `🔔 ${TEXTO_DISCRETO}` }));
    expect(screen.getByLabelText('Tu WhatsApp')).toBeInTheDocument();
    expect(screen.queryByText(TITULO_SIN_RESULTADOS)).not.toBeInTheDocument();
  });

  it('con la casilla de otros estados encendida: nace MARCADA y va en la alerta', async () => {
    otros = true;
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, enlace: ENLACE }) }));
    render(<AlertaUnPaso {...completo} />);
    fireEvent.click(await screen.findByRole('button', { name: TEXTO_BOTON_ALERTA }));
    expect(await screen.findByLabelText(TEXTO_CASILLA_OTROS_ESTADOS)).toBeChecked();
    // Consentimiento: visible debajo de la casilla y antes del botón de enviar.
    const consentimiento = screen.getByText(TEXTO_CONSENTIMIENTO_OTROS_ESTADOS);
    expect(screen.getByLabelText(TEXTO_CASILLA_OTROS_ESTADOS).compareDocumentPosition(consentimiento) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(consentimiento.compareDocumentPosition(screen.getByRole('button', { name: '🚨 Enviar alerta' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Tu WhatsApp'), { target: { value: '6641234567' } });
    fireEvent.click(screen.getByRole('button', { name: '🚨 Enviar alerta' }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).aceptaOtrosEstados).toBe(true);
  });
  it('si el cliente la desmarca, la alerta va solo a su estado (aceptaOtrosEstados false, como hoy)', async () => {
    otros = true;
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, enlace: ENLACE }) }));
    render(<AlertaUnPaso {...completo} />);
    fireEvent.click(await screen.findByRole('button', { name: TEXTO_BOTON_ALERTA }));
    fireEvent.click(await screen.findByLabelText(TEXTO_CASILLA_OTROS_ESTADOS));
    fireEvent.change(screen.getByLabelText('Tu WhatsApp'), { target: { value: '6641234567' } });
    fireEvent.click(screen.getByRole('button', { name: '🚨 Enviar alerta' }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).aceptaOtrosEstados).toBe(false);
  });
});

describe('alerta compacta (config/pedidosClientes.alertaSiempre)', () => {
  it('texto pedido y, al tocarla, el mismo formulario de siempre', async () => {
    render(<AlertaUnPaso variante="compacta" {...completo} />);
    const boton = await screen.findByRole('button', { name: `🔔 ${TEXTO_COMPACTO}` });
    expect(TEXTO_COMPACTO).toBe('¿No era lo que buscabas? Crea una alerta aquí');
    expect(screen.queryByText(TITULO_SIN_RESULTADOS)).not.toBeInTheDocument();
    expect(screen.queryByText(TEXTO_DISCRETO, { exact: false })).not.toBeInTheDocument();
    fireEvent.click(boton);
    expect(screen.getByLabelText('Tu WhatsApp')).toBeInTheDocument();
  });

  it('sin la bandera alertaUnPaso: no muestra nada', async () => {
    unPaso = false;
    const { container } = render(<AlertaUnPaso variante="compacta" {...completo} />);
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
  });
});
