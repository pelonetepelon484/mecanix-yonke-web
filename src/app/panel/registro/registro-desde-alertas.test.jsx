// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Registro de yonke que llega desde la ventana de alertas de la portada o su "Yo la tengo".
const escrituras = [];
let configTerminos = null; // config/terminosYonkes simulado (null = no existe)
let configPlanes = null; // config/planes simulado
const orden = [];
const replace = vi.fn((ruta) => orden.push(['replace', ruta]));
const recargarRol = vi.fn(async () => { orden.push(['recargarRol']); return 'yonke'; });
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace }) }));
vi.mock('../AuthContext', () => ({ useAuth: () => ({ recargarRol }) }));
vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: async () => ({ user: { uid: 'uidY1', getIdToken: async () => 'pase-del-yonke' } }),
}));
vi.mock('firebase/firestore', () => ({
  // doc(collection(db, 'yonkes')) = id nuevo: se simula con un objeto { id } que dice su ruta.
  doc: (_db, ...ruta) => (typeof _db === 'string' && ruta.length === 0 ? { id: 'Y1', toString: () => `${_db}/Y1` } : ruta.join('/')),
  collection: (_db, ...ruta) => ruta.join('/'),
  addDoc: async (ruta, datos) => { escrituras.push([ruta, datos]); return { id: 'Y1' }; },
  setDoc: async (ruta, datos) => { escrituras.push([String(ruta), datos]); },
  getDoc: async (ruta) => {
    const datos = ruta === 'config/planes' ? configPlanes : configTerminos;
    return datos ? { exists: () => true, data: () => datos } : { exists: () => false };
  },
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
const { TEXTO_REGISTRO_ALERTAS } = await import('../../../lib/alertasRecientes');
const ID = 'Pedido00000000000007';

beforeEach(() => {
  escrituras.length = 0; orden.length = 0; replace.mockClear(); recargarRol.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', async (ruta) => ({
    ok: true,
    json: async () => (String(ruta).startsWith('/api/pedidos-abiertos')
      ? { ok: true, pedido: { id: ID, pieza: 'Alternador', vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2005 }, estado: 'baja-california', estadoNombre: 'Baja California' } }
      : { ok: true }),
  }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });

function llenarYRegistrar() {
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

describe('registro desde las alertas de la portada', () => {
  it('sin ?desde=alertas no sale el mensaje', async () => {
    window.history.replaceState(null, '', '/panel/registro');
    render(<Registro />);
    await screen.findByText('REGISTRA TU YONKE');
    expect(screen.queryByText(TEXTO_REGISTRO_ALERTAS)).not.toBeInTheDocument();
  });

  it('con "Yo la tengo": mensaje, la alerta, y al terminar vuelve a leer la cuenta ANTES de ir a contestarla', async () => {
    window.history.replaceState(null, '', `/panel/registro?pedido=${ID}&desde=alertas`);
    render(<Registro />);
    expect(await screen.findByText(TEXTO_REGISTRO_ALERTAS)).toBeInTheDocument();
    expect(await screen.findByText(/Te registras para responder: Alternador/)).toBeInTheDocument();
    llenarYRegistrar();
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/panel/reservaciones?pedido=${ID}`));
    expect(orden).toEqual([['recargarRol'], ['replace', `/panel/reservaciones?pedido=${ID}`]]);
    // Sigue naciendo activo: puede contestar de inmediato.
    expect(escrituras.find(([ruta]) => ruta === 'yonkes/Y1')[1]).toMatchObject({ activo: true, estado: 'baja-california' });
  });
});
