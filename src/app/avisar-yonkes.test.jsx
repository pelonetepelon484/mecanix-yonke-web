// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

let config = null;
const getDoc = vi.fn(async () => ({ exists: () => config !== null, data: () => config }));
vi.mock('firebase/firestore', () => ({ doc: (...a) => a.join('/'), getDoc: (...a) => getDoc(...a) }));
vi.mock('./lib/firebase', () => ({ db: 'db' }));
vi.mock('./lib/estados', () => ({
  ESTADO_DEFAULT: 'baja-california',
  cargarEstados: vi.fn(async () => [{ id: 'baja-california', nombre: 'Baja California' }, { id: 'sonora', nombre: 'Sonora' }]),
}));
vi.mock('./lib/SelectorMarcaModelo', () => ({
  default: ({ marca, modelo, onMarca, onModelo }) => (
    <>
      <input aria-label="Marca" value={marca} onChange={(e) => onMarca(e.target.value)} />
      <input aria-label="Modelo" value={modelo} onChange={(e) => onModelo(e.target.value)} />
    </>
  ),
}));

// La bandera se cachea por módulo: cada prueba importa el componente de nuevo.
async function cargar() {
  vi.resetModules();
  return (await import('./AvisarYonkes.js')).default;
}

beforeEach(() => {
  getDoc.mockClear();
  global.fetch = vi.fn();
});
afterEach(() => { cleanup(); config = null; });

describe('"Avisar a los yonkes" en la página principal', () => {
  it('sin config/pedidosClientes no muestra NADA y solo lee la bandera una vez', async () => {
    const AvisarYonkes = await cargar();
    const { container } = render(<AvisarYonkes />);
    await waitFor(() => expect(getDoc).toHaveBeenCalledTimes(1));
    expect(container).toBeEmptyDOMElement();
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it('con habilitado != true tampoco muestra nada', async () => {
    config = { habilitado: 'true' };
    const AvisarYonkes = await cargar();
    const { container } = render(<AvisarYonkes />);
    await waitFor(() => expect(getDoc).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
  it('encendida: botón, formulario con el aviso de privacidad, envío y enlace para guardar por WhatsApp', async () => {
    config = { habilitado: true };
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, id: 'X', enlace: 'https://m.test/mi-pedido/X?c=COD' }) }));
    const AvisarYonkes = await cargar();
    render(<AvisarYonkes marcaInicial="Nissan" modeloInicial="Sentra" anioInicial="2005" piezaInicial="Alternador" estadoInicial="sonora" />);
    fireEvent.click(await screen.findByRole('button', { name: '🚨 Activar alerta de búsqueda 🚨' }));
    expect(screen.getByText(/Tu WhatsApp solo lo usa Mecanix para avisarte y no se comparte con los yonkes\./)).toBeInTheDocument();
    expect(screen.getByText(/Al enviar aceptas los/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'términos' })).toHaveAttribute('href', 'https://mecanixyonkevirtual.com/terminos');
    expect(screen.getByRole('link', { name: 'aviso de privacidad' })).toHaveAttribute('href', 'https://mecanixyonkevirtual.com/privacidad#pedidos-clientes');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('¿En qué estado la buscas?')).toHaveValue('sonora'));
    // "Cancelar" y "🚨 Enviar alerta" lado a lado, cada uno en una sola línea (cabe en celular de 320 px).
    for (const nombre of ['Cancelar', '🚨 Enviar alerta']) {
      const b = screen.getByRole('button', { name: nombre });
      expect(b.style.whiteSpace).toBe('nowrap');
      expect(b.style.fontSize).toBe('clamp(12px, 3.7vw, 14px)');
    }
    expect(screen.queryByRole('button', { name: 'Enviar pedido' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Tu WhatsApp'), { target: { value: '664 123 4567' } });
    fireEvent.click(screen.getByRole('button', { name: '🚨 Enviar alerta' }));

    expect(await screen.findByText('✅ ¡Listo! Tu alerta de búsqueda ya está activa. Los yonkes de Sonora la ven en su panel.')).toBeInTheDocument();
    const [url, opciones] = global.fetch.mock.calls[0];
    expect(url).toBe('/api/pedir-pieza');
    expect(JSON.parse(opciones.body)).toEqual({
      vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2005 }, pieza: 'Alternador', estado: 'sonora', whatsapp: '664 123 4567',
    });
    const guardar = screen.getByRole('link', { name: /Guardar mi enlace por WhatsApp/ });
    expect(guardar.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/526641234567\?text=/);
    expect(decodeURIComponent(guardar.getAttribute('href'))).toContain('https://m.test/mi-pedido/X?c=COD');
  });
  it('valida antes de enviar y muestra el mensaje del servidor (por ejemplo, el límite)', async () => {
    config = { habilitado: true };
    global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({ ok: false, mensaje: 'Ya enviaste 3 pedidos hoy con este WhatsApp. Intenta mañana.' }) }));
    const AvisarYonkes = await cargar();
    render(<AvisarYonkes marcaInicial="Nissan" modeloInicial="Sentra" anioInicial="2005" piezaInicial="Alternador" />);
    fireEvent.click(await screen.findByRole('button', { name: '🚨 Activar alerta de búsqueda 🚨' }));
    fireEvent.click(screen.getByRole('button', { name: '🚨 Enviar alerta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/WhatsApp a 10 dígitos/);
    expect(global.fetch).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Tu WhatsApp'), { target: { value: '6641234567' } });
    fireEvent.click(screen.getByRole('button', { name: '🚨 Enviar alerta' }));
    expect(await screen.findByText(/Ya enviaste 3 pedidos hoy/)).toBeInTheDocument();
  });
});
