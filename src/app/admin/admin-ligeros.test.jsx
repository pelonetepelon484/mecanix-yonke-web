// @vitest-environment jsdom
// /admin: etiqueta y filtro de yonkes ligeros, y al eliminar uno el número queda libre.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const CORREO_INTERNO = '6641234567@yonkes.mecanixyonkevirtual.com';
const liberarNumero = vi.fn(async () => ({ huella: true, cuenta: true }));
let usuariosDelYonke;
const YONKES = [
  { id: 'Y1', nombre: 'Yonke Completo', activo: true, estado: 'baja-california', ciudad: 'tijuana', plan: 'freemium' },
  { id: 'YL', nombre: 'Yonke Ligero', activo: true, estado: 'sonora', plan: 'freemium', tipoRegistro: 'ligero' },
];
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../lib/firebase', () => ({ auth: {}, db: {}, storage: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  doc: (_db, ...ruta) => ({ ruta: ruta.join('/') }), collection: (_db, ...ruta) => ruta.join('/'),
  query: (r) => r, where: () => null, orderBy: () => null, limit: () => null, Timestamp: {}, deleteField: vi.fn(),
  onSnapshot: (_q, cb) => { cb({ docs: YONKES.map((y) => ({ id: y.id, data: () => y })) }); return () => {}; },
  getDoc: vi.fn(async () => ({ exists: () => false })),
  getDocs: vi.fn(async (r) => ({
    size: r === 'usuarios' ? usuariosDelYonke.length : 0,
    docs: r === 'usuarios' ? usuariosDelYonke.map((u) => ({ id: u.id, data: () => u, ref: { ruta: `usuarios/${u.id}` } })) : [],
  })),
  updateDoc: vi.fn(), setDoc: vi.fn(), deleteDoc: vi.fn(async () => {}), writeBatch: vi.fn(),
  getCountFromServer: vi.fn(async () => ({ data: () => ({ count: 0 }) })),
}));
vi.mock('../lib/estados', () => ({ ESTADO_DEFAULT: 'baja-california', estadoDeYonke: (y) => y.estado, cargarEstados: async () => [] }));
vi.mock('../lib/subirLogoYonke', () => ({ borrarLogoYonke: vi.fn(async () => {}) }));
vi.mock('../lib/borrarCarpetaStorage', () => ({ borrarCarpetaStorage: vi.fn(async () => 0) }));
vi.mock('../lib/YonkeActividadBadge', () => ({ default: () => null }));
vi.mock('./liberarNumero', () => ({ liberarNumero: (...a) => liberarNumero(...a) }));

const { default: AdminPage } = await import('./page.js');

beforeEach(() => { usuariosDelYonke = [{ id: 'uidL', rol: 'yonkeLigero', yonkeId: 'YL', email: CORREO_INTERNO }]; });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

async function eliminar(nombre) {
  const titulo = await screen.findByText(nombre);
  const botones = screen.getAllByRole('button', { name: /Eliminar yonke completo/ });
  const propio = botones.find((b) => b.compareDocumentPosition(titulo) & Node.DOCUMENT_POSITION_PRECEDING);
  fireEvent.click(propio);
  const continuar = await screen.findByRole('button', { name: 'Continuar' });
  await waitFor(() => expect(continuar).toBeEnabled());
  fireEvent.click(continuar);
  const campos = await screen.findAllByRole('textbox');
  fireEvent.change(campos.at(-1), { target: { value: 'ELIMINAR' } });
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }));
  await screen.findByRole('button', { name: 'Cerrar' });
}

describe('lista de yonkes en /admin', () => {
  it('etiqueta los ligeros y filtra por tipo, con su conteo', async () => {
    render(<AdminPage />);
    expect(await screen.findByText('⚡ Ligero')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Ligeros (1)' })).toBeInTheDocument();
    const filtro = screen.getByLabelText('Filtrar por tipo de registro');
    fireEvent.change(filtro, { target: { value: 'ligeros' } });
    expect(screen.getByText('Yonke Ligero')).toBeInTheDocument();
    expect(screen.queryByText('Yonke Completo')).not.toBeInTheDocument();
    fireEvent.change(filtro, { target: { value: 'completos' } });
    expect(screen.getByText('Yonke Completo')).toBeInTheDocument();
    expect(screen.queryByText('Yonke Ligero')).not.toBeInTheDocument();
  });
});

describe('eliminar un yonke deja su número libre', () => {
  it('cuenta con WhatsApp: libera el número antes de borrar el usuario, y no pide borrarla a mano', async () => {
    render(<AdminPage />);
    await eliminar('Yonke Ligero');
    expect(liberarNumero).toHaveBeenCalledWith('uidL');
    expect(await screen.findByText(/Número de WhatsApp liberado/)).toBeInTheDocument();
    expect(screen.queryByText(CORREO_INTERNO)).not.toBeInTheDocument();
    expect(screen.queryByText(/elimina manualmente/)).not.toBeInTheDocument();
  });
  it('si falta la llave: lo reporta y recuerda borrar la cuenta a mano', async () => {
    liberarNumero.mockResolvedValueOnce({ huella: true, cuenta: false });
    render(<AdminPage />);
    await eliminar('Yonke Ligero');
    expect(await screen.findByText(/Falta la llave de Google/)).toBeInTheDocument();
    expect(screen.getByText(CORREO_INTERNO)).toBeInTheDocument();
  });
  it('cuenta con correo normal: no llama a liberar, igual que siempre', async () => {
    usuariosDelYonke = [{ id: 'uidC', rol: 'yonke', yonkeId: 'Y1', email: 'real@correo.mx' }];
    render(<AdminPage />);
    await eliminar('Yonke Completo');
    expect(liberarNumero).not.toHaveBeenCalled();
    expect(screen.getByText('real@correo.mx')).toBeInTheDocument();
  });
});
