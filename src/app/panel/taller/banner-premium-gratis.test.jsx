// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

let datosTaller = {};
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('../../lib/firebase', () => ({ auth: {}, db: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), getDoc: vi.fn(async () => ({ exists: () => true, data: () => datosTaller })) }));
vi.mock('../AuthContext', () => ({ useAuth: () => ({ tallerId: 'T1' }) }));
vi.mock('./cotizaciones/datos', () => ({ leerConfigCotizaciones: vi.fn(async () => ({ terminosVersion: 'v1' })), aceptarVersion: vi.fn() }));
vi.mock('../solicitudesPiezasDatos', () => ({ leerConfigSolicitudesPiezas: vi.fn(async () => null) }));
vi.mock('./ordenes/datos', () => ({ leerConfigOrdenes: vi.fn(async () => null) }));
vi.mock('./historial/datos', () => ({ leerConfigHistorial: vi.fn(async () => null) }));

const { default: PanelTaller } = await import('./page.js');

const base = { nombre: 'Taller Uno', aceptacionVersion: 'v1', activo: true };
const ts = (iso) => ({ toDate: () => new Date(iso) });

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-29T18:00:00Z'));
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('banner "Premium gratis" en el inicio del taller', () => {
  it('promoción con más de 15 días: fecha, días y lo que incluye', async () => {
    datosTaller = { ...base, plan: 'premium', premiumOrigen: 'promo', premiumHasta: ts('2027-01-29T18:00:00Z') };
    render(<PanelTaller />);
    expect(await screen.findByText(/Tienes Premium gratis hasta el 29 de enero de 2027 · te quedan 92 días/)).toBeInTheDocument();
    expect(screen.getByText(/órdenes de servicio, historial de servicios, recordatorios de mantenimiento y seguimiento de órdenes/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('data-por-vencer', 'no');
  });

  it('con 15 días o menos: cambia de color y explica la vuelta a Básico', async () => {
    datosTaller = { ...base, plan: 'premium', premiumOrigen: 'promo', premiumHasta: ts('2026-11-08T18:00:00Z') };
    render(<PanelTaller />);
    expect(await screen.findByText(/Tu Premium gratis vence el 8 de noviembre de 2026 · te quedan 10 días/)).toBeInTheDocument();
    expect(screen.getByText(/Al vencer volverás al plan Básico/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('data-por-vencer', 'si');
  });

  it('sin banner: Premium del admin, Premium sin fecha, promoción vencida o Básico', async () => {
    for (const extra of [
      { plan: 'premium', premiumOrigen: 'admin', premiumHasta: ts('2027-01-29T18:00:00Z') },
      { plan: 'premium', premiumOrigen: 'promo', premiumHasta: '' },
      { plan: 'premium', premiumOrigen: 'promo', premiumHasta: ts('2026-10-01T00:00:00Z') },
      {},
    ]) {
      datosTaller = { ...base, ...extra };
      render(<PanelTaller />);
      expect(await screen.findByText('Taller Uno')).toBeInTheDocument();
      expect(screen.queryByText(/Premium gratis/)).not.toBeInTheDocument();
      cleanup();
    }
  });
});
