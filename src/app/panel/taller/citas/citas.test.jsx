// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Citas: falla cerrada, candado Premium, agenda (hoy / próximas / pasadas), alta, detalle.
const replace = vi.fn();
const push = vi.fn();
const DIA = 86400000;
let configCitas = { habilitado: true };
let taller = { id: 'T1', nombre: 'Taller Ruiz', activo: true, aceptacionVersion: 'v1' };
let proximas = [];
let pasadas = [];
let cita = null;
const crearCita = vi.fn(async () => 'NUEVA');
const guardarCita = vi.fn(async () => {});
const cambiarEstadoCita = vi.fn(async () => {});
const borrarCita = vi.fn(async () => {});
const listarPasadas = vi.fn(async () => pasadas);

vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }), useParams: () => ({ id: 'C1' }) }));
vi.mock('../../AuthContext', () => ({ useAuth: () => ({ tallerId: 'T1' }) }));
vi.mock('../cotizaciones/datos', () => ({
  leerTaller: vi.fn(async () => taller),
  leerConfigCotizaciones: vi.fn(async () => ({ terminosVersion: 'v1' })),
  aceptarVersion: vi.fn(),
}));
vi.mock('./config', () => ({ leerConfigCitas: vi.fn(async () => configCitas) }));
vi.mock('./datos', () => ({
  listarProximas: vi.fn(async () => proximas),
  listarPasadas: (...a) => listarPasadas(...a),
  leerCita: vi.fn(async () => cita),
  crearCita: (...a) => crearCita(...a),
  guardarCita: (...a) => guardarCita(...a),
  cambiarEstadoCita: (...a) => cambiarEstadoCita(...a),
  borrarCita: (...a) => borrarCita(...a),
}));

const { default: Layout } = await import('./layout.js');
const { default: Agenda } = await import('./page.js');
const { default: Nueva } = await import('./nueva/page.js');
const { default: Detalle } = await import('./[id]/page.js');

const conMarco = (hijo) => render(<Layout>{hijo}</Layout>);
const hoyALas = (h, m = 0) => { const d = new Date(); d.setHours(h, m, 0, 0); return d; };
const enDias = (n, h = 10) => { const d = hoyALas(h); d.setDate(d.getDate() + n); return d; };
const c = (id, fecha, extra = {}) => ({ id, fecha: { toDate: () => fecha }, nombre: `Cliente ${id}`, telefono: '6641234567', vehiculo: 'Nissan Versa', placas: 'ABC123', motivo: '', estado: 'pendiente', ...extra });
const PREMIUM = { plan: 'premium', premiumHasta: new Date(Date.now() + 30 * DIA) };

afterEach(() => {
  cleanup(); vi.unstubAllEnvs(); replace.mockClear(); push.mockClear();
  [crearCita, guardarCita, cambiarEstadoCita, borrarCita, listarPasadas].forEach((f) => f.mockClear());
  configCitas = { habilitado: true };
  taller = { id: 'T1', nombre: 'Taller Ruiz', activo: true, aceptacionVersion: 'v1' };
  proximas = []; pasadas = []; cita = null;
});

describe('marco: falla cerrada', () => {
  it('sin config/citas o apagada: regresa al inicio y no muestra nada', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    for (const cfg of [null, { habilitado: false }]) {
      configCitas = cfg;
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

describe('candado Premium', () => {
  it('sin requierePremium cualquier taller agenda', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    conMarco(<Agenda />);
    expect(await screen.findByRole('button', { name: '＋ Agendar cita' })).toBeInTheDocument();
  });
  it('con requierePremium y sin Premium: aviso y sin botón de agendar', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    configCitas = { habilitado: true, requierePremium: true };
    conMarco(<Agenda />);
    expect(await screen.findByText(/Agendar y editar citas es del plan Premium/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '＋ Agendar cita' })).not.toBeInTheDocument();
  });
  it('con requierePremium y Premium vigente: agenda sin aviso', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    configCitas = { habilitado: true, requierePremium: true };
    taller = { ...taller, ...PREMIUM };
    conMarco(<Agenda />);
    expect(await screen.findByRole('button', { name: '＋ Agendar cita' })).toBeInTheDocument();
    expect(screen.queryByText(/Agendar y editar citas es del plan Premium/)).not.toBeInTheDocument();
  });
  it('sin permiso, "Agendar cita" regresa a la agenda', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    taller = { ...taller, activo: false };
    conMarco(<Nueva />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/panel/taller/citas'));
  });
});

describe('agenda', () => {
  it('separa hoy y próximas; las pasadas solo al tocar el botón', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    proximas = [c('A', hoyALas(23, 30), { nombre: 'Ana Hoy' }), c('B', enDias(3), { nombre: 'Beto Luego', estado: 'confirmada' })];
    pasadas = [c('P', enDias(-2), { nombre: 'Pepe Antes', estado: 'atendida' })];
    conMarco(<Agenda />);
    expect(await screen.findByText('Ana Hoy')).toBeInTheDocument();
    expect(screen.getByText('11:30 p. m.')).toBeInTheDocument();
    expect(screen.getByText('Beto Luego')).toBeInTheDocument();
    expect(screen.getByText('Confirmada')).toBeInTheDocument();
    expect(screen.getByText('Cada cita se borra sola 30 días después de su fecha.')).toBeInTheDocument();
    expect(screen.queryByText('Pepe Antes')).not.toBeInTheDocument();
    expect(listarPasadas).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Ver citas pasadas' }));
    expect(await screen.findByText('Pepe Antes')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Ana Hoy'));
    expect(push).toHaveBeenCalledWith('/panel/taller/citas/A');
  });
  it('sin citas lo dice', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    conMarco(<Agenda />);
    expect(await screen.findByText('No tienes citas hoy.')).toBeInTheDocument();
    expect(screen.getByText('No tienes citas próximas.')).toBeInTheDocument();
  });
});

describe('agendar', () => {
  it('valida en pantalla y guarda con los datos limpios', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    conMarco(<Nueva />);
    const boton = await screen.findByRole('button', { name: 'Agendar cita' });
    fireEvent.click(boton);
    expect(await screen.findByRole('alert')).toHaveTextContent('Escribe la fecha y la hora de la cita.');
    const f = enDias(2, 9);
    const ymd = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
    fireEvent.change(screen.getByLabelText('Fecha *'), { target: { value: ymd } });
    fireEvent.change(screen.getByLabelText('Hora *'), { target: { value: '09:30' } });
    fireEvent.change(screen.getByLabelText('Nombre del cliente *'), { target: { value: 'Juan Pérez' } });
    fireEvent.change(screen.getByLabelText('Placas'), { target: { value: 'abc 123' } });
    fireEvent.click(boton);
    await waitFor(() => expect(crearCita).toHaveBeenCalled());
    const { datos } = crearCita.mock.calls[0][0];
    expect(datos).toMatchObject({ nombre: 'Juan Pérez', placas: 'ABC123', estado: 'pendiente' });
    expect(datos.fecha.getHours()).toBe(9);
    expect(push).toHaveBeenCalledWith('/panel/taller/citas/NUEVA');
  });
  it('si falla al guardar, el error se ve y lo escrito sigue', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    crearCita.mockRejectedValueOnce(new Error('No pudimos guardar la cita.'));
    conMarco(<Nueva />);
    const f = enDias(2);
    const ymd = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
    fireEvent.change(await screen.findByLabelText('Fecha *'), { target: { value: ymd } });
    fireEvent.change(screen.getByLabelText('Hora *'), { target: { value: '10:00' } });
    fireEvent.change(screen.getByLabelText('Nombre del cliente *'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agendar cita' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos guardar la cita.');
    expect(screen.getByLabelText('Nombre del cliente *')).toHaveValue('Ana');
  });
});

describe('detalle', () => {
  it('recordatorio por WhatsApp, cambiar estado, editar y borrar', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    cita = c('C1', enDias(1, 9), { nombre: 'Juan Pérez' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    conMarco(<Detalle />);
    const enlace = await screen.findByRole('link', { name: '💬 Recordar por WhatsApp' });
    expect(decodeURIComponent(enlace.getAttribute('href'))).toContain('Hola Juan, le recordamos su cita en Taller Ruiz el');
    expect(screen.getByText(/^Se borrará el/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmada' }));
    await waitFor(() => expect(cambiarEstadoCita).toHaveBeenCalledWith({ tallerId: 'T1', id: 'C1', estado: 'confirmada' }));
    expect(await screen.findByText('Estado: Confirmada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Borrar cita' }));
    await waitFor(() => expect(borrarCita).toHaveBeenCalledWith('T1', 'C1'));
    expect(push).toHaveBeenCalledWith('/panel/taller/citas');
  });
  it('sin Premium (con requierePremium): ve, recuerda y borra, pero no edita ni cambia estado', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    configCitas = { habilitado: true, requierePremium: true };
    cita = c('C1', enDias(1));
    conMarco(<Detalle />);
    expect(await screen.findByRole('link', { name: '💬 Recordar por WhatsApp' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmada' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Borrar cita' })).toBeInTheDocument();
  });
  it('editar llena el formulario con la cita y guarda', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    cita = c('C1', enDias(1, 16), { nombre: 'Juan Pérez' });
    conMarco(<Detalle />);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    expect(screen.getByLabelText('Hora *')).toHaveValue('16:00');
    expect(screen.getByLabelText('Nombre del cliente *')).toHaveValue('Juan Pérez');
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'atendida' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(guardarCita).toHaveBeenCalled());
    expect(guardarCita.mock.calls[0][0].datos).toMatchObject({ nombre: 'Juan Pérez', estado: 'atendida' });
  });
  it('sin WhatsApp no hay botón de recordatorio', async () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    cita = c('C1', enDias(1), { telefono: '' });
    conMarco(<Detalle />);
    expect(await screen.findByRole('button', { name: 'Borrar cita' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '💬 Recordar por WhatsApp' })).not.toBeInTheDocument();
  });
});
