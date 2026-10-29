// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const push = vi.fn();
const orden = [];
const pedirPremiumGratis = vi.fn(async () => { orden.push('promo'); return { otorgada: true }; });
const registrarTaller = vi.fn(async () => { orden.push('registro'); return { uid: 'u1', tallerId: 'T1', aceptada: true }; });
const getIdToken = vi.fn(async () => 'pase-del-taller');
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock('../../AuthContext', () => ({ useAuth: () => ({ recargarRol: vi.fn(async () => { orden.push('rol'); return 'taller'; }) }) }));
vi.mock('../../../lib/firebase', () => ({ auth: { currentUser: { getIdToken } }, db: {} }));
vi.mock('firebase/auth', () => ({ createUserWithEmailAndPassword: vi.fn(), deleteUser: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), doc: vi.fn(() => ({ id: 'x' })), deleteDoc: vi.fn(), serverTimestamp: vi.fn(), setDoc: vi.fn(),
}));
vi.mock('../cotizaciones/datos', () => ({ aceptarVersion: vi.fn(), leerConfigCotizaciones: vi.fn(async () => ({ terminosVersion: 'v1', avisoTallerVersion: 'a1' })) }));
vi.mock('../../../../lib/registrarTaller', async (original) => ({ ...(await original()), registrarTaller: (...a) => registrarTaller(...a) }));
vi.mock('../../../lib/premiumGratis/pedirPremiumGratis', () => ({ pedirPremiumGratis: (...a) => pedirPremiumGratis(...a) }));

const { default: RegistroTaller } = await import('./page.js');

beforeEach(() => { vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1'); orden.length = 0; push.mockClear(); pedirPremiumGratis.mockClear(); });
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

function llenarYRegistrar() {
  const { container } = render(<RegistroTaller />);
  const campos = container.querySelectorAll('input:not([type="checkbox"])');
  ['Taller Uno', '6641234567', 'Tijuana', 'taller@prueba.mx', 'secreta123', 'secreta123']
    .forEach((v, i) => fireEvent.change(campos[i], { target: { value: v } }));
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Registrar taller' }));
}

describe('registro de taller y la promoción Premium gratis', () => {
  it('después de registrar pide la promoción con el pase del taller, y luego entra al panel', async () => {
    llenarYRegistrar();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/panel/taller'));
    expect(orden).toEqual(['registro', 'promo', 'rol']);
    const { obtenerToken } = pedirPremiumGratis.mock.calls[0][0];
    expect(await obtenerToken()).toBe('pase-del-taller');
  });

  it('si no hay promoción (falló dos veces, apagada, ya usada), el registro sigue igual como Básico', async () => {
    pedirPremiumGratis.mockImplementationOnce(async () => ({ otorgada: false, motivo: 'red' }));
    llenarYRegistrar();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/panel/taller'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
