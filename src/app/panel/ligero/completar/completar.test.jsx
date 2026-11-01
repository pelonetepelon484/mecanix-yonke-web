// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const replace = vi.fn();
const recargarRol = vi.fn(async () => 'yonke');
let sesion;
let yonke;
let respuesta;
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock('../../../lib/firebase', () => ({ auth: { currentUser: { getIdToken: async () => 'pase-ligero' } }, db: {} }));
vi.mock('../../AuthContext', () => ({ useAuth: () => sesion }));
vi.mock('../../../lib/estados', () => ({ cargarEstados: async () => [{ id: 'baja-california', nombre: 'Baja California' }, { id: 'jalisco', nombre: 'Jalisco' }] }));
vi.mock('../../solicitudesPiezasDatos', () => ({ leerYonkeEstadoActivo: vi.fn(async () => yonke) }));
vi.mock('../../pedidosClientesDatos', () => ({ leerConfigPedidosClientes: vi.fn(async () => ({ limiteRespuestasDiarias: 50 })) }));

const { default: Completar } = await import('./page.js');

beforeEach(() => {
  sesion = { user: { uid: 'l1' }, yonkeId: 'YL', loading: false, esLigero: true, recargarRol };
  yonke = { estado: 'baja-california', activo: true, nombre: 'Yonke Tigre', whatsapp: '6641234567' };
  respuesta = { ok: true, status: 200, cuerpo: { ok: true } };
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: respuesta.ok, status: respuesta.status, json: async () => respuesta.cuerpo })));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

const boton = () => screen.findByRole('button', { name: 'Completar mi registro' });

describe('Completar mi registro', () => {
  it('muestra sus datos fijos, lo que gana y el teléfono ya prellenado', async () => {
    render(<Completar />);
    await boton();
    expect(screen.getByText('Yonke Tigre')).toBeInTheDocument();
    expect(await screen.findByText(/6641234567 · Baja California/)).toBeInTheDocument();
    expect(await screen.findByText(/hasta 50 búsquedas al día/)).toBeInTheDocument();
    expect(screen.getByLabelText('Teléfono')).toHaveValue('6641234567');
    expect(screen.queryByLabelText(/Nombre/)).not.toBeInTheDocument();
  });
  it('Baja California: lista de ciudades; otro estado: texto libre', async () => {
    render(<Completar />);
    await boton();
    expect(screen.getByLabelText('Ciudad').tagName).toBe('SELECT');
    cleanup();
    yonke = { ...yonke, estado: 'jalisco' };
    render(<Completar />);
    await boton();
    expect(screen.getByLabelText('Ciudad').tagName).toBe('INPUT');
  });
  it('datos inválidos: el mensaje, sin llamar al servidor', async () => {
    render(<Completar />);
    fireEvent.click(await boton());
    expect(await screen.findByRole('alert')).toHaveTextContent('dirección');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('manda solo lo suyo con su pase, vuelve a leer la cuenta y felicita', async () => {
    render(<Completar />);
    await boton();
    fireEvent.change(screen.getByLabelText('Dirección'), { target: { value: 'Calle 1' } });
    fireEvent.change(screen.getByLabelText('Correo (opcional)'), { target: { value: 'a@b.mx' } });
    fireEvent.click(await boton());
    expect(await screen.findByText('¡Listo!')).toBeInTheDocument();
    const [url, opciones] = fetch.mock.calls[0];
    expect(url).toBe('/api/yonkes/completar-registro');
    expect(opciones.headers.Authorization).toBe('Bearer pase-ligero');
    expect(JSON.parse(opciones.body)).toEqual({ ciudad: 'tijuana', direccion: 'Calle 1', telefono: '6641234567', correo: 'a@b.mx' });
    expect(recargarRol).toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Ir a mi panel' })).toHaveAttribute('href', '/panel/inventario');
  });
  it('si el servidor falla: su mensaje, conservando lo escrito', async () => {
    respuesta = { ok: false, status: 503, cuerpo: { ok: false, mensaje: 'No pudimos.' } };
    render(<Completar />);
    await boton();
    fireEvent.change(screen.getByLabelText('Dirección'), { target: { value: 'Calle 1' } });
    fireEvent.click(await boton());
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos.');
    expect(screen.getByLabelText('Dirección')).toHaveValue('Calle 1');
  });
  it('sin sesión va a entrar; un yonke completo va a su inventario', async () => {
    sesion = { user: null, loading: false };
    render(<Completar />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/panel'));
    cleanup();
    sesion = { user: { uid: 'c' }, yonkeId: 'Y1', loading: false, esLigero: false };
    render(<Completar />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/panel/inventario'));
  });
});
