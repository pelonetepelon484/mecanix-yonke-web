// @vitest-environment jsdom
// Pantalla de entrada: correo como siempre o, para yonkes ligeros, WhatsApp. Con
// config/yonkesLigeros apagada los textos son los de siempre; entrar con el número funciona igual.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const push = vi.fn();
const entrar = vi.fn(async () => {});
const recuperar = vi.fn(async () => ({ ok: true }));
let config = null;
let sesion = { user: null, userRole: null, loading: false };
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock('../lib/firebase', () => ({ auth: 'auth', db: 'db' }));
vi.mock('firebase/auth', () => ({ signInWithEmailAndPassword: (...a) => entrar(...a) }));
vi.mock('firebase/firestore', () => ({
  doc: (...a) => a.slice(1).join('/'),
  getDoc: vi.fn(async () => (config ? { exists: () => true, data: () => config } : { exists: () => false })),
}));
vi.mock('../lib/passwordReset', () => ({ enviarRecuperacionPassword: (...a) => recuperar(...a) }));
vi.mock('./AuthContext', () => ({ useAuth: () => sesion }));

const { default: PanelLogin } = await import('./page.js');
const INTERNO = '6641234567@yonkes.mecanixyonkevirtual.com';

beforeEach(() => { config = null; sesion = { user: null, userRole: null, loading: false }; window.alert = vi.fn(); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const llenar = (usuario, placeholder = 'Correo electrónico') => {
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value: usuario } });
  fireEvent.change(screen.getByPlaceholderText('Contraseña'), { target: { value: 'clave1234' } });
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
};

describe('entrar', () => {
  it('apagada: la pantalla de siempre, y el correo entra igual que hoy', async () => {
    render(<PanelLogin />);
    await waitFor(() => expect(screen.getByPlaceholderText('Correo electrónico')).toHaveAttribute('type', 'email'));
    llenar('  yonke@correo.mx ');
    await waitFor(() => expect(entrar).toHaveBeenCalledWith('auth', 'yonke@correo.mx', 'clave1234'));
  });
  it('encendida: pide correo o WhatsApp, y el número entra con su correo interno', async () => {
    config = { habilitado: true };
    render(<PanelLogin />);
    const campo = await screen.findByPlaceholderText('Correo o WhatsApp');
    expect(campo).toHaveAttribute('type', 'text');
    llenar('664 123 4567', 'Correo o WhatsApp');
    await waitFor(() => expect(entrar).toHaveBeenCalledWith('auth', INTERNO, 'clave1234'));
  });
  it('solo true exacto enciende los textos', async () => {
    config = { habilitado: 'true' };
    render(<PanelLogin />);
    await new Promise((r) => { setTimeout(r, 10); });
    expect(screen.getByPlaceholderText('Correo electrónico')).toBeInTheDocument();
  });
  it('el error dice WhatsApp o correo según lo que escribió', async () => {
    entrar.mockRejectedValueOnce(new Error('x'));
    config = { habilitado: true };
    render(<PanelLogin />);
    await screen.findByPlaceholderText('Correo o WhatsApp');
    llenar('6641234567', 'Correo o WhatsApp');
    expect(await screen.findByText('WhatsApp o contraseña incorrectos')).toBeInTheDocument();
    entrar.mockRejectedValueOnce(new Error('x'));
    llenar('a@b.mx', 'Correo o WhatsApp');
    expect(await screen.findByText('Correo o contraseña incorrectos')).toBeInTheDocument();
  });
  it('con sesión: el ligero va a Pedidos y el yonke a Inventario', async () => {
    sesion = { user: { uid: 'l' }, userRole: 'yonkeLigero', loading: false };
    render(<PanelLogin />);
    expect(push).toHaveBeenCalledWith('/panel/reservaciones');
    push.mockClear();
    cleanup();
    sesion = { user: { uid: 'y' }, userRole: 'yonke', loading: false };
    render(<PanelLogin />);
    expect(push).toHaveBeenCalledWith('/panel/inventario');
  });
});

describe('olvidé mi contraseña', () => {
  const abrir = () => fireEvent.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));

  it('con correo: el enlace por correo de siempre', async () => {
    render(<PanelLogin />);
    fireEvent.change(screen.getByPlaceholderText('Correo electrónico'), { target: { value: 'a@b.mx' } });
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(recuperar).toHaveBeenCalledWith('a@b.mx'));
  });
  it('con WhatsApp: no manda correo; lleva a tu WhatsApp con su número', async () => {
    config = { habilitado: true };
    render(<PanelLogin />);
    fireEvent.change(await screen.findByPlaceholderText('Correo o WhatsApp'), { target: { value: '664 123 4567' } });
    abrir();
    const enlace = screen.getByRole('link', { name: 'Escribir por WhatsApp' });
    expect(enlace.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/526611034260\?text=/);
    expect(decodeURIComponent(enlace.getAttribute('href'))).toContain('6641234567');
    expect(screen.queryByRole('button', { name: 'Enviar' })).not.toBeInTheDocument();
    expect(recuperar).not.toHaveBeenCalled();
  });
});
