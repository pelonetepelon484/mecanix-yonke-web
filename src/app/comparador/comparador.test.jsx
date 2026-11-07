// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

let config = null;
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));
vi.mock('../lib/firebase-server', () => ({ dbServer: {} }));
vi.mock('../lib/firebase', () => ({ auth: {} }));
let usuarioActual = null;
vi.mock('firebase/auth', () => ({ onAuthStateChanged: (_a, cb) => { cb(usuarioActual); return () => {}; } }));
vi.mock('firebase/firestore', () => ({
  doc: (_db, ...p) => p.join('/'),
  getDoc: vi.fn(async () => (config ? { exists: () => true, data: () => config } : { exists: () => false, data: () => ({}) })),
}));

const { default: Pagina, generateMetadata } = await import('./page.js');
const { default: ComparadorClient, ayudaVin } = await import('./ComparadorClient.js');
const { default: ResultadosComparador } = await import('./ResultadosComparador.js');
const { default: TarjetaComparador } = await import('./TarjetaComparador.js');
const { AVISO_COMPARADOR, MENSAJES_COMPARADOR, RESULTADOS, TEXTO_BOTON_COMPARADOR, compararVehiculos, vehiculoDesdeVpic } = await import('../../lib/comparadorPiezas');

const VIN_A = '3N1CN7AP5FL812345';
const VIN_B = '3N1CN7AP7FL899999';
beforeEach(() => { config = null; usuarioActual = null; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('servidor', () => {
  it('bandera apagada (o sin documento): 404 y noindex', async () => {
    for (const c of [null, { habilitado: false }, { habilitado: 'true' }]) {
      config = c;
      await expect(Pagina()).rejects.toThrow('NOT_FOUND');
      expect((await generateMetadata()).robots).toMatchObject({ index: false });
    }
  });
  it('encendida: la página, con "requerir login" de la misma configuración', async () => {
    config = { habilitado: true, requiereLogin: true };
    const el = await Pagina();
    expect(el.props.requiereLogin).toBe(true);
    expect((await generateMetadata()).robots).toBeUndefined();
  });
});

describe('tarjeta de la portada', () => {
  it('lleva a /comparador con su texto', () => {
    render(<TarjetaComparador />);
    expect(screen.getByRole('link', { name: new RegExp(TEXTO_BOTON_COMPARADOR) })).toHaveAttribute('href', '/comparador');
  });
});

describe('captura', () => {
  it('aviso visible, ayuda del VIN al escribir y validación antes de enviar', async () => {
    const red = vi.spyOn(globalThis, 'fetch');
    render(<ComparadorClient />);
    expect(screen.getByRole('note')).toHaveTextContent(AVISO_COMPARADOR);
    expect(ayudaVin('3N1CN7AP5FL8')).toBe('Faltan 5 caracteres.');
    expect(ayudaVin('3N1CN7AP5FL81234O')).toMatch(/no lleva I, O ni Q/);
    expect(ayudaVin(VIN_A)).toBe('✓ Formato correcto');
    fireEvent.change(screen.getByLabelText('Tipo de pieza'), { target: { value: 'motor' } });
    fireEvent.change(screen.getAllByLabelText('VIN (17 caracteres)')[0], { target: { value: VIN_A } });
    fireEvent.click(screen.getByRole('button', { name: '🔎 Comparar' }));
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAJES_COMPARADOR.nada);
    expect(red).not.toHaveBeenCalled();
  });

  it('manda los datos por POST (nunca en la dirección) y muestra los resultados', async () => {
    const va = vehiculoDesdeVpic({ Make: 'NISSAN', Model: 'Versa', ModelYear: '2015', DisplacementL: '1.6', EngineCylinders: '4' });
    const respuesta = {
      tipo: 'motor', resultado: RESULTADOS.probable, nota: null, motivos: ['Los datos de los VIN coinciden en lo que importa para esta pieza.'],
      vehiculoA: { vin: '3N1CN7AP5FL••••••', parte: '', estado: 'ok', datos: va },
      vehiculoB: { vin: '3N1CN7AP7FL••••••', parte: '', estado: 'sin_datos', datos: null },
      comparacion: compararVehiculos(va, { sinDatos: true }),
    };
    const red = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => respuesta });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<ComparadorClient />);
    fireEvent.change(screen.getByLabelText('Tipo de pieza'), { target: { value: 'motor' } });
    fireEvent.change(screen.getAllByLabelText('VIN (17 caracteres)')[0], { target: { value: VIN_A.toLowerCase() } });
    fireEvent.change(screen.getAllByLabelText('VIN (17 caracteres)')[1], { target: { value: VIN_B } });
    fireEvent.click(screen.getByRole('button', { name: '🔎 Comparar' }));
    expect(await screen.findByText('Analizando…')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(await screen.findByRole('heading', { name: 'Probable, confirmar con el yonke' })).toBeInTheDocument();
    const [url, opciones] = red.mock.calls[0];
    expect(url).toBe('/api/comparador');
    expect(opciones.method).toBe('POST');
    expect(JSON.parse(opciones.body)).toMatchObject({ tipo: 'motor', vinA: VIN_A, vinB: VIN_B });
    expect(screen.getByRole('note')).toHaveTextContent(AVISO_COMPARADOR);
    expect(within(screen.getByRole('region', { name: 'Vehículo B' })).getByText('Sin datos de VIN')).toBeInTheDocument();
  });

  it('al llegar al límite: mensaje amable y botones para iniciar sesión o registrarse', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, json: async () => ({ error: MENSAJES_COMPARADOR.limite, limite: true, conCuenta: false }) });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<ComparadorClient conTalleres />);
    fireEvent.change(screen.getByLabelText('Tipo de pieza'), { target: { value: 'frenos' } });
    fireEvent.change(screen.getAllByLabelText('Número de parte')[0], { target: { value: 'ABC123' } });
    fireEvent.change(screen.getAllByLabelText('Número de parte')[1], { target: { value: 'ABC123' } });
    fireEvent.click(screen.getByRole('button', { name: '🔎 Comparar' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(MENSAJES_COMPARADOR.limite);
    expect(within(alerta).getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/panel');
    expect(within(alerta).getByRole('link', { name: 'Registrar mi taller' })).toHaveAttribute('href', '/panel/taller/registro');
  });
});

describe('resultados', () => {
  it('solo datos reales: "Sin datos" en lo vacío y el porcentaje con lo comparado', () => {
    const a = vehiculoDesdeVpic({ Make: 'NISSAN', Model: 'Versa', ModelYear: '2015', DisplacementL: '1.6', EngineCylinders: '4' });
    const b = vehiculoDesdeVpic({ Make: 'NISSAN', Model: 'Versa', ModelYear: '2016', DisplacementL: '1.6', EngineCylinders: '4' });
    render(<ResultadosComparador resultado={{
      tipo: 'suspension', resultado: RESULTADOS.indeterminado, nota: null, motivos: [],
      vehiculoA: { vin: 'X', estado: 'ok', datos: a }, vehiculoB: { vin: 'Y', estado: 'ok', datos: b }, comparacion: compararVehiculos(a, b),
    }} />);
    expect(screen.getByText(/4 de 5 campos comparados coinciden/)).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Vehículo A' })).getAllByText('Sin datos')).toHaveLength(7);
    expect(screen.getByText('Tecnología Mecanix')).toBeInTheDocument();
  });
  it('computadora con el mismo número de parte: nota de programación', () => {
    render(<ResultadosComparador resultado={{
      tipo: 'computadora', resultado: RESULTADOS.compatible, nota: 'Compatible en número de parte, puede requerir programación o verificación.', motivos: [],
      vehiculoA: { vin: '', parte: 'ABC123', estado: 'sin_vin', datos: null }, vehiculoB: { vin: '', parte: 'ABC123', estado: 'sin_vin', datos: null }, comparacion: null,
    }} />);
    expect(screen.getByText('Compatible en número de parte, puede requerir programación o verificación.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
