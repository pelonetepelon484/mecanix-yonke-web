// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

let ficha;
const actualizar = vi.fn(async () => {});
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }), useParams: () => ({ id: 'YL' }) }));
vi.mock('../../../lib/firebase', () => ({ auth: {}, db: {}, storage: {} }));
vi.mock('firebase/auth', () => ({ sendPasswordResetEmail: vi.fn(), getAuth: vi.fn(), createUserWithEmailAndPassword: vi.fn(), signOut: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  doc: (_db, ...ruta) => ruta.join('/'), collection: (_db, ...ruta) => ruta.join('/'),
  query: (r) => r, where: () => null, deleteField: () => 'BORRAR',
  Timestamp: { fromDate: (d) => d },
  getDoc: vi.fn(async (ruta) => ({ exists: () => ruta === 'yonkes/YL', data: () => ficha, id: 'YL' })),
  getDocs: vi.fn(async () => ({ docs: [], empty: true, size: 0 })),
  updateDoc: (...a) => actualizar(...a), setDoc: vi.fn(), deleteDoc: vi.fn(), writeBatch: () => ({ set: vi.fn(), update: vi.fn(), commit: vi.fn() }),
}));
vi.mock('../../../lib/estados', () => ({ ESTADO_DEFAULT: 'baja-california', cargarEstados: async () => [{ id: 'baja-california', nombre: 'Baja California' }] }));
vi.mock('../../../lib/subirLogoYonke', () => ({ subirLogoYonke: vi.fn(), borrarLogoYonke: vi.fn(), validarArchivoLogo: () => null }));
vi.mock('../../../panel/FondoTenantEditor', () => ({ default: () => null }));
vi.mock('../../../lib/generarSubdominio', () => ({ generarSubdominioUnico: vi.fn() }));
vi.mock('../../../lib/crearUsuarioYonke', () => ({ crearUsuarioYonkeSinDeslogear: vi.fn() }));

const { default: EditarYonke } = await import('./page.js');

beforeEach(() => {
  ficha = { nombre: 'Yonke Ligero', whatsapp: '6641234567', estado: 'baja-california', activo: true, plan: 'freemium', tipoRegistro: 'ligero' };
  window.alert = vi.fn();
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('editar un yonke en el admin', () => {
  it('ligero: sin insignias ni plan, con la nota', async () => {
    render(<EditarYonke />);
    expect(await screen.findByRole('note')).toHaveTextContent('registro ligero');
    expect(screen.queryByText(/Yonke verificado/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Subdominio activo/)).not.toBeInTheDocument();
    expect(screen.queryByText('Plan')).not.toBeInTheDocument();
    expect(screen.getByText('✓ Activo')).toBeInTheDocument();
  });
  it('ligero: guarda aunque no tenga ciudad ni dirección, y solo nombre, WhatsApp y activo', async () => {
    render(<EditarYonke />);
    await screen.findByRole('note');
    fireEvent.click(screen.getByRole('button', { name: /Guardar/ }));
    await waitFor(() => expect(actualizar).toHaveBeenCalledWith('yonkes/YL', { nombre: 'Yonke Ligero', whatsapp: '6641234567', activo: true }));
    expect(push).toHaveBeenCalledWith('/admin');
  });
  it('un yonke completo sigue viendo sus insignias', async () => {
    ficha = { ...ficha, tipoRegistro: 'completo', ciudad: 'tijuana', direccion: 'Calle 1', telefono: '664' };
    render(<EditarYonke />);
    expect(await screen.findByText(/Yonke verificado/)).toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});
