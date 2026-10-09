// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  android: 'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36',
  whatsapp: 'Mozilla/5.0 (Linux; Android 13; moto g54) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36 WhatsApp/2.24.12.78',
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 334.0.4.32.98',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

function simular({ ua, toque = 0, standalone = false }) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
  Object.defineProperty(window.navigator, 'maxTouchPoints', { value: toque, configurable: true });
  window.matchMedia = vi.fn(() => ({ matches: standalone, addEventListener() {}, removeEventListener() {} }));
}

// El evento de instalación y la marca de "cerrado" viven por módulo: cada prueba carga todo de nuevo.
async function cargar() {
  vi.resetModules();
  const mod = await import('./AvisoInstalarApp.js');
  return mod;
}

function eventoInstalacion(outcome = 'accepted') {
  const e = new Event('beforeinstallprompt', { cancelable: true });
  e.prompt = vi.fn();
  e.userChoice = Promise.resolve({ outcome });
  return e;
}

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('aviso "Instalar app" del panel', () => {
  it('ya instalada (abierta desde el ícono): no muestra nada', async () => {
    simular({ ua: UA.iphone, standalone: true });
    const { default: Aviso } = await cargar();
    const { container } = render(<Aviso />);
    expect(container).toBeEmptyDOMElement();
  });
  it('iPhone: los 3 pasos (Compartir, "Agregar a inicio", abrir desde el ícono)', async () => {
    simular({ ua: UA.iphone });
    const { default: Aviso } = await cargar();
    render(<Aviso />);
    expect(screen.getByText(/Instala Mecanix en tu iPhone/)).toBeInTheDocument();
    const pasos = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(pasos).toHaveLength(3);
    expect(pasos[0]).toMatch(/Compartir/);
    expect(pasos[1]).toMatch(/"Agregar a inicio"/);
    expect(pasos[2]).toMatch(/ícono/);
  });
  it('iPad (se presenta como Mac pero es táctil): los mismos 3 pasos', async () => {
    simular({ ua: UA.ipad, toque: 5 });
    const { default: Aviso } = await cargar();
    render(<Aviso />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });
  it('Android sin aviso del navegador: instrucciones del menú ⋮; cuando Chrome lo ofrece: botón "Instalar app"', async () => {
    simular({ ua: UA.android });
    const { default: Aviso } = await cargar();
    render(<Aviso />);
    expect(screen.getByText(/Agregar a pantalla principal/)).toBeInTheDocument();
    const evento = eventoInstalacion('accepted');
    act(() => { window.dispatchEvent(evento); });
    expect(evento.defaultPrevented).toBe(true); // sin la barrita automática de Chrome
    fireEvent.click(await screen.findByRole('button', { name: 'Instalar app' }));
    expect(evento.prompt).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Instalar app' })).not.toBeInTheDocument());
  });
  it('navegador de WhatsApp: aviso grande para abrir en Safari o Chrome, con botón para copiar el enlace', async () => {
    simular({ ua: UA.whatsapp });
    const writeText = vi.fn(async () => {});
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { default: Aviso } = await cargar();
    render(<Aviso />);
    expect(screen.getByRole('alert')).toHaveTextContent('Abre este enlace en Safari (iPhone) o Chrome (Android) para instalar la app');
    expect(screen.getByRole('alert')).toHaveTextContent('Estás dentro de WhatsApp');
    fireEvent.click(screen.getByRole('button', { name: 'Copiar enlace' }));
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(await screen.findByText(/¡Enlace copiado!/)).toBeInTheDocument();
  });
  it('sin portapapeles, muestra el enlace para copiarlo a mano', async () => {
    simular({ ua: UA.instagram });
    Object.defineProperty(window.navigator, 'clipboard', { value: undefined, configurable: true });
    const { default: Aviso } = await cargar();
    render(<Aviso />);
    expect(screen.getByRole('alert')).toHaveTextContent('Estás dentro de Instagram');
    fireEvent.click(screen.getByRole('button', { name: 'Copiar enlace' }));
    expect(screen.getByLabelText('Enlace para copiar')).toHaveValue(window.location.href);
  });
  it('se puede cerrar y se recuerda; en el panel de Negocio se vuelve a ver', async () => {
    simular({ ua: UA.iphone });
    const { default: Aviso, OpcionInstalarApp } = await cargar();
    const { unmount } = render(<Aviso />);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }));
    expect(screen.queryByText(/Instala Mecanix/)).not.toBeInTheDocument();
    expect(window.localStorage.getItem('mecanix_aviso_instalar_cerrado')).toBe('1');
    unmount();
    const { default: Aviso2, OpcionInstalarApp: Opcion2 } = await cargar();
    const { container } = render(<Aviso2 />);
    expect(container).toBeEmptyDOMElement();
    cleanup();
    render(<Opcion2 estiloSeccion={{}} estiloTitulo={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Instalar app' }));
    expect(screen.getByText(/Instala Mecanix en tu iPhone/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar aviso' })).not.toBeInTheDocument();
    expect(OpcionInstalarApp).toBeTypeOf('function');
  });
  it('si localStorage falla, el aviso igual se muestra y se cierra sin romper la página', async () => {
    simular({ ua: UA.iphone });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
    const { default: Aviso } = await cargar();
    render(<Aviso />);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }));
    expect(screen.queryByText(/Instala Mecanix/)).not.toBeInTheDocument();
  });
  it('computadora sin aviso del navegador: nada; en el panel de Negocio explica que se instala desde el teléfono', async () => {
    simular({ ua: UA.windows });
    const { default: Aviso } = await cargar();
    const { container } = render(<Aviso />);
    expect(container).toBeEmptyDOMElement();
    cleanup();
    render(<Aviso siempre />);
    expect(screen.getByText(/Abre esta página desde tu teléfono/)).toBeInTheDocument();
  });
});
