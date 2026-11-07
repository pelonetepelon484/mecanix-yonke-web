// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Pantalla "Estoy aquí" del proveedor: lee el secreto después del "#", escoge el tiempo, manda la
// ubicación del celular y puede quitarse del mapa.
const { default: AquiClient } = await import('./AquiClient.js');
const SECRETO = 'A'.repeat(43);
let respuestas = [];
const fetchMock = vi.fn(async () => { const r = respuestas.shift(); return { ok: r.status === 200, json: async () => r.json }; });

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: (ok) => ok({ coords: { latitude: 32.51493, longitude: -117.03821 } }) },
  });
});
afterEach(() => { cleanup(); fetchMock.mockClear(); respuestas = []; window.location.hash = ''; vi.unstubAllGlobals(); });
const cuerpo = (i) => JSON.parse(fetchMock.mock.calls[i][1].body);

describe('Estoy aquí', () => {
  it('escoge el tiempo y guarda la ubicación; luego se puede quitar', async () => {
    window.location.hash = `#${SECRETO}`;
    respuestas = [
      { status: 200, json: { nombre: 'Grúas El Güero', hastaMs: null } },
      { status: 200, json: { ok: true, hastaMs: new Date(2026, 10, 6, 16, 30).getTime() } },
      { status: 200, json: { ok: true, hastaMs: null } },
    ];
    render(<AquiClient />);
    expect(await screen.findByRole('heading', { name: 'Grúas El Güero' })).toBeInTheDocument();
    expect(cuerpo(0)).toEqual({ secreto: SECRETO, accion: 'estado' });
    fireEvent.click(screen.getByRole('button', { name: '📍 Estoy aquí' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Escoge cuánto tiempo estarás aquí.');
    fireEvent.click(screen.getByRole('radio', { name: '1 h 30 min' }));
    fireEvent.click(screen.getByRole('button', { name: '📍 Estoy aquí' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Estás en el mapa hasta las 4:30 p. m.');
    expect(cuerpo(1)).toEqual({ secreto: SECRETO, accion: 'llegue', lat: 32.51493, lng: -117.03821, minutos: 90 });
    fireEvent.click(screen.getByRole('button', { name: 'Ya me fui' }));
    expect(await screen.findByText('Ahora no apareces en el mapa.')).toBeInTheDocument();
    expect(cuerpo(2)).toEqual({ secreto: SECRETO, accion: 'me-fui' });
  });
  it('sin secreto válido no llama al servidor', async () => {
    window.location.hash = '#corto';
    render(<AquiClient />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Este enlace ya no sirve');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('enlace desactivado: muestra el mensaje del servidor', async () => {
    window.location.hash = `#${SECRETO}`;
    respuestas = [{ status: 404, json: { error: 'Este enlace ya no sirve. Pide uno nuevo a Red Mecanix.' } }];
    render(<AquiClient />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Este enlace ya no sirve');
    expect(screen.queryByRole('button', { name: '📍 Estoy aquí' })).not.toBeInTheDocument();
  });
  it('sin permiso de ubicación: lo explica y no manda nada', async () => {
    window.location.hash = `#${SECRETO}`;
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (_ok, mal) => mal({ code: 1 }) } });
    respuestas = [{ status: 200, json: { nombre: 'Grúas', hastaMs: null } }];
    render(<AquiClient />);
    fireEvent.click(await screen.findByRole('radio', { name: '30 min' }));
    fireEvent.click(screen.getByRole('button', { name: '📍 Estoy aquí' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('permite que el navegador la vea');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});
