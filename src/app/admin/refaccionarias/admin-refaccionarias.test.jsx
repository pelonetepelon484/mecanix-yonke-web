// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// admin/refaccionarias: lista y lo que solo el admin decide (activo, Verificado, prueba y pago; sin
// plan Básico), con el estado de cada cuenta y sus días restantes.
const updateDoc = vi.fn(async () => {});
let lista = [];
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: () => 'refaccionarias', doc: (_db, ...p) => p.join('/'),
  getDocs: vi.fn(async () => ({ docs: lista.map((r) => ({ id: r.id, data: () => r })) })),
  updateDoc: (...a) => updateDoc(...a),
  deleteField: () => 'BORRAR', Timestamp: { fromDate: (d) => ({ fecha: d.toISOString().slice(0, 10) }) },
}));

const { default: AdminRefaccionarias } = await import('./page.js');
afterEach(() => { cleanup(); updateDoc.mockClear(); vi.useRealTimers(); });

const base = { id: 'R1', nombre: 'El Pistón', ciudad: 'Tijuana', estado: 'baja-california', whatsapp: '6641234567', activo: true, aceptacionVersion: 'ref-1' };
const ts = (iso) => ({ toDate: () => new Date(`${iso}T00:00:00`) });

describe('admin/refaccionarias', () => {
  it('sin refaccionarias: lo dice', async () => {
    lista = [];
    render(<AdminRefaccionarias />);
    expect(await screen.findByText('Todavía no hay refaccionarias.')).toBeInTheDocument();
  });
  it('sin mención a plan Básico ni Premium', async () => {
    lista = [base];
    render(<AdminRefaccionarias />);
    await screen.findByText('El Pistón');
    expect(screen.queryByText(/Básico|Premium/)).not.toBeInTheDocument();
  });
  it('recién registrada: "Sin activar"; iniciar la prueba pone 3 meses y guarda activo, Verificado y pruebaHasta', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-27T12:00:00'));
    lista = [base];
    render(<AdminRefaccionarias />);
    expect(await screen.findByText('El Pistón')).toBeInTheDocument();
    expect(screen.getByText(/Términos aceptados: ref-1/)).toBeInTheDocument();
    expect(screen.getByText('⏸️ Sin activar')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar prueba de 3 meses desde hoy' }));
    expect(screen.getByLabelText(/Prueba vence el/)).toHaveValue('2027-01-27');
    expect(screen.getByText('🧪 Prueba vigente · quedan 92 días')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Insignia Verificado'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Guardar' })); });
    expect(updateDoc).toHaveBeenCalledWith('refaccionarias/R1', {
      activo: true, verificado: true, pruebaHasta: { fecha: '2027-01-27' }, premiumHasta: 'BORRAR', plan: 'BORRAR',
    });
  });
  it('prueba vencida: muestra los días que se conservan; al asignar el pago queda "Pago vigente" y guarda plan pago', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-27T12:00:00'));
    lista = [{ ...base, pruebaHasta: ts('2026-10-17') }];
    render(<AdminRefaccionarias />);
    expect(await screen.findByText(/Vencida · se conservan sus datos 80 días más/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Iniciar prueba/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Pago vence el/), { target: { value: '2027-10-27' } });
    expect(screen.getByText(/⭐ Pago vigente · quedan 365 días/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Activa'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Guardar' })); });
    expect(updateDoc).toHaveBeenCalledWith('refaccionarias/R1', {
      activo: false, verificado: false, pruebaHasta: { fecha: '2026-10-17' }, premiumHasta: { fecha: '2027-10-27' }, plan: 'pago',
    });
  });
  it('vencida hace más de 90 días: marcada para borrado', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-27T12:00:00'));
    lista = [{ ...base, pruebaHasta: ts('2026-06-01') }];
    render(<AdminRefaccionarias />);
    expect(await screen.findByText(/para borrado/)).toBeInTheDocument();
  });
});
