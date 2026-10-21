// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

let porVencer = [];
let porBorrarse = [];
let telefono = '6641112233';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('./historial/datos', () => ({
  listarPorVencer: async () => porVencer,
  listarPorBorrarse: async () => porBorrarse,
  recordatoriosDe: (v) => v.recordatorios,
  telefonoDeOrden: vi.fn(async () => telefono),
}));
const { default: ServiciosPorVencer } = await import('./ServiciosPorVencer.js');

const ayer = Date.now() - 86400000;
const vehiculo = {
  id: 'V1', placas: 'ABC123', marca: 'Nissan', modelo: 'Sentra', anio: 2001, ultimoFolio: 'O1',
  recordatorios: [{ id: 'a', tipo: 'Cambio de aceite', fecha: ayer, avisarDiasAntes: 0, folio: 'O1', estado: 'pendiente', creadoAt: 0 }],
};
let destino = '';
const original = window.location;
afterEach(() => { cleanup(); porVencer = []; porBorrarse = []; telefono = '6641112233'; Object.defineProperty(window, 'location', { value: original, configurable: true }); });
function atraparNavegacion() {
  destino = '';
  Object.defineProperty(window, 'location', { value: { set href(v) { destino = v; }, get href() { return destino; } }, configurable: true });
}

describe('Servicios por vencer (inicio del taller)', () => {
  it('sin pendientes: lo dice; sin "Se borrarán pronto"', async () => {
    render(<ServiciosPorVencer tallerId="T1" nombreTaller="Taller Pérez" />);
    expect(await screen.findByText('No tienes servicios por vencer.')).toBeInTheDocument();
    expect(screen.queryByText(/Se borrarán pronto/)).not.toBeInTheDocument();
  });
  it('vehículo con su servicio pendiente y WhatsApp con el teléfono de la orden y el aviso de los 5 mil km', async () => {
    porVencer = [vehiculo];
    atraparNavegacion();
    render(<ServiciosPorVencer tallerId="T1" nombreTaller="Taller Pérez" />);
    expect(await screen.findByText('ABC123')).toBeInTheDocument();
    expect(screen.getByText(/Cambio de aceite/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '💬 Recordar por WhatsApp' }));
    await act(async () => {});
    expect(destino).toMatch(/^https:\/\/wa\.me\/526641112233\?text=/);
    const texto = decodeURIComponent(destino.split('text=')[1]);
    expect(texto).toContain('placas ABC123');
    expect(texto).toContain('Cambio de aceite');
    expect(texto).toContain('5 mil km');
  });
  it('si la orden ya no existe: WhatsApp sin número', async () => {
    porVencer = [vehiculo];
    telefono = null;
    atraparNavegacion();
    render(<ServiciosPorVencer tallerId="T1" nombreTaller="Taller Pérez" />);
    fireEvent.click(await screen.findByRole('button', { name: '💬 Recordar por WhatsApp' }));
    await act(async () => {});
    expect(destino).toMatch(/^https:\/\/wa\.me\/\?text=/);
  });
  it('"Se borrarán pronto" con la fecha de borrado', async () => {
    porBorrarse = [{ ...vehiculo, expiraAt: { toDate: () => new Date(2026, 10, 5) } }];
    render(<ServiciosPorVencer tallerId="T1" nombreTaller="Taller Pérez" />);
    expect(await screen.findByText(/Se borrará el 05 de noviembre de 2026/)).toBeInTheDocument();
  });
});
