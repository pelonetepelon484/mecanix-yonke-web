// @vitest-environment jsdom
// Botón "Activar avisos" / "Apagar avisos" (avisos en el dispositivo, solo Android por ahora).
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

let config;
let sesion;
const escrituras = [];
const borrados = [];
vi.mock('../lib/firebase', () => ({ db: {} }));
vi.mock('firebase/app', () => ({ getApps: () => [{ app: true }] }));
vi.mock('firebase/firestore', () => ({
  doc: (_db, ...ruta) => ruta.join('/'),
  getDoc: async () => (config ? { exists: () => true, data: () => config } : { exists: () => false }),
  setDoc: vi.fn(async (ruta, datos) => { escrituras.push([ruta, datos]); }),
  deleteDoc: vi.fn(async (ruta) => { borrados.push(ruta); }),
  serverTimestamp: () => 'HORA_SERVIDOR',
}));
const getToken = vi.fn(async () => 'token-del-celular');
const deleteToken = vi.fn(async () => true);
vi.mock('firebase/messaging', () => ({ getMessaging: () => ({}), getToken: (...a) => getToken(...a), deleteToken: (...a) => deleteToken(...a) }));
vi.mock('./AuthContext', () => ({ useAuth: () => sesion }));

const registro = { active: { state: 'activated' } };
const register = vi.fn(async () => registro);
let permiso;
function navegador({ android = true } = {}) {
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  Object.defineProperty(window.navigator, 'serviceWorker', { value: { register }, configurable: true });
  Object.defineProperty(window.navigator, 'userAgent', {
    value: android ? 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/130 Mobile' : 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1', configurable: true,
  });
  window.PushManager = function PushManager() {};
  window.Notification = { get permission() { return permiso; }, requestPermission: vi.fn(async () => permiso) };
}

async function cargar() {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_VAPID_KEY', 'clave-publica-vapid');
  return (await import('./BotonAvisos.js')).default;
}

beforeEach(() => {
  config = { habilitado: true };
  sesion = { userRole: 'yonke', yonkeId: 'Y1', puedeEditarYonke: true };
  permiso = 'granted';
  escrituras.length = 0;
  borrados.length = 0;
  window.localStorage.clear();
  register.mockClear(); getToken.mockClear(); deleteToken.mockClear();
  navegador();
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

async function huellaDe(texto) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('cuándo aparece el botón', () => {
  it('Android, función encendida y un yonke: "Activar avisos"', async () => {
    const BotonAvisos = await cargar();
    render(<BotonAvisos />);
    expect(await screen.findByRole('button', { name: 'Activar avisos' })).toBeInTheDocument();
  });
  it('también para un yonke que no ha aceptado los términos nuevos (los avisos son parte de pedidos)', async () => {
    sesion = { ...sesion, puedeEditarYonke: false };
    const BotonAvisos = await cargar();
    render(<BotonAvisos />);
    expect(await screen.findByRole('button', { name: 'Activar avisos' })).toBeInTheDocument();
  });
  it('no aparece: función apagada, sin documento, iPhone, sin clave VAPID, o quien entra no es yonke', async () => {
    const casos = [
      () => { config = { habilitado: false }; },
      () => { config = null; },
      () => { navegador({ android: false }); },
      () => { sesion = { userRole: 'taller', yonkeId: null }; },
      () => { sesion = { userRole: 'admin', yonkeId: null }; },
    ];
    for (const preparar of casos) {
      preparar();
      const BotonAvisos = await cargar();
      const { container } = render(<BotonAvisos />);
      await new Promise((r) => setTimeout(r, 10));
      expect(container).toBeEmptyDOMElement();
      cleanup();
      config = { habilitado: true }; sesion = { userRole: 'yonke', yonkeId: 'Y1' }; navegador();
    }
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_VAPID_KEY', '');
    const SinVapid = (await import('./BotonAvisos.js')).default;
    const { container } = render(<SinVapid />);
    await new Promise((r) => setTimeout(r, 10));
    expect(container).toBeEmptyDOMElement();
  });
});

describe('activar y apagar', () => {
  it('activar: pide permiso, registra el service worker de /panel/ y guarda el token ligado al yonke', async () => {
    const BotonAvisos = await cargar();
    render(<BotonAvisos />);
    fireEvent.click(await screen.findByRole('button', { name: 'Activar avisos' }));
    expect(await screen.findByRole('button', { name: 'Apagar avisos' })).toBeInTheDocument();
    expect(window.Notification.requestPermission).toHaveBeenCalled();
    expect(register).toHaveBeenCalledWith('/panel/avisos-sw.js', { scope: '/panel/' });
    expect(getToken).toHaveBeenCalledWith({}, { vapidKey: 'clave-publica-vapid', serviceWorkerRegistration: registro });
    const id = `Y1_${await huellaDe('token-del-celular')}`;
    expect(escrituras).toEqual([[`dispositivosPush/${id}`, { yonkeId: 'Y1', token: 'token-del-celular', creadoAt: 'HORA_SERVIDOR' }]]);
    expect(id).toMatch(/^Y1_[0-9a-f]{64}$/);
  });
  it('si niega el permiso: no guarda nada y explica cómo permitirlo', async () => {
    permiso = 'denied';
    const BotonAvisos = await cargar();
    render(<BotonAvisos />);
    fireEvent.click(await screen.findByRole('button', { name: 'Activar avisos' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('permite las notificaciones en los ajustes de Chrome');
    expect(escrituras).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Activar avisos' })).toBeInTheDocument();
  });
  it('apagar: borra el token de este dispositivo', async () => {
    const BotonAvisos = await cargar();
    render(<BotonAvisos />);
    fireEvent.click(await screen.findByRole('button', { name: 'Activar avisos' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Apagar avisos' }));
    expect(await screen.findByRole('button', { name: 'Activar avisos' })).toBeInTheDocument();
    expect(borrados).toEqual([`dispositivosPush/Y1_${await huellaDe('token-del-celular')}`]);
    expect(deleteToken).toHaveBeenCalled();
  });
  it('si quitó el permiso desde Chrome: al entrar se borra su token y vuelve a "Activar avisos"', async () => {
    window.localStorage.setItem('mecanix-avisos:Y1', 'Y1_abc');
    permiso = 'default';
    const BotonAvisos = await cargar();
    render(<BotonAvisos />);
    expect(await screen.findByRole('button', { name: 'Activar avisos' })).toBeInTheDocument();
    await waitFor(() => expect(borrados).toEqual(['dispositivosPush/Y1_abc']));
  });
  it('con el permiso y el token guardado: muestra "Apagar avisos"', async () => {
    window.localStorage.setItem('mecanix-avisos:Y1', 'Y1_abc');
    const BotonAvisos = await cargar();
    render(<BotonAvisos />);
    expect(await screen.findByRole('button', { name: 'Apagar avisos' })).toBeInTheDocument();
    expect(borrados).toHaveLength(0);
  });
});
