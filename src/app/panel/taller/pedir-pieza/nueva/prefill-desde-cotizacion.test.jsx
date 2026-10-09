// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

let parametros = new URLSearchParams();
const replace = vi.fn();
const crearSolicitud = vi.fn(async () => 'SNEW');
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace }), useSearchParams: () => parametros }));
vi.mock('../contexto', () => ({ usePedirPieza: () => ({ tallerId: 'T1', taller: { nombre: 'Taller Uno', whatsapp: '6641110000', activo: true } }) }));
vi.mock('../datos', () => ({ crearSolicitud: (...args) => crearSolicitud(...args) }));
vi.mock('../../../../lib/estados', () => ({
  ESTADO_DEFAULT: 'baja-california',
  cargarEstados: vi.fn(async () => [{ id: 'baja-california', nombre: 'Baja California' }]),
}));
vi.mock('../../../../lib/SelectorMarcaModelo', () => ({
  default: ({ marca, modelo, onMarca, onModelo }) => (
    <>
      <input aria-label="marca" value={marca} onChange={(e) => onMarca(e.target.value)} />
      <input aria-label="modelo" value={modelo} onChange={(e) => onModelo(e.target.value)} />
    </>
  ),
}));

const { default: NuevaSolicitudPieza } = await import('./page.js');

afterEach(() => { cleanup(); crearSolicitud.mockClear(); replace.mockClear(); parametros = new URLSearchParams(); });

const campos = () => ({
  marca: screen.getByLabelText('marca').value,
  modelo: screen.getByLabelText('modelo').value,
  anio: screen.getByRole('spinbutton').value,
  pieza: screen.getByPlaceholderText('Ej. Defensa delantera').value,
});

describe('Nueva solicitud prellenada desde una cotización', () => {
  it('llena marca, modelo, año y pieza (editables) y envía como siempre, sin datos del cliente', async () => {
    parametros = new URLSearchParams('marca=nissan&modelo=sentra&anio=2010&pieza=Alternador&nombre=Juan&telefono=6649998877&placas=ABC1234&precio=1500');
    render(<NuevaSolicitudPieza />);
    expect(campos()).toEqual({ marca: 'Nissan', modelo: 'Sentra', anio: '2010', pieza: 'Alternador' });
    expect(document.body.textContent).not.toMatch(/Juan|6649998877|ABC1234|1500/);
    fireEvent.change(screen.getByPlaceholderText('Ej. Defensa delantera'), { target: { value: 'Alternador 90A' } });
    fireEvent.click(screen.getByText('Enviar pedido'));
    await waitFor(() => expect(crearSolicitud).toHaveBeenCalledTimes(1));
    const enviado = crearSolicitud.mock.calls[0][0];
    expect(enviado).toMatchObject({ vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2010 }, pieza: 'Alternador 90A', nota: '' });
    expect(JSON.stringify(enviado)).not.toMatch(/Juan|6649998877|ABC1234|1500/);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/panel/taller/pedir-pieza/SNEW'));
  });
  it('lo que no pasa la validación llega vacío para que el taller lo complete', async () => {
    parametros = new URLSearchParams(`marca=MarcaInventada&modelo=Sentra&anio=20x0&pieza=${'x'.repeat(250)}`);
    render(<NuevaSolicitudPieza />);
    const c = campos();
    expect(c.marca).toBe('');
    expect(c.modelo).toBe('');
    expect(c.anio).toBe('');
    expect(c.pieza).toHaveLength(100);
  });
  it('el texto con HTML se muestra como texto, nunca como código', async () => {
    parametros = new URLSearchParams(`pieza=${encodeURIComponent('<img src=x onerror=alert(1)><script>alert(1)</script>')}`);
    render(<NuevaSolicitudPieza />);
    expect(campos().pieza).toBe('<img src=x onerror=alert(1)><script>alert(1)</script>');
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
  });
});
