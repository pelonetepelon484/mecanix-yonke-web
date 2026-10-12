// @vitest-environment jsdom
// Reaceptación de Términos por los yonkes: aviso ACEPTO arriba del panel, pantallas en solo
// lectura sin términos vigentes y el cálculo de "aceptado" a partir de config/terminosYonkes.
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => '/panel/inventario' }));
vi.mock('../lib/firebase', () => ({ auth: {}, db: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn(), onAuthStateChanged: vi.fn() }));
vi.mock('./BottomNav', () => ({ default: () => null }));

const getDocMock = vi.fn();
const lote = { set: vi.fn(), update: vi.fn(), commit: vi.fn(async () => {}) };
let vehiculos = [];
vi.mock('firebase/firestore', () => ({
  doc: (_db, ...ruta) => ruta.join('/'),
  collection: (_db, ...ruta) => ruta.join('/'),
  query: (ref) => ref,
  orderBy: () => null,
  where: () => null,
  limit: () => null,
  onSnapshot: (ref, cb) => {
    cb({ docs: (String(ref).endsWith('vehiculos') ? vehiculos : []).map((v) => ({ id: v.id, data: () => v })) });
    return () => {};
  },
  getDoc: (...a) => getDocMock(...a),
  getDocs: async () => ({ docs: [], empty: true }),
  addDoc: vi.fn(), updateDoc: vi.fn(), setDoc: vi.fn(), deleteDoc: vi.fn(), runTransaction: vi.fn(),
  deleteField: () => 'BORRAR', serverTimestamp: () => 'HORA_SERVIDOR',
  writeBatch: () => lote,
  Timestamp: { fromDate: (d) => d, now: () => new Date() },
}));

const useAuthMock = vi.fn();
vi.mock('./AuthContext', () => ({ useAuth: () => useAuthMock() }));

const { terminosAceptados, versionParaAceptar, leerTerminosYonkes, TEXTO_BLOQUEO_TERMINOS_YONKE } = await import('./terminosYonke');
const { VERSION_LEGAL } = await import('../../lib/versionesLegales');
const { default: AvisoTerminosYonke } = await import('./AvisoTerminosYonke');
const { BloqueoTerminos } = await import('./BloqueoTerminos');
const { default: Inventario } = await import('./inventario/page.js');
const { default: VentaManual } = await import('./venta-manual/page.js');

const sesionYonke = (extra = {}) => ({
  user: { uid: 'o1' }, userRole: 'yonke', yonkeId: 'Y1', yonkePlan: 'premium', loading: false,
  terminosYonke: { requerida: true, version: '2026-11-01', resumenCambios: 'Cambió la sección 4 (garantías).', aceptada: false },
  puedeEditarYonke: false, marcarTerminosAceptados: vi.fn(), ...extra,
});

beforeEach(() => {
  vehiculos = [{ id: 'V1', marca: 'Nissan', modelo: 'Sentra', ano: 2005, disponible: true }];
  lote.set.mockClear(); lote.update.mockClear(); lote.commit.mockClear();
  getDocMock.mockReset();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('cálculo de "aceptado" (config/terminosYonkes)', () => {
  const conDoc = { existe: true, version: 'v2', resumenCambios: '' };
  it('sin documento: no se exige nada y se usa VERSION_LEGAL', () => {
    expect(terminosAceptados({}, { existe: false })).toBe(true);
    expect(versionParaAceptar({ existe: false })).toBe(VERSION_LEGAL);
  });
  it('con documento: solo la versión del documento cuenta; sin aceptacionLegal = no aceptado', () => {
    expect(versionParaAceptar(conDoc)).toBe('v2');
    expect(terminosAceptados({ aceptacionLegal: { version: 'v2' } }, conDoc)).toBe(true);
    expect(terminosAceptados({ aceptacionLegal: { version: 'v1' } }, conDoc)).toBe(false);
    expect(terminosAceptados({}, conDoc)).toBe(false);
    expect(terminosAceptados(null, conDoc)).toBe(false);
  });
  it('lee version y resumenCambios del documento', async () => {
    getDocMock.mockResolvedValueOnce({ exists: () => true, data: () => ({ version: 'v2', resumenCambios: 'Texto' }) });
    expect(await leerTerminosYonkes({})).toEqual({ existe: true, version: 'v2', resumenCambios: 'Texto' });
    getDocMock.mockResolvedValueOnce({ exists: () => false });
    expect(await leerTerminosYonkes({})).toEqual({ existe: false, version: null, resumenCambios: '' });
  });
});

describe('aviso ACEPTO arriba del panel', () => {
  it('muestra el resumen de cambios del documento y el mensaje de solo lectura', () => {
    useAuthMock.mockReturnValue(sesionYonke());
    render(<AvisoTerminosYonke />);
    expect(screen.getByText('Cambió la sección 4 (garantías).')).toBeInTheDocument();
    expect(screen.getByText(TEXTO_BLOQUEO_TERMINOS_YONKE)).toBeInTheDocument();
  });
  it('el botón solo se activa con ACEPTO (mayúsculas o minúsculas, con espacios a los lados)', () => {
    useAuthMock.mockReturnValue(sesionYonke());
    render(<AvisoTerminosYonke />);
    const campo = screen.getByLabelText('Para aceptar, escribe la palabra ACEPTO');
    const boton = screen.getByRole('button', { name: 'Acepto los términos vigentes' });
    expect(boton).toBeDisabled();
    for (const malo of ['ACEPTA', 'SI', 'A CEPTO', '']) {
      fireEvent.change(campo, { target: { value: malo } });
      expect(boton).toBeDisabled();
    }
    for (const bueno of ['ACEPTO', 'acepto', '  Acepto  ']) {
      fireEvent.change(campo, { target: { value: bueno } });
      expect(boton).toBeEnabled();
    }
  });
  it('al aceptar guarda historial + aceptacionLegal con la versión del documento y desbloquea', async () => {
    const sesion = sesionYonke();
    useAuthMock.mockReturnValue(sesion);
    render(<AvisoTerminosYonke />);
    fireEvent.change(screen.getByLabelText('Para aceptar, escribe la palabra ACEPTO'), { target: { value: ' acepto ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Acepto los términos vigentes' }));
    await waitFor(() => expect(sesion.marcarTerminosAceptados).toHaveBeenCalled());
    expect(lote.set).toHaveBeenCalledWith('yonkes/Y1/aceptaciones/2026-11-01', { version: '2026-11-01', fecha: 'HORA_SERVIDOR' });
    expect(lote.update).toHaveBeenCalledWith('yonkes/Y1', { aceptacionLegal: { version: '2026-11-01', fecha: 'HORA_SERVIDOR' } });
    expect(lote.commit).toHaveBeenCalledTimes(1);
  });
  it('si falla, avisa y no desbloquea', async () => {
    const sesion = sesionYonke();
    useAuthMock.mockReturnValue(sesion);
    lote.commit.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'permission-denied' }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<AvisoTerminosYonke />);
    fireEvent.change(screen.getByLabelText('Para aceptar, escribe la palabra ACEPTO'), { target: { value: 'ACEPTO' } });
    fireEvent.click(screen.getByRole('button', { name: 'Acepto los términos vigentes' }));
    expect(await screen.findByText('No pudimos registrar tu aceptación. Intenta de nuevo.')).toBeInTheDocument();
    expect(sesion.marcarTerminosAceptados).not.toHaveBeenCalled();
  });
  it('no aparece si ya aceptó, si no hay documento, ni para el admin o un taller', () => {
    for (const extra of [
      { puedeEditarYonke: true, terminosYonke: { requerida: true, version: '2026-11-01', aceptada: true } },
      { puedeEditarYonke: true, terminosYonke: null },
      { userRole: 'admin', puedeEditarYonke: true },
      { userRole: 'taller', yonkeId: null, puedeEditarYonke: true },
    ]) {
      useAuthMock.mockReturnValue(sesionYonke(extra));
      const { container } = render(<AvisoTerminosYonke />);
      expect(container).toBeEmptyDOMElement();
      cleanup();
    }
  });
});

describe('pantallas sin términos vigentes', () => {
  it('BloqueoTerminos: se ve pero desactivado, con el mensaje', () => {
    useAuthMock.mockReturnValue(sesionYonke());
    render(<BloqueoTerminos><button>Guardar cambios</button></BloqueoTerminos>);
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
    expect(screen.getByText(TEXTO_BLOQUEO_TERMINOS_YONKE)).toBeInTheDocument();
  });
  it('BloqueoTerminos: con términos vigentes no cambia nada', () => {
    useAuthMock.mockReturnValue(sesionYonke({ puedeEditarYonke: true }));
    render(<BloqueoTerminos><button>Guardar cambios</button></BloqueoTerminos>);
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
    expect(screen.queryByText(TEXTO_BLOQUEO_TERMINOS_YONKE)).not.toBeInTheDocument();
  });
  it('inventario: se ven los vehículos, pero sin agregar, editar, sacar ni eliminar', () => {
    useAuthMock.mockReturnValue(sesionYonke());
    render(<Inventario />);
    expect(screen.getByText('Nissan Sentra')).toBeInTheDocument();
    expect(screen.getByText(TEXTO_BLOQUEO_TERMINOS_YONKE)).toBeInTheDocument();
    for (const nombre of ['🚗 Agregar vehículo', 'Editar', 'Sacar del inventario', 'Eliminar (error de captura)']) {
      expect(screen.queryByRole('button', { name: nombre })).not.toBeInTheDocument();
    }
  });
  it('inventario con términos vigentes: todo igual que siempre', () => {
    useAuthMock.mockReturnValue(sesionYonke({ puedeEditarYonke: true }));
    render(<Inventario />);
    expect(screen.queryByText(TEXTO_BLOQUEO_TERMINOS_YONKE)).not.toBeInTheDocument();
    for (const nombre of ['🚗 Agregar vehículo', 'Editar', 'Sacar del inventario', 'Eliminar (error de captura)']) {
      expect(screen.getByRole('button', { name: nombre })).toBeInTheDocument();
    }
  });
  it('venta manual: muestra el mensaje en lugar del formulario', () => {
    useAuthMock.mockReturnValue(sesionYonke());
    getDocMock.mockResolvedValue({ exists: () => false, data: () => ({}) });
    render(<VentaManual />);
    expect(screen.getByText(TEXTO_BLOQUEO_TERMINOS_YONKE)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /registrar/i })).not.toBeInTheDocument();
  });
});
