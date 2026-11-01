// @vitest-environment jsdom
// /panel/registro: qué pantalla sale en cada caso, y el registro ligero de punta a punta en el navegador.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const ID = 'Pedido00000000000007';
const INTERNO = '6641234567@yonkes.mecanixyonkevirtual.com';
const replace = vi.fn();
const orden = [];
const recargarRol = vi.fn(async () => { orden.push('recargarRol'); return 'yonkeLigero'; });
const entrar = vi.fn(async () => { orden.push('entrar'); });
let config;
let respuestaPedido;
let respuestaRegistro;
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace }) }));
vi.mock('../AuthContext', () => ({ useAuth: () => ({ recargarRol }) }));
vi.mock('firebase/auth', () => ({ createUserWithEmailAndPassword: vi.fn(), signInWithEmailAndPassword: (...a) => entrar(...a) }));
vi.mock('firebase/firestore', () => ({
  doc: (_db, ...ruta) => ruta.join('/'), collection: (_db, ...ruta) => ruta.join('/'), addDoc: vi.fn(), setDoc: vi.fn(), serverTimestamp: vi.fn(), writeBatch: vi.fn(),
  getDoc: vi.fn(async (ruta) => (ruta === 'config/yonkesLigeros' && config ? { exists: () => true, data: () => config } : { exists: () => false })),
}));
vi.mock('../../lib/firebase', () => ({ auth: 'auth', db: {} }));
vi.mock('../../lib/estados', () => ({ ESTADO_DEFAULT: 'baja-california', cargarEstados: async () => [{ id: 'baja-california', nombre: 'Baja California' }] }));

const { default: Registro } = await import('./page.js');
const { textoOtroEstado } = await import('./RegistroLigero');

const pedidoPublico = { id: ID, pieza: 'Alternador', vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2005 }, estado: 'sonora', estadoNombre: 'Sonora' };
const FORMULARIO_LARGO = 'REGISTRA TU YONKE';
const irA = (ruta) => window.history.replaceState(null, '', ruta);

beforeEach(() => {
  orden.length = 0; replace.mockClear(); entrar.mockClear(); recargarRol.mockClear();
  config = { habilitado: true };
  respuestaPedido = { ok: true, status: 200, cuerpo: { ok: true, pedido: pedidoPublico } };
  respuestaRegistro = { ok: true, status: 200, cuerpo: { ok: true, estado: 'sonora' } };
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async (ruta) => {
    const r = String(ruta).startsWith('/api/yonkes') ? (orden.push('servidor'), respuestaRegistro) : String(ruta).startsWith('/api/pedidos-abiertos') ? respuestaPedido : { ok: true, status: 200, cuerpo: { ok: true } };
    return { ok: r.ok, status: r.status, json: async () => r.cuerpo };
  }));
  irA(`/panel/registro?pedido=${ID}&desde=alertas`);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); irA('/'); });

function llenar({ nombre = 'Yonke Tigre', whatsapp = '664 123 4567', password = 'secreto123', casilla = true } = {}) {
  fireEvent.change(screen.getByLabelText('Nombre de tu yonke'), { target: { value: nombre } });
  fireEvent.change(screen.getByLabelText('Tu WhatsApp'), { target: { value: whatsapp } });
  fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: password } });
  if (casilla) screen.getAllByRole('checkbox').forEach((c) => fireEvent.click(c));
}
const enviar = () => fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta y responder' }));
const cuerpoEnviado = () => JSON.parse(fetch.mock.calls.find(([r]) => String(r).startsWith('/api/yonkes'))[1].body);

describe('qué pantalla sale', () => {
  it('bandera encendida y alerta abierta: el registro ligero, con la alerta y su estado', async () => {
    render(<Registro />);
    expect(await screen.findByRole('button', { name: 'Crear cuenta y responder' })).toBeInTheDocument();
    expect(screen.getByText(/Alternador · Nissan Sentra 2005/)).toBeInTheDocument();
    expect(screen.getByText('📍 Mi yonke está en Sonora')).toBeInTheDocument();
    expect(screen.getByText(/Mecanix no verifica este número mediante un código/)).toBeInTheDocument();
    expect(screen.getByText(/podrá mostrarse a los clientes que reciban tus respuestas/)).toBeInTheDocument();
    expect(screen.queryByText(FORMULARIO_LARGO)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Correo/)).not.toBeInTheDocument();
  });
  it('mientras revisa no asoma el formulario largo', async () => {
    render(<Registro />);
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
    expect(screen.queryByText(FORMULARIO_LARGO)).not.toBeInTheDocument();
    await screen.findByRole('button', { name: 'Crear cuenta y responder' });
  });
  it('bandera apagada, ausente o de texto: el registro completo', async () => {
    for (const c of [{ habilitado: false }, null, { habilitado: 'true' }]) {
      config = c;
      render(<Registro />);
      expect(await screen.findByText(FORMULARIO_LARGO)).toBeInTheDocument();
      cleanup();
    }
  });
  it('alerta vencida o error del servidor: el registro completo', async () => {
    for (const r of [{ ok: false, status: 404, cuerpo: { ok: false } }, { ok: false, status: 500, cuerpo: null }]) {
      respuestaPedido = r;
      render(<Registro />);
      expect(await screen.findByText(FORMULARIO_LARGO)).toBeInTheDocument();
      cleanup();
    }
  });
  it('sin alerta o con ?completo=1: el registro completo, sin leer la bandera', async () => {
    for (const ruta of ['/panel/registro', '/panel/registro?desde=alertas', `/panel/registro?pedido=${ID}&completo=1`]) {
      irA(ruta);
      render(<Registro />);
      expect(screen.getByText(FORMULARIO_LARGO)).toBeInTheDocument();
      cleanup();
    }
    const { getDoc } = await import('firebase/firestore');
    expect(getDoc.mock.calls.filter(([r]) => r === 'config/yonkesLigeros')).toEqual([]);
  });
});

describe('registrarse', () => {
  it('manda solo lo necesario, sin estado, entra con su WhatsApp y va directo a la alerta', async () => {
    render(<Registro />);
    await screen.findByRole('button', { name: 'Crear cuenta y responder' });
    llenar();
    enviar();
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/panel/ligero?pedido=${ID}`));
    expect(cuerpoEnviado()).toEqual({ nombre: 'Yonke Tigre', whatsapp: '6641234567', password: 'secreto123', pedidoId: ID, aceptaTerminos: true, aceptaPrivacidad: true, declaraAutorizacion: true });
    expect(entrar).toHaveBeenCalledWith('auth', INTERNO, 'secreto123');
    expect(orden).toEqual(['servidor', 'entrar', 'recargarRol']);
  });
  it('tres casillas sin marcar y con la declaración del abogado; faltando una, no se manda nada', async () => {
    render(<Registro />);
    await screen.findByRole('button', { name: 'Crear cuenta y responder' });
    const casillas = screen.getAllByRole('checkbox');
    expect(casillas).toHaveLength(3);
    casillas.forEach((c) => expect(c).not.toBeChecked());
    expect(screen.getByText(/utilizar el número de WhatsApp proporcionado, tanto para acceder a Mecanix/)).toBeInTheDocument();
    llenar({ casilla: false });
    fireEvent.click(casillas[0]);
    fireEvent.click(casillas[1]);
    enviar();
    expect((await screen.findByRole('alert')).textContent).toMatch(/Debes aceptar/);
    expect(orden).toEqual([]);
  });
  it('repite el número en grande, y solo si es válido', async () => {
    render(<Registro />);
    await screen.findByRole('button', { name: 'Crear cuenta y responder' });
    fireEvent.change(screen.getByLabelText('Tu WhatsApp'), { target: { value: '664123' } });
    expect(screen.queryByText('664 123 4567')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Tu WhatsApp'), { target: { value: '+52 6641234567' } });
    expect(screen.getByText('664 123 4567')).toBeInTheDocument();
  });
  it('el botón deja ver la contraseña', async () => {
    render(<Registro />);
    await screen.findByRole('button', { name: 'Crear cuenta y responder' });
    const campo = screen.getByLabelText(/^Contraseña/);
    expect(campo).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Ver' }));
    expect(campo).toHaveAttribute('type', 'text');
  });
  it('datos inválidos: el mensaje, sin llamar al servidor', async () => {
    render(<Registro />);
    await screen.findByRole('button', { name: 'Crear cuenta y responder' });
    llenar({ whatsapp: '123' });
    enviar();
    expect((await screen.findByRole('alert')).textContent).toMatch(/WhatsApp a 10 dígitos/);
    fireEvent.change(screen.getByLabelText('Tu WhatsApp'), { target: { value: '6641234567' } });
    screen.getAllByRole('checkbox').forEach((c) => fireEvent.click(c));
    enviar();
    expect((await screen.findByRole('alert')).textContent).toMatch(/Debes aceptar/);
    expect(orden).toEqual([]);
  });
});

describe('respuestas del servidor', () => {
  const con = async (status, cuerpo) => {
    respuestaRegistro = { ok: false, status, cuerpo };
    render(<Registro />);
    await screen.findByRole('button', { name: 'Crear cuenta y responder' });
    llenar();
    enviar();
    return screen.findByRole('alert');
  };
  it('número ya registrado: iniciar sesión sin perder la alerta', async () => {
    const aviso = await con(409, { ok: false, motivo: 'yaRegistrado', mensaje: 'Este WhatsApp ya está registrado.' });
    expect(aviso).toHaveTextContent('ya está registrado');
    expect(screen.getAllByRole('link', { name: 'Iniciar sesión' })[0]).toHaveAttribute('href', `/panel?pedido=${ID}`);
    expect(entrar).not.toHaveBeenCalled();
  });
  it('alerta vencida o límite: botón al registro completo', async () => {
    await con(410, { ok: false, motivo: 'alerta', mensaje: 'Ya no está disponible.' });
    expect(screen.getByRole('link', { name: 'Ir al registro completo' })).toHaveAttribute('href', '/panel/registro?completo=1');
    cleanup();
    await con(429, { ok: false, motivo: 'limite', mensaje: 'Límite.' });
    expect(screen.getByRole('link', { name: 'Ir al registro completo' })).toBeInTheDocument();
  });
  it('servidor caído: "intenta más tarde" y conserva lo que escribió', async () => {
    await con(503, null);
    expect(screen.getByRole('alert')).toHaveTextContent('Intenta más tarde');
    expect(screen.getByLabelText('Nombre de tu yonke')).toHaveValue('Yonke Tigre');
    expect(screen.getByLabelText('Tu WhatsApp')).toHaveValue('664 123 4567');
  });
  it('cuenta creada pero falla el inicio de sesión: a entrar, con la alerta', async () => {
    entrar.mockRejectedValueOnce(new Error('sin red'));
    render(<Registro />);
    await screen.findByRole('button', { name: 'Crear cuenta y responder' });
    llenar();
    enviar();
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/panel?pedido=${ID}`));
  });
});

describe('estoy en otro estado', () => {
  it('explica y lleva al registro completo, sin la alerta; "Regresar" conserva lo escrito', async () => {
    render(<Registro />);
    await screen.findByRole('button', { name: 'Crear cuenta y responder' });
    fireEvent.change(screen.getByLabelText('Nombre de tu yonke'), { target: { value: 'Yonke Tigre' } });
    fireEvent.click(screen.getByRole('button', { name: 'Estoy en otro estado' }));
    expect(screen.getByText(textoOtroEstado('Sonora'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Hacer mi registro' })).toHaveAttribute('href', '/panel/registro?completo=1');
    fireEvent.click(screen.getByRole('button', { name: 'Regresar' }));
    expect(screen.getByLabelText('Nombre de tu yonke')).toHaveValue('Yonke Tigre');
  });
  it('los enlaces de abajo conservan la alerta', async () => {
    render(<Registro />);
    await screen.findByRole('button', { name: 'Crear cuenta y responder' });
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', `/panel?pedido=${ID}`);
    expect(screen.getByRole('link', { name: 'Prefiero hacer el registro completo' })).toHaveAttribute('href', `/panel/registro?pedido=${ID}&completo=1`);
  });
});
