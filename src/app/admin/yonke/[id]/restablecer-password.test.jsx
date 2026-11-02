// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('../../../lib/firebase', () => ({ auth: { currentUser: { getIdToken: async () => 'pase-admin' } } }));
const { default: RestablecerPassword } = await import('./RestablecerPassword');

const respuesta = (status, cuerpo) => ({ ok: status < 400, status, json: async () => cuerpo });
beforeEach(() => { window.confirm = vi.fn(() => true); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const pulsar = () => fireEvent.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));

describe('botón "Restablecer contraseña"', () => {
  it('pide confirmación; si dices que no, no hace nada', () => {
    window.confirm = vi.fn(() => false);
    const fetchFn = vi.fn();
    vi.stubGlobal('fetch', fetchFn);
    render(<RestablecerPassword usuarioId="uidL" />);
    pulsar();
    expect(window.confirm.mock.calls[0][0]).toContain('desde el WhatsApp registrado');
    expect(fetchFn).not.toHaveBeenCalled();
  });
  it('manda el pase del admin y muestra la temporal con su botón de copiar', async () => {
    const fetchFn = vi.fn(async () => respuesta(200, { ok: true, temporal: 'abcDEF234567' }));
    vi.stubGlobal('fetch', fetchFn);
    const escribir = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escribir }, configurable: true });
    render(<RestablecerPassword usuarioId="uidL" />);
    pulsar();
    expect(await screen.findByText('abcDEF234567')).toBeInTheDocument();
    const [url, opciones] = fetchFn.mock.calls[0];
    expect(url).toBe('/api/admin/restablecer-password');
    expect(opciones.headers.Authorization).toBe('Bearer pase-admin');
    expect(JSON.parse(opciones.body)).toEqual({ usuarioId: 'uidL' });
    fireEvent.click(screen.getByRole('button', { name: 'Copiar mensaje' }));
    await waitFor(() => expect(escribir).toHaveBeenCalled());
    expect(escribir.mock.calls[0][0]).toContain('abcDEF234567');
    expect(escribir.mock.calls[0][0]).toContain('/panel/codigo-temporal');
    expect(await screen.findByRole('button', { name: 'Mensaje copiado' })).toBeInTheDocument();
  });
  it('cada error tiene su mensaje y nunca muestra una contraseña', async () => {
    for (const [motivo, texto] of [['noConfigurado', /llave en Vercel/], ['limite', /máximo/], ['otro', /La contraseña no cambió/]]) {
      vi.stubGlobal('fetch', vi.fn(async () => respuesta(503, { ok: false, motivo })));
      render(<RestablecerPassword usuarioId="uidL" />);
      pulsar();
      expect(await screen.findByRole('alert')).toHaveTextContent(texto);
      expect(screen.queryByRole('button', { name: 'Copiar mensaje' })).not.toBeInTheDocument();
      cleanup();
    }
  });
});
