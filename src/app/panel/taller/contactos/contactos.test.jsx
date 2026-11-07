// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Libreta de contactos: falla cerrada, permisos, tope de 25 en Básico, buscador, alta, detalle.
const replace = vi.fn();
const push = vi.fn();
let configContactos = { habilitado: true };
let taller = { id: 'T1', nombre: 'Taller Ruiz', activo: true, aceptacionVersion: 'v1' };
let lista = { items: [], cursor: null, hayMas: false };
let contacto = null;
const crearContacto = vi.fn(async () => 'c02');
const guardarContacto = vi.fn(async () => {});
const marcarUsado = vi.fn(async () => {});
const borrarContacto = vi.fn(async () => {});
const buscarContactos = vi.fn(async () => []);
const lugaresOcupados = vi.fn(async () => []);

vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }), useParams: () => ({ id: 'c01' }) }));
vi.mock('../../AuthContext', () => ({ useAuth: () => ({ tallerId: 'T1' }) }));
vi.mock('../cotizaciones/datos', () => ({
  leerTaller: vi.fn(async () => taller),
  leerConfigCotizaciones: vi.fn(async () => ({ terminosVersion: 'v1' })),
  aceptarVersion: vi.fn(),
}));
vi.mock('./config', () => ({ leerConfigContactos: vi.fn(async () => configContactos) }));
vi.mock('./datos', () => ({
  listarContactos: vi.fn(async () => lista),
  leerContacto: vi.fn(async () => contacto),
  crearContacto: (...a) => crearContacto(...a),
  guardarContacto: (...a) => guardarContacto(...a),
  marcarUsado: (...a) => marcarUsado(...a),
  borrarContacto: (...a) => borrarContacto(...a),
  buscarContactos: (...a) => buscarContactos(...a),
  lugaresOcupados: (...a) => lugaresOcupados(...a),
}));

const { default: Layout } = await import('./layout.js');
const { default: Lista } = await import('./page.js');
const { default: Nuevo } = await import('./nuevo/page.js');
const { default: Detalle } = await import('./[id]/page.js');

const conMarco = (hijo) => render(<Layout>{hijo}</Layout>);
const c = (id, extra = {}) => ({ id, nombre: `Cliente ${id}`, telefono: '6641234567', nota: '', vehiculos: [], ...extra });

afterEach(() => {
  cleanup(); vi.unstubAllEnvs(); replace.mockClear(); push.mockClear();
  [crearContacto, guardarContacto, marcarUsado, borrarContacto, buscarContactos, lugaresOcupados].forEach((f) => f.mockClear());
  configContactos = { habilitado: true };
  taller = { id: 'T1', nombre: 'Taller Ruiz', activo: true, aceptacionVersion: 'v1' };
  lista = { items: [], cursor: null, hayMas: false };
  contacto = null;
});

describe('marco: falla cerrada', () => {
  it('sin config/contactos o apagada: regresa al inicio y no muestra nada', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    for (const cfg of [null, { habilitado: false }]) {
      configContactos = cfg;
      conMarco(<p>contenido</p>);
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/panel/taller'));
      expect(screen.queryByText('contenido')).not.toBeInTheDocument();
      cleanup(); replace.mockClear();
    }
  });
  it('con la función de talleres apagada tampoco abre', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '0');
    conMarco(<p>contenido</p>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/panel/taller'));
  });
});

describe('lista', () => {
  it('Básico: cuenta los lugares y deja agregar', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    lista = { items: [c('c01'), c('c02', { nombre: 'José Álvarez' })], cursor: null, hayMas: false };
    conMarco(<Lista />);
    expect(await screen.findByText('Usas 2 de 25 lugares del plan Básico.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '＋ Agregar contacto' })).toBeInTheDocument();
    expect(screen.queryByText(/Función del plan Premium/)).not.toBeInTheDocument();
    expect(screen.getByText('Cada contacto se borra solo si pasan 18 meses sin editarlo ni escribirle por WhatsApp.')).toBeInTheDocument();
  });
  it('Básico con los 25 lugares ocupados: aviso de Premium y sin botón de agregar', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    lista = { items: Array.from({ length: 25 }, (_, i) => c(`c${String(i + 1).padStart(2, '0')}`)), cursor: null, hayMas: false };
    conMarco(<Lista />);
    expect(await screen.findByText(/Llegaste a 25 contactos del plan Básico. Con Premium no tienes límite./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '＋ Agregar contacto' })).not.toBeInTheDocument();
  });
  it('Premium: sin límite, aunque ya tenga más de 25', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    taller = { ...taller, plan: 'premium', premiumHasta: new Date(Date.now() + 86400000) };
    lista = { items: Array.from({ length: 30 }, (_, i) => c(`c${i}`)), cursor: null, hayMas: false };
    conMarco(<Lista />);
    expect(await screen.findByText('Plan Premium: contactos sin límite.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '＋ Agregar contacto' })).toBeInTheDocument();
    expect(lugaresOcupados).not.toHaveBeenCalled();
  });
  it('términos viejos: ve la lista pero no agrega', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    taller = { ...taller, aceptacionVersion: 'v0' };
    lista = { items: [c('c01')], cursor: null, hayMas: false };
    conMarco(<Lista />);
    expect(await screen.findByText('Cliente c01')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '＋ Agregar contacto' })).not.toBeInTheDocument();
  });
  it('buscador en pantalla por nombre sin acentos, WhatsApp o placas (sin lecturas)', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    lista = { items: [c('c01', { nombre: 'José Álvarez' }), c('c02', { nombre: 'Ana', telefono: '6649990000', vehiculos: [{ marca: 'Nissan', modelo: 'Versa', placas: 'XYZ987' }] })], cursor: null, hayMas: false };
    conMarco(<Lista />);
    const caja = await screen.findByRole('textbox', { name: 'Buscar por nombre, WhatsApp o placas' });
    fireEvent.change(caja, { target: { value: 'jose' } });
    expect(screen.getByText('José Álvarez')).toBeInTheDocument();
    expect(screen.queryByText('Ana')).not.toBeInTheDocument();
    fireEvent.change(caja, { target: { value: 'xyz' } });
    expect(screen.getByText('Ana')).toBeInTheDocument();
    fireEvent.change(caja, { target: { value: '999' } });
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(buscarContactos).not.toHaveBeenCalled();
  });
  it('con más de una página: busca en Firestore al tocar "Buscar"', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    taller = { ...taller, plan: 'premium' };
    lista = { items: [c('c01')], cursor: 'x', hayMas: true };
    buscarContactos.mockResolvedValueOnce([c('abc', { nombre: 'Encontrado' })]);
    conMarco(<Lista />);
    fireEvent.change(await screen.findByRole('textbox', { name: 'Buscar por nombre, WhatsApp o placas' }), { target: { value: 'enc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByText('Encontrado')).toBeInTheDocument();
    expect(buscarContactos).toHaveBeenCalledWith('T1', 'enc');
  });
});

describe('alta', () => {
  it('valida en pantalla y guarda con los datos limpios', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    conMarco(<Nuevo />);
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar contacto' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Escribe el nombre del contacto');
    fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: ' Juan Pérez ' } });
    fireEvent.change(screen.getByLabelText('WhatsApp (10 dígitos)'), { target: { value: '664 123 4567' } });
    fireEvent.change(screen.getByLabelText('Marca del vehículo 1'), { target: { value: 'Nissan' } });
    fireEvent.change(screen.getByLabelText('Modelo del vehículo 1'), { target: { value: 'Versa' } });
    fireEvent.change(screen.getByLabelText('Placas del vehículo 1'), { target: { value: 'abc 123' } });
    expect(screen.getByText(/No escribas datos sensibles/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contacto' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/panel/taller/contactos/c02'));
    expect(crearContacto).toHaveBeenCalledWith({
      tallerId: 'T1', premium: false,
      datos: { nombre: 'Juan Pérez', telefono: '6641234567', nota: '', vehiculos: [{ marca: 'Nissan', modelo: 'Versa', placas: 'ABC123' }] },
    });
  });
  it('si está lleno, muestra el mensaje y lo escrito sigue', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    crearContacto.mockRejectedValueOnce(new Error('Llegaste a 25 contactos del plan Básico.'));
    conMarco(<Nuevo />);
    fireEvent.change(await screen.findByLabelText('Nombre *'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contacto' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Llegaste a 25 contactos del plan Básico.');
    expect(screen.getByLabelText('Nombre *')).toHaveValue('Ana');
  });
  it('sin permiso de escribir regresa a la lista', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    taller = { ...taller, activo: false };
    conMarco(<Nuevo />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/panel/taller/contactos'));
  });
});

describe('detalle', () => {
  it('WhatsApp con el mensaje escrito (renueva el borrado), editar y borrar', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    contacto = c('c01', { nombre: 'Juan Pérez', vehiculos: [{ marca: 'Nissan', modelo: 'Versa', anio: 2018, placas: 'ABC123' }] });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    conMarco(<Detalle />);
    const wa = await screen.findByRole('link', { name: '💬 Escribir por WhatsApp' });
    expect(wa).toHaveAttribute('href', `https://wa.me/526641234567?text=${encodeURIComponent('Hola Juan, le escribimos de Taller Ruiz.')}`);
    expect(screen.getByText('🚗 Nissan Versa 2018 · ABC123')).toBeInTheDocument();
    fireEvent.click(wa);
    expect(marcarUsado).toHaveBeenCalledWith('T1', 'c01');

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Nota'), { target: { value: 'Prefiere sábado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(guardarContacto).toHaveBeenCalled());
    expect(guardarContacto.mock.calls[0][0].datos.nota).toBe('Prefiere sábado');

    fireEvent.click(await screen.findByRole('button', { name: 'Borrar contacto' }));
    await waitFor(() => expect(borrarContacto).toHaveBeenCalledWith('T1', 'c01'));
    expect(push).toHaveBeenCalledWith('/panel/taller/contactos');
  });
  it('taller desactivado: puede escribir por WhatsApp y borrar, no editar', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    taller = { ...taller, activo: false };
    contacto = c('c01');
    conMarco(<Detalle />);
    const wa = await screen.findByRole('link', { name: '💬 Escribir por WhatsApp' });
    fireEvent.click(wa);
    expect(marcarUsado).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Borrar contacto' })).toBeInTheDocument();
  });
  it('sin WhatsApp no hay botón; si no existe, lo dice', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    contacto = c('c01', { telefono: '' });
    conMarco(<Detalle />);
    expect(await screen.findByRole('heading', { name: 'Cliente c01' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /WhatsApp/ })).not.toBeInTheDocument();
    cleanup();
    contacto = null;
    conMarco(<Detalle />);
    expect(await screen.findByText('Este contacto ya no existe.')).toBeInTheDocument();
    expect(within(document.body).queryByRole('button', { name: 'Borrar contacto' })).not.toBeInTheDocument();
  });
});
