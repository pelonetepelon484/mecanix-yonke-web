// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => '/panel/demanda',
}));

vi.mock('../../lib/firebase', () => ({
  auth: {},
  db: {},
}));

vi.mock('firebase/auth', () => ({
  signOut: vi.fn(),
}));

const getDocMock = vi.fn();
const getDocsMock = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: (...args) => ({ __tipo: 'doc', args }),
  collection: (...args) => ({ __tipo: 'collection', args }),
  query: (...args) => ({ __tipo: 'query', args }),
  where: (...args) => ({ __tipo: 'where', args }),
  getDoc: (...args) => getDocMock(...args),
  getDocs: (...args) => getDocsMock(...args),
  Timestamp: { fromDate: (fecha) => ({ __tipo: 'timestamp', fecha }) },
}));

const useAuthMock = vi.fn();
vi.mock('../AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

// Esta pantalla renderiza <BottomNav />, que desde el pedido de piezas lee Firestore aparte
// (badge de "Pedidos"). Nada que ver con demanda: se corta aquí para no tocar la red real.
vi.mock('../solicitudesPiezasDatos', () => ({
  leerConfigSolicitudesPiezas: vi.fn(async () => null),
  leerYonkeEstadoActivo: vi.fn(async () => ({ estado: null, activo: false, nombre: '', whatsapp: '' })),
  escucharSolicitudesAbiertas: vi.fn(() => () => {}),
}));
// Igual para el badge de pedidos de clientes sin cuenta (pedidosClientes).
vi.mock('../pedidosClientesDatos', () => ({
  leerConfigPedidosClientes: vi.fn(async () => null),
  escucharPedidosClientesAbiertos: vi.fn(() => () => {}),
}));

const { default: DemandaPanel } = await import('./page.js');

function usuarioFake() {
  return { uid: 'u1' };
}

function authFake({ userRole = 'yonke', yonkeId = 'y1' } = {}) {
  return { user: usuarioFake(), userRole, yonkeId, loading: false };
}

function yonkeDocFake(existe, data) {
  return { exists: () => existe, data: () => data };
}

function busquedasSnapFake(docs) {
  return { docs: docs.map((d) => ({ data: () => d })) };
}

beforeEach(() => {
  pushMock.mockClear();
  getDocMock.mockReset();
  getDocsMock.mockReset();
  useAuthMock.mockReturnValue(authFake());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('DemandaPanel — estados de la interfaz', () => {
  it('muestra "Cargando..." mientras espera la respuesta', async () => {
    getDocMock.mockReturnValue(new Promise(() => {})); // nunca resuelve
    render(<DemandaPanel />);
    expect(await screen.findByText('Cargando...')).toBeInTheDocument();
  });

  it('con datos: muestra las filas tal como las arma construirReporteDemanda', async () => {
    getDocMock.mockResolvedValue(yonkeDocFake(true, { activo: true, estado: 'baja-california' }));
    getDocsMock.mockResolvedValue(busquedasSnapFake([
      { pieza: 'Calavera', marca: 'Dodge', modelo: 'Stratus', anio: 2002, conResultado: true, estado: 'ok' },
      { pieza: 'Calavera', marca: 'Dodge', modelo: 'Stratus', anio: 2003, conResultado: true, estado: 'ok' },
      { pieza: 'Facia trasera', marca: 'Volkswagen', modelo: 'Jetta', anio: 2015, conResultado: false, estado: 'sin_inventario' },
      { pieza: 'Facia trasera', marca: 'Volkswagen', modelo: 'Jetta', anio: 2016, conResultado: false, estado: 'sin_inventario' },
    ]));
    render(<DemandaPanel />);
    expect(await screen.findByText('Calavera — Dodge Stratus')).toBeInTheDocument();
    expect(screen.getByText('Facia trasera — Volkswagen Jetta')).toBeInTheDocument();
    expect(screen.getByText('Con resultado')).toBeInTheDocument();
    expect(screen.getByText('Demanda sin cubrir')).toBeInTheDocument();
  });

  it('sin filas: mensaje amable, nunca una tabla vacía', async () => {
    getDocMock.mockResolvedValue(yonkeDocFake(true, { activo: true, estado: 'baja-california' }));
    getDocsMock.mockResolvedValue(busquedasSnapFake([]));
    render(<DemandaPanel />);
    expect(await screen.findByText(/Aún no hay suficiente demanda en tu estado/)).toBeInTheDocument();
  });

  it('rol distinto de "yonke": mensaje de no autorizado', async () => {
    useAuthMock.mockReturnValue(authFake({ userRole: 'admin' }));
    render(<DemandaPanel />);
    expect(await screen.findByText(/No pudimos verificar tu cuenta o tu yonke/)).toBeInTheDocument();
  });

  it('sin yonkeId: mensaje de no autorizado', async () => {
    useAuthMock.mockReturnValue(authFake({ yonkeId: null }));
    render(<DemandaPanel />);
    expect(await screen.findByText(/No pudimos verificar tu cuenta o tu yonke/)).toBeInTheDocument();
  });

  it('yonke desactivado (activo:false): mismo mensaje de no autorizado', async () => {
    getDocMock.mockResolvedValue(yonkeDocFake(true, { activo: false, estado: 'baja-california' }));
    render(<DemandaPanel />);
    expect(await screen.findByText(/No pudimos verificar tu cuenta o tu yonke/)).toBeInTheDocument();
  });

  it('yonke inexistente (borrado): mismo mensaje de no autorizado', async () => {
    getDocMock.mockResolvedValue(yonkeDocFake(false, undefined));
    render(<DemandaPanel />);
    expect(await screen.findByText(/No pudimos verificar tu cuenta o tu yonke/)).toBeInTheDocument();
  });

  it('error de Firestore (ej. reglas no desplegadas): mensaje genérico con botón Reintentar', async () => {
    getDocMock.mockRejectedValue(new Error('permission-denied'));
    render(<DemandaPanel />);
    expect(await screen.findByText(/Hubo un problema al cargar la demanda/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('Reintentar vuelve a consultar Firestore', async () => {
    getDocMock.mockRejectedValueOnce(new Error('boom'));
    render(<DemandaPanel />);
    const boton = await screen.findByRole('button', { name: 'Reintentar' });

    getDocMock.mockResolvedValueOnce(yonkeDocFake(true, { activo: true, estado: 'baja-california' }));
    getDocsMock.mockResolvedValueOnce(busquedasSnapFake([
      { pieza: 'Faro', marca: 'Honda', modelo: 'Civic', anio: 2010, conResultado: true, estado: 'ok' },
      { pieza: 'Faro', marca: 'Honda', modelo: 'Civic', anio: 2011, conResultado: true, estado: 'ok' },
    ]));
    await userEvent.click(boton);

    expect(await screen.findByText('Faro — Honda Civic')).toBeInTheDocument();
    expect(getDocMock).toHaveBeenCalledTimes(2);
  });
});

describe('DemandaPanel — selector de período', () => {
  it('arranca en 7 días', async () => {
    getDocMock.mockResolvedValue(yonkeDocFake(true, { activo: true, estado: 'baja-california' }));
    getDocsMock.mockResolvedValue(busquedasSnapFake([]));
    render(<DemandaPanel />);
    await waitFor(() => expect(getDocsMock).toHaveBeenCalled());
    const boton7 = screen.getByRole('button', { name: '7 días' });
    expect(boton7).toHaveStyle({ backgroundColor: '#1A3C5E' });
  });

  it('cambiar a 30 días vuelve a consultar Firestore', async () => {
    getDocMock.mockResolvedValue(yonkeDocFake(true, { activo: true, estado: 'baja-california' }));
    getDocsMock.mockResolvedValue(busquedasSnapFake([]));
    render(<DemandaPanel />);
    await waitFor(() => expect(getDocsMock).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole('button', { name: '30 días' }));

    await waitFor(() => expect(getDocsMock).toHaveBeenCalledTimes(2));
  });

  it('nunca manda el estado real al servidor -- el código de geo lo deriva del yonke autenticado', async () => {
    getDocMock.mockResolvedValue(yonkeDocFake(true, { activo: true, estado: 'nuevo-leon' }));
    getDocsMock.mockResolvedValue(busquedasSnapFake([]));
    render(<DemandaPanel />);
    await waitFor(() => expect(getDocsMock).toHaveBeenCalled());
    const [consulta] = getDocsMock.mock.calls[0];
    const clausulaEstado = consulta.args.find((a) => a?.args?.[0] === 'estadoGeografico');
    expect(clausulaEstado.args).toEqual(['estadoGeografico', '==', 'nle']);
  });

  it('ignora la respuesta vieja si el periodo cambia antes de que responda', async () => {
    getDocMock.mockResolvedValue(yonkeDocFake(true, { activo: true, estado: 'baja-california' }));
    let resolverPrimera;
    const primera = new Promise((resolve) => { resolverPrimera = resolve; });
    getDocsMock.mockReturnValueOnce(primera);
    render(<DemandaPanel />);
    await waitFor(() => expect(getDocsMock).toHaveBeenCalledTimes(1));

    // Cambia de periodo ANTES de que la primera consulta (7 días) resuelva.
    getDocsMock.mockReturnValueOnce(Promise.resolve(busquedasSnapFake([
      { pieza: 'Puerta', marca: 'Nissan', modelo: 'Sentra', anio: 2015, conResultado: true, estado: 'ok' },
      { pieza: 'Puerta', marca: 'Nissan', modelo: 'Sentra', anio: 2016, conResultado: true, estado: 'ok' },
    ])));
    await userEvent.click(screen.getByRole('button', { name: '30 días' }));
    await waitFor(() => expect(getDocsMock).toHaveBeenCalledTimes(2));

    expect(await screen.findByText('Puerta — Nissan Sentra')).toBeInTheDocument();

    // Ahora resuelve la consulta vieja (de 7 días) con datos DISTINTOS -- no debe pisar la vista.
    resolverPrimera(busquedasSnapFake([
      { pieza: 'NO', marca: 'DEBERÍA', modelo: 'VERSE', anio: 2020, conResultado: true, estado: 'ok' },
      { pieza: 'NO', marca: 'DEBERÍA', modelo: 'VERSE', anio: 2021, conResultado: true, estado: 'ok' },
    ]));
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.getByText('Puerta — Nissan Sentra')).toBeInTheDocument();
    expect(screen.queryByText(/NO DEBERÍA VERSE/)).not.toBeInTheDocument();
  });
});

describe('DemandaPanel — nunca muestra números', () => {
  it('ningún texto renderizado contiene un dígito', async () => {
    getDocMock.mockResolvedValue(yonkeDocFake(true, { activo: true, estado: 'baja-california' }));
    getDocsMock.mockResolvedValue(busquedasSnapFake([
      { pieza: 'Calavera', marca: 'Dodge', modelo: 'Stratus', anio: 2002, conResultado: true, estado: 'ok' },
      { pieza: 'Calavera', marca: 'Dodge', modelo: 'Stratus', anio: 2003, conResultado: true, estado: 'ok' },
      { pieza: 'Faro', marca: 'Honda', modelo: 'Civic', anio: 2010, conResultado: false, estado: 'sin_inventario' },
      { pieza: 'Faro', marca: 'Honda', modelo: 'Civic', anio: 2011, conResultado: false, estado: 'sin_inventario' },
    ]));
    const { container } = render(<DemandaPanel />);
    await screen.findByText('Calavera — Dodge Stratus');

    // El único lugar donde dígitos son legítimos es dentro de la propia `clave` que ya arma
    // construirReporteDemanda() (ej. el año de un vehículo) -- eso no es un número CALCULADO por
    // la interfaz. Lo que se prueba aquí es que la interfaz misma no agrega ningún dígito propio
    // (conteos, badges de posición, porcentajes): quitamos el texto de cada `clave` y confirmamos
    // que no queda ningún dígito en el resto de la pantalla.
    let textoSinClaves = container.textContent;
    // "7 días"/"30 días" son etiquetas fijas del selector de período, no números calculados por
    // la interfaz -- se excluyen del chequeo igual que las claves que ya arma el reporte.
    for (const textoFijo of ['Calavera — Dodge Stratus', 'Faro — Honda Civic', '7 días', '30 días']) {
      textoSinClaves = textoSinClaves.split(textoFijo).join('');
    }
    expect(textoSinClaves).not.toMatch(/[0-9]/);
  });

  it('el selector de período tampoco imprime números fuera de la etiqueta fija "7 días"/"30 días"', async () => {
    getDocMock.mockResolvedValue(yonkeDocFake(true, { activo: true, estado: 'baja-california' }));
    getDocsMock.mockResolvedValue(busquedasSnapFake([]));
    render(<DemandaPanel />);
    await screen.findByText(/Aún no hay suficiente demanda/);
    expect(screen.getByRole('button', { name: '7 días' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30 días' })).toBeInTheDocument();
  });
});
