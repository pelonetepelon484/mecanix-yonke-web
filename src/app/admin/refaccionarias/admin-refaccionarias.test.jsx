// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// admin/refaccionarias: lista y lo que solo el admin decide (activo, Verificado, plan y vencimiento).
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
afterEach(() => { cleanup(); updateDoc.mockClear(); });

describe('admin/refaccionarias', () => {
  it('sin refaccionarias: lo dice', async () => {
    lista = [];
    render(<AdminRefaccionarias />);
    expect(await screen.findByText('Todavía no hay refaccionarias.')).toBeInTheDocument();
  });
  it('muestra cada una y guarda activo, Verificado, plan y vencimiento en un solo cambio', async () => {
    lista = [{ id: 'R1', nombre: 'El Pistón', ciudad: 'Tijuana', estado: 'baja-california', whatsapp: '6641234567', activo: true, aceptacionVersion: 'ref-1' }];
    render(<AdminRefaccionarias />);
    expect(await screen.findByText('El Pistón')).toBeInTheDocument();
    expect(screen.getByText(/Términos aceptados: ref-1/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Insignia Verificado'));
    fireEvent.click(screen.getByLabelText('Activa'));
    fireEvent.click(screen.getByRole('button', { name: '⭐ Premium' }));
    fireEvent.change(screen.getByLabelText(/Premium vence el/), { target: { value: '2027-01-31' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Guardar' })); });
    expect(updateDoc).toHaveBeenCalledWith('refaccionarias/R1', { activo: false, verificado: true, plan: 'premium', premiumHasta: { fecha: '2027-01-31' } });
  });
});
