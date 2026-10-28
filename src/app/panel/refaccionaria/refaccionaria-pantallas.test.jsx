// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Pantallas de la cuenta de refaccionaria (etapa 1): guarda de rol, registro con la bandera
// config/refaccionarias apagada y encendida, y panel con el aviso ACEPTO y "Próximamente".
const replaceMock = vi.fn();
const pushMock = vi.fn();
let pathnameActual = '/panel/refaccionaria';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
  usePathname: () => pathnameActual,
}));
let estadoAuth = {};
vi.mock('../AuthContext', () => ({ useAuth: () => estadoAuth }));
vi.mock('../../lib/firebase', () => ({ auth: {}, db: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn(), createUserWithEmailAndPassword: vi.fn(), deleteUser: vi.fn() }));
const cargarEstados = vi.fn(async () => [{ id: 'baja-california', nombre: 'Baja California' }]);
vi.mock('../../lib/estados', () => ({ cargarEstados: (...a) => cargarEstados(...a) }));

let configActual = { habilitado: false, terminosVersion: '', resumenCambios: '' };
let refaccionariaActual = null;
const aceptarVersionRefaccionaria = vi.fn(async () => {});
const guardarHorarioRefaccionaria = vi.fn(async () => {});
vi.mock('./datos', () => ({
  leerConfigRefaccionarias: vi.fn(async () => configActual),
  leerRefaccionaria: vi.fn(async () => refaccionariaActual),
  aceptarVersionRefaccionaria: (...a) => aceptarVersionRefaccionaria(...a),
  guardarHorarioRefaccionaria: (...a) => guardarHorarioRefaccionaria(...a),
  nuevoIdRefaccionaria: () => 'R-1', crearRefaccionaria: vi.fn(), borrarRefaccionaria: vi.fn(), crearUsuarioRefaccionaria: vi.fn(),
}));

const { default: Layout } = await import('./layout.js');
const { default: Registro } = await import('./registro/page.js');
const { default: Panel } = await import('./page.js');

beforeEach(() => {
  replaceMock.mockReset(); pushMock.mockReset(); cargarEstados.mockClear(); aceptarVersionRefaccionaria.mockClear(); guardarHorarioRefaccionaria.mockClear();
  pathnameActual = '/panel/refaccionaria';
});
afterEach(() => cleanup());

describe('guarda de /panel/refaccionaria', () => {
  it('rol refaccionaria: muestra el contenido', () => {
    estadoAuth = { user: { uid: 'u' }, userRole: 'refaccionaria', loading: false, rolListo: true };
    render(<Layout><p>contenido</p></Layout>);
    expect(screen.getByText('contenido')).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
  it('yonke, taller, admin o sin sesión: al login del panel', () => {
    for (const auth of [{ user: { uid: 'u' }, userRole: 'yonke' }, { user: { uid: 'u' }, userRole: 'taller' }, { user: { uid: 'u' }, userRole: 'admin' }, { user: null, userRole: null }]) {
      estadoAuth = { ...auth, loading: false, rolListo: true };
      render(<Layout><p>contenido</p></Layout>);
      expect(screen.queryByText('contenido')).not.toBeInTheDocument();
      cleanup();
    }
    expect(replaceMock).toHaveBeenCalledTimes(4);
    expect(replaceMock).toHaveBeenCalledWith('/panel');
  });
  it('el registro es público (no pasa por la guarda)', () => {
    pathnameActual = '/panel/refaccionaria/registro';
    estadoAuth = { user: null, userRole: null, loading: false, rolListo: true };
    render(<Layout><p>registro</p></Layout>);
    expect(screen.getByText('registro')).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});

describe('registro', () => {
  it('bandera apagada: "próximamente", sin formulario y sin leer los estados', async () => {
    configActual = { habilitado: false, terminosVersion: '', resumenCambios: '' };
    estadoAuth = { recargarRol: vi.fn() };
    render(<Registro />);
    expect(await screen.findByText('Registro de refaccionarias: próximamente')).toBeInTheDocument();
    expect(screen.queryByLabelText('Nombre de la refaccionaria')).not.toBeInTheDocument();
    expect(cargarEstados).not.toHaveBeenCalled();
  });
  it('bandera encendida: el formulario con estado, zona de entrega opcional y la casilla (texto provisional)', async () => {
    configActual = { habilitado: true, terminosVersion: 'ref-1', resumenCambios: '' };
    estadoAuth = { recargarRol: vi.fn() };
    render(<Registro />);
    expect(await screen.findByLabelText('Nombre de la refaccionaria')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('option', { name: 'Baja California' })).toBeInTheDocument());
    expect(screen.getByLabelText('Zona de entrega local (opcional)')).toBeInTheDocument();
    expect(screen.getByText(/\[PROVISIONAL\] He leído y acepto/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar refaccionaria' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Llena todos los campos obligatorios.');
  });
});

describe('panel', () => {
  const refaccionaria = { id: 'R-1', nombre: 'El Pistón', whatsapp: '6641234567', ciudad: 'Tijuana', aceptacionVersion: '', verificado: false };
  it('sin aceptar la versión vigente: aviso ACEPTO; al escribir ACEPTO acepta y desaparece', async () => {
    configActual = { habilitado: true, terminosVersion: 'ref-1', resumenCambios: 'Resumen de prueba' };
    refaccionariaActual = refaccionaria;
    estadoAuth = { refaccionariaId: 'R-1' };
    render(<Panel />);
    expect(await screen.findByText('Resumen de prueba')).toBeInTheDocument();
    const boton = screen.getByRole('button', { name: 'Acepto la versión nueva' });
    expect(boton).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Para aceptar, escribe la palabra ACEPTO'), { target: { value: ' acepto ' } });
    await act(async () => { fireEvent.click(boton); });
    expect(aceptarVersionRefaccionaria).toHaveBeenCalledWith('R-1', 'ref-1');
    expect(screen.queryByText('Resumen de prueba')).not.toBeInTheDocument();
  });
  it('ya aceptada: sin aviso, con sus datos y "Próximamente: carga de inventario"', async () => {
    configActual = { habilitado: true, terminosVersion: 'ref-1', resumenCambios: 'Resumen de prueba' };
    refaccionariaActual = { ...refaccionaria, aceptacionVersion: 'ref-1', zonaEntrega: { descripcion: 'Centro', municipios: ['Tijuana'] } };
    estadoAuth = { refaccionariaId: 'R-1' };
    render(<Panel />);
    expect(await screen.findByText(/Próximamente: carga de inventario/)).toBeInTheDocument();
    expect(screen.queryByText('Resumen de prueba')).not.toBeInTheDocument();
    expect(screen.getByText(/Centro \(Tijuana\)/)).toBeInTheDocument();
  });
  it('sin aceptar la versión vigente: no se edita el horario', async () => {
    configActual = { habilitado: true, terminosVersion: 'ref-1', resumenCambios: 'Resumen de prueba' };
    refaccionariaActual = refaccionaria;
    estadoAuth = { refaccionariaId: 'R-1' };
    render(<Panel />);
    await screen.findByText('Resumen de prueba');
    expect(screen.queryByRole('button', { name: 'Guardar horario' })).not.toBeInTheDocument();
  });
  it('horario: valida las horas y guarda los 7 días', async () => {
    configActual = { habilitado: true, terminosVersion: 'ref-1', resumenCambios: '' };
    refaccionariaActual = { ...refaccionaria, aceptacionVersion: 'ref-1' };
    estadoAuth = { refaccionariaId: 'R-1' };
    render(<Panel />);
    const boton = await screen.findByRole('button', { name: 'Guardar horario' });
    fireEvent.change(screen.getByLabelText('Lunes cierre'), { target: { value: '08:00' } });
    fireEvent.click(boton);
    expect(screen.getByRole('status')).toHaveTextContent('La hora de cierre debe ser después de la de apertura.');
    expect(guardarHorarioRefaccionaria).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Lunes cierre'), { target: { value: '19:30' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Domingo' }));
    await act(async () => { fireEvent.click(boton); });
    const [id, horario] = guardarHorarioRefaccionaria.mock.calls[0];
    expect(id).toBe('R-1');
    expect(Object.keys(horario)).toHaveLength(7);
    expect(horario.lunes).toEqual({ abierto: true, apertura: '09:00', cierre: '19:30' });
    expect(horario.domingo.abierto).toBe(true);
    expect(screen.getByRole('status')).toHaveTextContent('Horario guardado.');
  });
});
