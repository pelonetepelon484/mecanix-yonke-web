// @vitest-environment jsdom
// Límites del plan Básico y Premium en las pantallas del panel. soloBasico viene de AuthContext
// (encendido + sin Premium vigente). Con el interruptor apagado, cada pantalla queda como antes.
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => '/panel' }));
vi.mock('../lib/firebase', () => ({ auth: {}, db: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));
vi.mock('./BottomNav', () => ({ default: () => null }));
vi.mock('./AvisoInstalarApp', () => ({ OpcionInstalarApp: () => null, default: () => null }));
vi.mock('../lib/subirLogoYonke', () => ({ subirLogoYonke: vi.fn(), borrarLogoYonke: vi.fn(), validarArchivoLogo: () => null }));
vi.mock('./PromoImagenesEditor', () => ({ default: () => <p>Editor de promociones</p> }));
vi.mock('./FondoTenantEditor', () => ({ default: () => <p>Editor de fondo</p> }));
vi.mock('./SobreNosotrosEditor', () => ({ default: () => <p>Editor sobre nosotros</p> }));

let ventas = [];
let fichaYonke = {};
const getDocsMock = vi.fn(async () => ({ docs: [], empty: true }));
vi.mock('firebase/firestore', () => ({
  doc: (_db, ...ruta) => ruta.join('/'),
  collection: (_db, ...ruta) => ruta.join('/'),
  query: (ref) => ref,
  orderBy: () => null,
  where: () => null,
  limit: () => null,
  onSnapshot: (ref, cb) => {
    cb({ docs: (ref === 'ventas' ? ventas : []).map((v) => ({ id: v.id, data: () => v })) });
    return () => {};
  },
  getDoc: async () => ({ exists: () => true, data: () => fichaYonke }),
  getDocs: (...a) => getDocsMock(...a),
  addDoc: vi.fn(), updateDoc: vi.fn(), setDoc: vi.fn(), deleteDoc: vi.fn(), runTransaction: vi.fn(),
  deleteField: () => 'BORRAR', serverTimestamp: () => 'HORA', writeBatch: () => ({ set: vi.fn(), update: vi.fn(), commit: vi.fn() }),
  Timestamp: { fromDate: (d) => d, now: () => new Date() },
}));

const useAuthMock = vi.fn();
vi.mock('./AuthContext', () => ({ useAuth: () => useAuthMock() }));

const { PRECIO_PREMIUM_TEXTO, TITULO_FUNCION_PREMIUM } = await import('../../lib/planes');
const { default: VentaManual } = await import('./venta-manual/page.js');
const { default: Ventas } = await import('./ventas/page.js');
const { default: Reciclaje } = await import('./reciclaje/page.js');
const { default: Demanda } = await import('./demanda/page.js');
const { default: Perfil } = await import('./perfil/page.js');

// Sesión de un yonke: apagado por defecto (como hoy).
const sesion = (extra = {}) => ({
  user: { uid: 'o1' }, userRole: 'yonke', yonkeId: 'Y1', yonkePlan: 'freemium', loading: false, puedeEditarYonke: true,
  limitesActivos: false, premiumVigente: false, soloBasico: false, ...extra,
});
const basicoEncendido = (extra = {}) => sesion({ limitesActivos: true, soloBasico: true, ...extra });
const premiumEncendido = (extra = {}) => sesion({ yonkePlan: 'premium', limitesActivos: true, premiumVigente: true, ...extra });
const BOTON_PRECIO = `Quiero Premium · ${PRECIO_PREMIUM_TEXTO}`;

beforeEach(() => {
  ventas = [
    { id: 'V1', reservaId: 'R1', yonkeId: 'Y1', piezaVendida: 'Faro de reservación', monto: 500, fecha: new Date() },
    { id: 'V2', origen: 'manual', yonkeId: 'Y1', piezaVendida: 'Alternador de mostrador', monto: 900, fecha: new Date() },
  ];
  fichaYonke = { nombre: 'Yonke uno', estado: 'baja-california', activo: true, subdominio: 'uno', subdominioActivo: true, plan: 'freemium' };
  getDocsMock.mockClear();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('venta manual', () => {
  it('encendido + Básico (o Premium vencido): candado con el precio', () => {
    useAuthMock.mockReturnValue(basicoEncendido({ yonkePlan: 'premium' }));
    render(<VentaManual />);
    expect(screen.getByText(TITULO_FUNCION_PREMIUM)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: BOTON_PRECIO })).toBeInTheDocument();
  });
  it('apagado + freemium: el bloqueo de siempre, sin precio (regresión)', () => {
    useAuthMock.mockReturnValue(sesion());
    render(<VentaManual />);
    expect(screen.getByText('Función del Plan Premium')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Quiero Premium' })).toBeInTheDocument();
    expect(screen.queryByText(PRECIO_PREMIUM_TEXTO, { exact: false })).not.toBeInTheDocument();
  });
  it('encendido + Premium vigente: sin candado', () => {
    useAuthMock.mockReturnValue(premiumEncendido());
    render(<VentaManual />);
    expect(screen.queryByText(TITULO_FUNCION_PREMIUM)).not.toBeInTheDocument();
    expect(screen.queryByText('Función del Plan Premium')).not.toBeInTheDocument();
  });
});

describe('Mis ventas', () => {
  it('encendido + Básico: solo las ventas de reservaciones, sin notas de garantía, con el aviso y el precio', () => {
    useAuthMock.mockReturnValue(basicoEncendido());
    render(<Ventas />);
    expect(screen.getAllByText('Faro de reservación').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Alternador de mostrador')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: '🛡️ Nota' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: BOTON_PRECIO })).toBeInTheDocument();
  });
  it('encendido + Premium vigente: historial completo y notas', () => {
    useAuthMock.mockReturnValue(premiumEncendido());
    render(<Ventas />);
    expect(screen.getAllByText('Alternador de mostrador').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: '🛡️ Nota' })).toHaveLength(2);
    expect(screen.queryByText(TITULO_FUNCION_PREMIUM, { exact: false })).not.toBeInTheDocument();
  });
  it('apagado + freemium: como hoy (todas las ventas, notas y el aviso de siempre)', () => {
    useAuthMock.mockReturnValue(sesion());
    render(<Ventas />);
    expect(screen.getAllByText('Alternador de mostrador').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: '🛡️ Nota' })).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Quiero Premium' })).toBeInTheDocument();
  });
});

describe('reciclaje', () => {
  it('encendido + Básico: candado', () => {
    useAuthMock.mockReturnValue(basicoEncendido());
    render(<Reciclaje />);
    expect(screen.getByText(TITULO_FUNCION_PREMIUM)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '🧾 Comprar' })).not.toBeInTheDocument();
  });
  it('apagado: la pantalla de siempre (regresión)', () => {
    useAuthMock.mockReturnValue(sesion());
    render(<Reciclaje />);
    expect(screen.getByRole('button', { name: '🧾 Comprar' })).toBeInTheDocument();
    expect(screen.queryByText(TITULO_FUNCION_PREMIUM)).not.toBeInTheDocument();
  });
});

describe('Demanda', () => {
  it('encendido + Básico: candado y ni siquiera consulta', async () => {
    useAuthMock.mockReturnValue(basicoEncendido());
    render(<Demanda />);
    expect(screen.getByText(TITULO_FUNCION_PREMIUM)).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 20));
    expect(getDocsMock).not.toHaveBeenCalled();
  });
  it('apagado: consulta como siempre (regresión)', async () => {
    useAuthMock.mockReturnValue(sesion());
    render(<Demanda />);
    await waitFor(() => expect(getDocsMock).toHaveBeenCalled());
    expect(screen.queryByText(TITULO_FUNCION_PREMIUM)).not.toBeInTheDocument();
  });
});

describe('Mi negocio', () => {
  it('encendido + Básico: página propia y datos fiscales con candado; logo, garantía y negocio igual', async () => {
    useAuthMock.mockReturnValue(basicoEncendido());
    render(<Perfil />);
    expect(await screen.findByText('Tu página propia')).toBeInTheDocument();
    for (const oculto of ['Color de tu página', 'Editor de promociones', 'Editor de fondo', 'Editor sobre nosotros']) {
      expect(screen.queryByText(oculto)).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'Guardar datos fiscales' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: BOTON_PRECIO })).toHaveLength(2);
    for (const visible of ['Logo del negocio', 'Condiciones de garantía', 'Información del negocio', 'Horario de atención', 'Métodos de pago que aceptas']) {
      expect(screen.getByText(visible)).toBeInTheDocument();
    }
  });
  it('apagado: todas las secciones como hoy (regresión)', async () => {
    useAuthMock.mockReturnValue(sesion());
    render(<Perfil />);
    expect(await screen.findByText('Color de tu página')).toBeInTheDocument();
    expect(screen.getByText('Editor de promociones')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar datos fiscales' })).toBeInTheDocument();
    expect(screen.queryByText('Tu página propia')).not.toBeInTheDocument();
  });
  it('encendido + Premium vigente: todas las secciones', async () => {
    useAuthMock.mockReturnValue(premiumEncendido());
    render(<Perfil />);
    expect(await screen.findByText('Color de tu página')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar datos fiscales' })).toBeInTheDocument();
  });
});
