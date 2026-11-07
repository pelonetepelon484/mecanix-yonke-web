// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mapa de /asistencia-vial (bandera asistenciaVialMapa): sin bandera no pide nada; con ella junta
// las ubicaciones vigentes con los proveedores activos y "Usar mi ubicación" ordena por distancia
// sin mandar la ubicación del cliente a ningún lado.
vi.mock('../lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), setDoc: vi.fn(async () => {}), increment: (n) => n }));
const { default: AsistenciaVialClient } = await import('./AsistenciaVialClient.js');

const AHORA = Date.now();
const p = (id, extra = {}) => ({
  id, nombre: id, servicios: ['grua'], tiposGrua: [], ciudades: ['tijuana'], atiende24h: true, horario: '', telefono: '6641234567',
  whatsapp: '', descripcion: '', logoUrl: '', activo: true, documentosEnRegla: false, fechaRevisionMs: null, ...extra,
});
const proveedores = [p('Grúas Rosarito'), p('Grúas Centro'), p('Llantera Sin Punto')];
let ubicaciones = [];
const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ubicaciones }) }));

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true, value: { getCurrentPosition: (ok) => ok({ coords: { latitude: 32.53, longitude: -117.03 } }) },
  });
});
afterEach(() => { cleanup(); fetchMock.mockClear(); ubicaciones = []; vi.unstubAllGlobals(); });

describe('mapa de asistencia vial', () => {
  it('sin la bandera del mapa no pide ubicaciones', () => {
    render(<AsistenciaVialClient proveedores={proveedores} ahoraMs={AHORA} />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText('📍 En el mapa ahora')).not.toBeInTheDocument();
  });
  it('sin nadie en el mapa lo dice y deja la lista', async () => {
    render(<AsistenciaVialClient proveedores={proveedores} ahoraMs={AHORA} mapa />);
    expect(await screen.findByText(/ningún proveedor ha marcado dónde está/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/asistencia-vial/ubicaciones');
  });
  it('muestra a los que marcaron ubicación y los ordena por distancia con "Usar mi ubicación"', async () => {
    const hasta = AHORA + 60 * 60000;
    ubicaciones = [
      { proveedorId: 'Grúas Rosarito', lat: 32.366, lng: -117.062, hastaAt: hasta, actualizadoAt: AHORA - 1000 },
      { proveedorId: 'Grúas Centro', lat: 32.532, lng: -117.035, hastaAt: hasta, actualizadoAt: AHORA - 5000 },
      { proveedorId: 'Inactivo', lat: 32.5, lng: -117, hastaAt: hasta, actualizadoAt: AHORA },
    ];
    render(<AsistenciaVialClient proveedores={proveedores} ahoraMs={AHORA} mapa />);
    const seccion = await screen.findByRole('region', { name: 'En el mapa ahora' });
    const nombres = () => within(seccion).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(nombres()).toEqual(['Grúas Rosarito', 'Grúas Centro']);
    expect(within(seccion).getAllByText(/Aquí hasta las/)).toHaveLength(2);
    fireEvent.click(within(seccion).getByRole('button', { name: /Usar mi ubicación/ }));
    expect(await within(seccion).findByText(/a menos de 1 km · Aquí hasta las/)).toBeInTheDocument();
    expect(nombres()).toEqual(['Grúas Centro', 'Grúas Rosarito']);
    expect(fetchMock).toHaveBeenCalledTimes(1); // la ubicación del cliente no se manda
  });
  it('sin permiso de ubicación lo explica', async () => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (_ok, mal) => mal({ code: 1 }) } });
    ubicaciones = [{ proveedorId: 'Grúas Centro', lat: 32.532, lng: -117.035, hastaAt: AHORA + 60000, actualizadoAt: AHORA }];
    render(<AsistenciaVialClient proveedores={proveedores} ahoraMs={AHORA} mapa />);
    fireEvent.click(await screen.findByRole('button', { name: /Usar mi ubicación/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('permite que el navegador la vea');
  });
});
