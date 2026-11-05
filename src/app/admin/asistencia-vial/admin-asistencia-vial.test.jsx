// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// admin/asistencia-vial: lista con "Por renovar", alta con lo público y lo privado por separado,
// activar/desactivar.
const setDoc = vi.fn(async () => {});
const updateDoc = vi.fn(async () => {});
let lista = [];
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../lib/firebase', () => ({ db: {} }));
vi.mock('../../lib/subirLogoYonke', () => ({ subirLogoYonke: vi.fn(async () => 'https://logo'), borrarLogoYonke: vi.fn(async () => {}) }));
vi.mock('firebase/firestore', () => ({
  collection: (_db, ...p) => p.join('/'),
  doc: (_db, ...p) => (p.length ? { ruta: p.join('/'), id: p[p.length - 1] } : { ruta: 'asistenciaVial/NUEVO', id: 'NUEVO' }),
  getDocs: vi.fn(async () => ({ docs: lista.map((r) => ({ id: r.id, data: () => r, ref: r.id })) })),
  getDoc: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
  setDoc: (...a) => setDoc(...a), updateDoc: (...a) => updateDoc(...a), deleteDoc: vi.fn(async () => {}),
  serverTimestamp: () => 'AHORA', Timestamp: { fromDate: (d) => ({ fecha: d.toISOString().slice(0, 10) }) },
}));

const { default: AdminAsistencia } = await import('./page.js');
afterEach(() => { cleanup(); setDoc.mockClear(); updateDoc.mockClear(); });

const ts = (iso) => ({ toMillis: () => new Date(`${iso}T12:00:00`).getTime(), toDate: () => new Date(`${iso}T12:00:00`) });
const base = { id: 'A1', nombre: 'Grúas Tijuana', servicios: ['grua'], ciudades: ['tijuana'], atiende24h: true, telefono: '6641234567', whatsapp: '', activo: true, documentosEnRegla: false };

describe('admin/asistencia-vial', () => {
  it('sin proveedores: lo dice', async () => {
    lista = [];
    render(<AdminAsistencia />);
    expect(await screen.findByText('Todavía no hay proveedores.')).toBeInTheDocument();
  });

  it('avisa los que tienen más de 12 meses sin revisar ("Por renovar")', async () => {
    lista = [
      { ...base, documentosEnRegla: true, fechaRevisionDocumentos: ts('2024-01-10') },
      { ...base, id: 'A2', nombre: 'Llantera Centro', documentosEnRegla: true, fechaRevisionDocumentos: ts(new Date().toISOString().slice(0, 10)) },
    ];
    render(<AdminAsistencia />);
    expect(await screen.findByText(/1 proveedor tiene los documentos por renovar/)).toBeInTheDocument();
    expect(screen.getByText(/Por renovar \(más de 12 meses\)/)).toBeInTheDocument();
    expect(screen.getByText(/^Documentos en regla/)).toBeInTheDocument();
  });

  it('alta: valida y guarda lo público y lo privado en documentos separados', async () => {
    lista = [];
    render(<AdminAsistencia />);
    fireEvent.click(await screen.findByRole('button', { name: '＋ Agregar proveedor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe el nombre del negocio');
    fireEvent.change(screen.getByLabelText('Nombre del negocio'), { target: { value: 'Grúas El Güero' } });
    fireEvent.click(screen.getByLabelText('Grúa'));
    fireEvent.click(screen.getByLabelText('Plataforma'));
    fireEvent.click(screen.getByLabelText('Tijuana'));
    fireEvent.click(screen.getByLabelText('Atiende 24 horas'));
    fireEvent.change(screen.getByLabelText('Teléfono (10 dígitos)'), { target: { value: '664 123 4567' } });
    fireEvent.change(screen.getByLabelText('Notas internas'), { target: { value: 'Lo conocí en la expo' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Guardar' })); });
    expect(setDoc).toHaveBeenCalledTimes(2);
    const [refPublico, publico] = setDoc.mock.calls[0];
    expect(refPublico.ruta).toBe('asistenciaVial/NUEVO');
    expect(publico).toMatchObject({ nombre: 'Grúas El Güero', servicios: ['grua'], tiposGrua: ['plataforma'], ciudades: ['tijuana'], atiende24h: true, telefono: '6641234567', activo: true, documentosEnRegla: false, fechaRevisionDocumentos: null });
    expect(JSON.stringify(publico)).not.toContain('expo');
    const [refPrivado, privado] = setDoc.mock.calls[1];
    expect(refPrivado.ruta).toBe('asistenciaVial/NUEVO/privado/datos');
    expect(privado).toEqual({ notasInternas: 'Lo conocí en la expo', documentosRevisados: '', contactoDueno: '' });
  });

  it('desactivar cambia solo activo', async () => {
    lista = [base];
    render(<AdminAsistencia />);
    const boton = await screen.findByRole('button', { name: 'Desactivar' });
    await act(async () => { fireEvent.click(boton); });
    expect(updateDoc).toHaveBeenCalledWith(expect.objectContaining({ ruta: 'asistenciaVial/A1' }), { activo: false, actualizadoAt: 'AHORA' });
  });
});
