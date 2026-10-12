// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// El aviso de "nuevo yonke registrado" va con el pase de sesión del yonke (ya tiene sesión al
// terminar el registro) y, si falla, el registro termina igual.
const escrituras = [];
let configTerminos = null; // config/terminosYonkes simulado (null = no existe)
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: async () => ({ user: { uid: 'uidY1', getIdToken: async () => 'pase-del-yonke' } }),
}));
vi.mock('firebase/firestore', () => ({
  // doc(collection(db, 'yonkes')) = id nuevo: se simula con un objeto { id } que dice su ruta.
  doc: (_db, ...ruta) => (typeof _db === 'string' && ruta.length === 0 ? { id: 'Y1', toString: () => `${_db}/Y1` } : ruta.join('/')),
  collection: (_db, ...ruta) => ruta.join('/'),
  addDoc: async (ruta, datos) => { escrituras.push([ruta, datos]); return { id: 'Y1' }; },
  setDoc: async (ruta, datos) => { escrituras.push([String(ruta), datos]); },
  getDoc: async () => (configTerminos ? { exists: () => true, data: () => configTerminos } : { exists: () => false }),
  serverTimestamp: () => 'HORA_SERVIDOR',
  writeBatch: () => {
    const pendientes = [];
    return {
      set: (ruta, datos) => pendientes.push([String(ruta), datos]),
      update: (ruta, datos) => pendientes.push([String(ruta), datos]),
      commit: async () => { escrituras.push(...pendientes); },
    };
  },
}));
vi.mock('../../lib/firebase', () => ({ auth: {}, db: {} }));
vi.mock('../../lib/estados', () => ({ ESTADO_DEFAULT: 'baja-california', cargarEstados: async () => [{ id: 'baja-california', nombre: 'Baja California' }] }));
vi.mock('../../lib/generarSubdominio', () => ({ generarSubdominioUnico: async () => 'yonke-nuevo' }));
vi.mock('../../lib/subirLogoYonke', () => ({ subirLogoYonke: async () => null, validarArchivoLogo: () => null }));

const { default: Registro } = await import('./page.js');
const { VERSION_LEGAL } = await import('../../../lib/versionesLegales');

let llamadas;
beforeEach(() => {
  escrituras.length = 0;
  configTerminos = null;
  llamadas = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function llenarYRegistrar() {
  render(<Registro />);
  const escribir = (placeholder, valor, i = 0) => fireEvent.change(screen.getAllByPlaceholderText(placeholder)[i], { target: { value: valor } });
  escribir('Ej. Yonke El Tigre', 'Yonke Nuevo');
  escribir('Calle, colonia, referencias', 'Calle 1');
  escribir('664 000 0000', '6641234567');
  escribir('tucorreo@ejemplo.com', 'yonke@ejemplo.com');
  escribir('••••••••', 'secreto1', 0);
  escribir('••••••••', 'secreto1', 1);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta gratis' }));
}

describe('registro de yonke: aviso al admin', () => {
  it('manda SOLO el pase de sesión del yonke (no sus datos) después de guardar su ficha y su usuario', async () => {
    vi.stubGlobal('fetch', async (ruta, opciones) => { llamadas.push([ruta, opciones]); return { ok: true, json: async () => ({ ok: true, avisado: true }) }; });
    llenarYRegistrar();
    expect(await screen.findByText('¡Registro exitoso!')).toBeInTheDocument();
    const aviso = llamadas.find(([ruta]) => ruta === '/api/notificar-registro');
    expect(aviso[1].headers.Authorization).toBe('Bearer pase-del-yonke');
    expect(JSON.parse(aviso[1].body)).toEqual({});
    expect(escrituras.map(([ruta]) => ruta)).toEqual(expect.arrayContaining(['yonkes/Y1', `yonkes/Y1/aceptaciones/${VERSION_LEGAL}`, 'usuarios/uidY1']));
  });
  it('si el aviso falla (sin red), el registro termina igual', async () => {
    vi.stubGlobal('fetch', async () => { throw new TypeError('Failed to fetch'); });
    llenarYRegistrar();
    expect(await screen.findByText('¡Registro exitoso!')).toBeInTheDocument();
  });
  it('si el servidor dice "límite" o "no disponible", el registro termina igual', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 429, json: async () => ({ ok: false, avisado: false, motivo: 'limite' }) }));
    llenarYRegistrar();
    expect(await screen.findByText('¡Registro exitoso!')).toBeInTheDocument();
  });
});

describe('registro de yonke: aceptación de Términos', () => {
  beforeEach(() => { vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ({ ok: true }) })); });
  it('sin config/terminosYonkes: aceptacionLegal + historial con VERSION_LEGAL, en un solo guardado', async () => {
    llenarYRegistrar();
    expect(await screen.findByText('¡Registro exitoso!')).toBeInTheDocument();
    const ficha = escrituras.find(([ruta]) => ruta === 'yonkes/Y1')[1];
    expect(ficha.aceptacionLegal).toEqual({ version: VERSION_LEGAL, fecha: 'HORA_SERVIDOR' });
    expect(escrituras.find(([ruta]) => ruta === `yonkes/Y1/aceptaciones/${VERSION_LEGAL}`)[1]).toEqual({ version: VERSION_LEGAL, fecha: 'HORA_SERVIDOR' });
  });
  it('con config/terminosYonkes: usa SU versión (la que exigen las reglas), no VERSION_LEGAL', async () => {
    configTerminos = { version: '2099-01-01', resumenCambios: 'x' };
    llenarYRegistrar();
    expect(await screen.findByText('¡Registro exitoso!')).toBeInTheDocument();
    expect(escrituras.find(([ruta]) => ruta === 'yonkes/Y1')[1].aceptacionLegal.version).toBe('2099-01-01');
    expect(escrituras.map(([ruta]) => ruta)).toContain('yonkes/Y1/aceptaciones/2099-01-01');
  });
});
