// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// El aviso de "nuevo yonke registrado" va con el pase de sesión del yonke (ya tiene sesión al
// terminar el registro) y, si falla, el registro termina igual.
const escrituras = [];
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: async () => ({ user: { uid: 'uidY1', getIdToken: async () => 'pase-del-yonke' } }),
}));
vi.mock('firebase/firestore', () => ({
  doc: (_db, ...ruta) => ruta.join('/'),
  collection: (_db, ...ruta) => ruta.join('/'),
  addDoc: async (ruta, datos) => { escrituras.push([ruta, datos]); return { id: 'Y1' }; },
  setDoc: async (ruta, datos) => { escrituras.push([ruta, datos]); },
}));
vi.mock('../../lib/firebase', () => ({ auth: {}, db: {} }));
vi.mock('../../lib/estados', () => ({ ESTADO_DEFAULT: 'baja-california', cargarEstados: async () => [{ id: 'baja-california', nombre: 'Baja California' }] }));
vi.mock('../../lib/generarSubdominio', () => ({ generarSubdominioUnico: async () => 'yonke-nuevo' }));
vi.mock('../../lib/subirLogoYonke', () => ({ subirLogoYonke: async () => null, validarArchivoLogo: () => null }));

const { default: Registro } = await import('./page.js');

let llamadas;
beforeEach(() => {
  escrituras.length = 0;
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
    expect(escrituras.map(([ruta]) => ruta)).toEqual(expect.arrayContaining(['yonkes', 'usuarios/uidY1']));
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
