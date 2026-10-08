// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

let config = null;
let falla = false;
const getDoc = vi.fn(async () => {
  if (falla) throw new Error('sin red');
  return { exists: () => config !== null, data: () => config };
});
vi.mock('firebase/firestore', () => ({ doc: (...a) => a.join('/'), getDoc: (...a) => getDoc(...a) }));
vi.mock('./lib/firebase', () => ({ db: 'db' }));

const PLACEHOLDER = 'Tu WhatsApp (opcional, para avisarte si no hay stock)';

// La bandera se cachea por módulo: cada prueba importa el componente de nuevo.
async function cargar() {
  vi.resetModules();
  return (await import('./CampoWhatsappBusqueda.js')).default;
}

afterEach(() => { cleanup(); config = null; falla = false; getDoc.mockClear(); });

describe('campo viejo de WhatsApp del buscador con IA', () => {
  it('sin config/pedidosClientes: el campo sigue igual que hoy y funciona', async () => {
    const Campo = await cargar();
    const onChange = vi.fn();
    render(<Campo value="" onChange={onChange} />);
    await waitFor(() => expect(getDoc).toHaveBeenCalledTimes(1));
    const input = screen.getByPlaceholderText(PLACEHOLDER);
    expect(input).toHaveClass('mecanix-input');
    fireEvent.change(input, { target: { value: '6641234567' } });
    expect(onChange).toHaveBeenCalled();
  });
  it('con habilitado false, o si la lectura falla: el campo sigue', async () => {
    config = { habilitado: false };
    let Campo = await cargar();
    render(<Campo value="" onChange={() => {}} />);
    await waitFor(() => expect(getDoc).toHaveBeenCalled());
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeInTheDocument();
    cleanup();
    falla = true;
    Campo = await cargar();
    render(<Campo value="" onChange={() => {}} />);
    await waitFor(() => expect(getDoc).toHaveBeenCalledTimes(2));
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeInTheDocument();
  });
  it('con config/pedidosClientes.habilitado == true: el campo desaparece', async () => {
    config = { habilitado: true };
    const Campo = await cargar();
    render(<Campo value="" onChange={() => {}} />);
    await waitFor(() => expect(screen.queryByPlaceholderText(PLACEHOLDER)).not.toBeInTheDocument());
  });
});
