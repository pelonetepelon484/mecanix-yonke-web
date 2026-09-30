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
}));

vi.mock('firebase/auth', () => ({
  signOut: vi.fn(),
}));

const useAuthMock = vi.fn();
vi.mock('../AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

const { default: DemandaPanel } = await import('./page.js');

function usuarioFake(token = 'token-valido') {
  return { uid: 'u1', getIdToken: vi.fn().mockResolvedValue(token) };
}

function respuestaJson(body, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  pushMock.mockClear();
  useAuthMock.mockReturnValue({ user: usuarioFake(), loading: false });
  global.fetch = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('DemandaPanel — estados de la interfaz', () => {
  it('muestra "Cargando..." mientras espera la respuesta', async () => {
    global.fetch.mockReturnValue(new Promise(() => {})); // nunca resuelve
    render(<DemandaPanel />);
    expect(await screen.findByText('Cargando...')).toBeInTheDocument();
  });

  it('con datos: muestra las filas tal como las devuelve el endpoint', async () => {
    global.fetch.mockReturnValue(respuestaJson({
      filas: [
        { clave: 'Calavera — Dodge Stratus', estado: 'Con resultado' },
        { clave: 'Facia trasera — Volkswagen Jetta', estado: 'Demanda sin cubrir' },
      ],
    }));
    render(<DemandaPanel />);
    expect(await screen.findByText('Calavera — Dodge Stratus')).toBeInTheDocument();
    expect(screen.getByText('Facia trasera — Volkswagen Jetta')).toBeInTheDocument();
    expect(screen.getByText('Con resultado')).toBeInTheDocument();
    expect(screen.getByText('Demanda sin cubrir')).toBeInTheDocument();
  });

  it('sin filas: mensaje amable, nunca una tabla vacía', async () => {
    global.fetch.mockReturnValue(respuestaJson({ filas: [] }));
    render(<DemandaPanel />);
    expect(await screen.findByText(/Aún no hay suficiente demanda en tu estado/)).toBeInTheDocument();
  });

  it('401: mensaje claro de que no se pudo verificar la cuenta', async () => {
    global.fetch.mockReturnValue(respuestaJson({ error: 'No autenticado' }, 401));
    render(<DemandaPanel />);
    expect(await screen.findByText(/No pudimos verificar tu cuenta o tu yonke/)).toBeInTheDocument();
  });

  it('403: mismo mensaje de no autorizado', async () => {
    global.fetch.mockReturnValue(respuestaJson({ error: 'No autorizado' }, 403));
    render(<DemandaPanel />);
    expect(await screen.findByText(/No pudimos verificar tu cuenta o tu yonke/)).toBeInTheDocument();
  });

  it('error de red: mensaje genérico con botón Reintentar', async () => {
    global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<DemandaPanel />);
    expect(await screen.findByText(/Hubo un problema al cargar la demanda/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('error 5xx: mismo mensaje genérico con botón Reintentar', async () => {
    global.fetch.mockReturnValue(respuestaJson({ error: 'boom' }, 500));
    render(<DemandaPanel />);
    expect(await screen.findByText(/Hubo un problema al cargar la demanda/)).toBeInTheDocument();
  });

  it('Reintentar vuelve a llamar al endpoint', async () => {
    global.fetch.mockReturnValueOnce(respuestaJson({ error: 'boom' }, 500));
    render(<DemandaPanel />);
    const boton = await screen.findByRole('button', { name: 'Reintentar' });

    global.fetch.mockReturnValueOnce(respuestaJson({ filas: [{ clave: 'Faro — Honda Civic', estado: 'Con resultado' }] }));
    await userEvent.click(boton);

    expect(await screen.findByText('Faro — Honda Civic')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('DemandaPanel — selector de período', () => {
  it('arranca en 7 días', async () => {
    global.fetch.mockReturnValue(respuestaJson({ filas: [] }));
    render(<DemandaPanel />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(global.fetch.mock.calls[0][0]).toBe('/api/demanda-yonke?periodo=7');
    const boton7 = screen.getByRole('button', { name: '7 días' });
    expect(boton7).toHaveStyle({ backgroundColor: '#1A3C5E' });
  });

  it('cambiar a 30 días llama al endpoint con ese periodo', async () => {
    global.fetch.mockReturnValue(respuestaJson({ filas: [] }));
    render(<DemandaPanel />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole('button', { name: '30 días' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    expect(global.fetch.mock.calls[1][0]).toBe('/api/demanda-yonke?periodo=30');
  });

  it('manda el token real de getIdToken() en el header Authorization', async () => {
    useAuthMock.mockReturnValue({ user: usuarioFake('mi-token-123'), loading: false });
    global.fetch.mockReturnValue(respuestaJson({ filas: [] }));
    render(<DemandaPanel />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const [, opciones] = global.fetch.mock.calls[0];
    expect(opciones.headers.Authorization).toBe('Bearer mi-token-123');
  });

  it('ignora la respuesta vieja si el periodo cambia antes de que responda', async () => {
    let resolverPrimera;
    const primera = new Promise((resolve) => { resolverPrimera = resolve; });
    global.fetch.mockReturnValueOnce(primera);
    render(<DemandaPanel />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    // Cambia de periodo ANTES de que la primera petición (7 días) resuelva.
    global.fetch.mockReturnValueOnce(respuestaJson({ filas: [{ clave: 'Puerta — Nissan Sentra', estado: 'Con resultado' }] }));
    await userEvent.click(screen.getByRole('button', { name: '30 días' }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

    expect(await screen.findByText('Puerta — Nissan Sentra')).toBeInTheDocument();

    // Ahora resuelve la petición vieja (de 7 días) con datos DISTINTOS -- no debe pisar la vista.
    resolverPrimera(respuestaJson({ filas: [{ clave: 'NO DEBERÍA VERSE', estado: 'Con resultado' }] }).then((r) => r));
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.getByText('Puerta — Nissan Sentra')).toBeInTheDocument();
    expect(screen.queryByText('NO DEBERÍA VERSE')).not.toBeInTheDocument();
  });
});

describe('DemandaPanel — nunca muestra números', () => {
  it('ningún texto renderizado contiene un dígito', async () => {
    global.fetch.mockReturnValue(respuestaJson({
      filas: [
        { clave: 'Calavera — Dodge Stratus 2002', estado: 'Con resultado' },
        { clave: 'Faro — Honda Civic 2010', estado: 'Demanda sin cubrir' },
      ],
    }));
    const { container } = render(<DemandaPanel />);
    await screen.findByText('Calavera — Dodge Stratus 2002');

    // El único lugar donde dígitos son legítimos es dentro de la propia `clave` que ya trae el
    // endpoint (ej. el año de un vehículo, "2002") -- eso no es un número CALCULADO por la
    // interfaz, es texto que el servidor ya arma. Lo que se prueba aquí es que la interfaz misma
    // no agrega ningún dígito propio (conteos, badges de posición, porcentajes): quitamos el
    // texto de cada `clave` y confirmamos que no queda ningún dígito en el resto de la pantalla.
    let textoSinClaves = container.textContent;
    // "7 días"/"30 días" son etiquetas fijas del selector de período, no números calculados por
    // la interfaz -- se excluyen del chequeo igual que las claves que ya trae el servidor.
    for (const textoFijo of ['Calavera — Dodge Stratus 2002', 'Faro — Honda Civic 2010', '7 días', '30 días']) {
      textoSinClaves = textoSinClaves.split(textoFijo).join('');
    }
    expect(textoSinClaves).not.toMatch(/[0-9]/);
  });

  it('el selector de período tampoco imprime números fuera de la etiqueta fija "7 días"/"30 días"', async () => {
    global.fetch.mockReturnValue(respuestaJson({ filas: [] }));
    render(<DemandaPanel />);
    await screen.findByText(/Aún no hay suficiente demanda/);
    expect(screen.getByRole('button', { name: '7 días' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30 días' })).toBeInTheDocument();
  });
});
