// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const TOKEN = 'T'.repeat(40) + 'a_-';
vi.mock('next/navigation', () => ({ useParams: () => ({ token: TOKEN }) }));

const { default: SeguimientoCliente } = await import('./SeguimientoCliente.js');
const { metadata } = await import('./page.js');
const { MENSAJES_SEGUIMIENTO } = await import('../../../lib/seguimiento');

const SEG = {
  tallerNombre: 'Taller Peña', tallerWhatsapp: '6641234567', marca: 'Nissan', modelo: 'Sentra', anio: 2001,
  estado: 'listo', estadoNombre: 'Listo', nota: 'Puede pasar hoy', actualizadoAt: '2026-10-22T18:00:00.000Z',
};
function conRespuesta(status, cuerpo) {
  global.fetch = vi.fn(async () => ({ ok: status === 200, status, json: async () => cuerpo }));
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('página pública /seguimiento/[token]', () => {
  it('metadatos: título genérico (sin taller ni vehículo), noindex y sin referer', () => {
    expect(metadata.title).toBe('Seguimiento de tu orden');
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.referrer).toBe('no-referrer');
  });
  it('muestra taller, vehículo, estado, nota, última actualización y WhatsApp al taller', async () => {
    conRespuesta(200, { ok: true, seguimiento: SEG });
    render(<SeguimientoCliente />);
    expect(await screen.findByText('Nissan Sentra 2001')).toBeInTheDocument();
    expect(screen.getByText('Taller Peña')).toBeInTheDocument();
    expect(screen.getByTestId('estado')).toHaveTextContent('Listo');
    expect(screen.getByTestId('nota')).toHaveTextContent('Puede pasar hoy');
    expect(screen.getByText(/Última actualización/)).toBeInTheDocument();
    const wa = screen.getByRole('link', { name: 'Escribir al taller por WhatsApp' });
    expect(wa.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/526641234567\?text=/);
    expect(wa).toHaveAttribute('rel', 'noopener noreferrer');
    expect(global.fetch).toHaveBeenCalledWith(`/api/seguimiento/${TOKEN}`, { cache: 'no-store' });
  });
  it('la nota se muestra como texto (nunca HTML)', async () => {
    conRespuesta(200, { ok: true, seguimiento: { ...SEG, nota: '<b>hola</b><img src=x onerror=alert(1)>' } });
    const { container } = render(<SeguimientoCliente />);
    expect(await screen.findByTestId('nota')).toHaveTextContent('<b>hola</b>');
    expect(container.querySelector('img')).toBeNull();
  });
  it('no encontrado o vencido: el mensaje, sin datos', async () => {
    conRespuesta(404, { ok: false, mensaje: MENSAJES_SEGUIMIENTO.noEncontrado });
    render(<SeguimientoCliente />);
    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAJES_SEGUIMIENTO.noEncontrado);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
  it('sin conexión: "no disponible"', async () => {
    global.fetch = vi.fn(async () => { throw new Error('red'); });
    render(<SeguimientoCliente />);
    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAJES_SEGUIMIENTO.noDisponible);
  });
});
