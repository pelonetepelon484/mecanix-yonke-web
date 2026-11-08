// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// admin/equivalencias: alta de equivalencias (números limpios) y aprobar / descartar sugerencias.
const addDoc = vi.fn(async () => ({ id: 'NUEVA' }));
const updateDoc = vi.fn(async () => {});
const deleteDoc = vi.fn(async () => {});
let equivalencias = [];
let sugerencias = [];
let config = {};
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db, ...p) => p.join('/'),
  query: (col) => col,
  where: () => null,
  limit: () => null,
  doc: (_db, ...p) => p.join('/'),
  getDocs: vi.fn(async (col) => {
    const lista = col === 'sugerenciasEquivalencia' ? sugerencias : equivalencias;
    return { docs: lista.map((r) => ({ id: r.id, data: () => r })) };
  }),
  getDoc: vi.fn(async () => ({ exists: () => true, data: () => config })),
  addDoc: (...a) => addDoc(...a), updateDoc: (...a) => updateDoc(...a), deleteDoc: (...a) => deleteDoc(...a),
  serverTimestamp: () => 'AHORA',
}));

const { default: AdminEquivalencias } = await import('./page.js');
afterEach(() => { cleanup(); addDoc.mockClear(); updateDoc.mockClear(); deleteDoc.mockClear(); });

const SUGERENCIA = {
  id: 'computadora_12605843_19210736', tipoPieza: 'computadora', partes: ['12605843', '19210736'], estado: 'pendiente', confianza: 'alta',
  resumen: '19210736 reemplaza a 12605843.', partesRelacionadas: ['12615418'], fuentes: [{ url: 'https://gm.com/x', titulo: 'Catálogo GM' }],
};

describe('admin/equivalencias', () => {
  it('guarda una equivalencia con los números limpios', async () => {
    equivalencias = []; sugerencias = [];
    render(<AdminEquivalencias />);
    expect(await screen.findByText(/Todavía no hay equivalencias/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Tipo de pieza'), { target: { value: 'computadora' } });
    fireEvent.change(screen.getByLabelText(/Números de parte/), { target: { value: '12-605-843, 19210736' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(addDoc).toHaveBeenCalled());
    expect(addDoc.mock.calls[0][1]).toEqual({ clase: 'equivalencia', tipoPieza: 'computadora', partes: ['12605843', '19210736'], creadoAt: 'AHORA' });
    expect(await screen.findByText('12605843 = 19210736')).toBeInTheDocument();
  });

  it('no guarda con un solo número', async () => {
    equivalencias = []; sugerencias = [];
    render(<AdminEquivalencias />);
    await screen.findByText(/Todavía no hay equivalencias/);
    fireEvent.change(screen.getByLabelText(/Números de parte/), { target: { value: '12605843' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('al menos dos números');
    expect(addDoc).not.toHaveBeenCalled();
  });

  it('dice si la búsqueda automática está apagada', async () => {
    equivalencias = []; sugerencias = []; config = {};
    render(<AdminEquivalencias />);
    fireEvent.click(await screen.findByRole('tab', { name: /Sugerencias/ }));
    expect(screen.getByText(/Búsqueda automática APAGADA/)).toBeInTheDocument();
  });

  it('"Revisar y aprobar" llena el formulario y al guardar marca la sugerencia como aprobada', async () => {
    equivalencias = []; sugerencias = [SUGERENCIA]; config = { sugerenciasIA: true };
    render(<AdminEquivalencias />);
    fireEvent.click(await screen.findByRole('tab', { name: /1 por revisar/ }));
    expect(screen.getByText(/Búsqueda automática ENCENDIDA/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Catálogo GM' })).toHaveAttribute('href', 'https://gm.com/x');
    fireEvent.click(screen.getByRole('button', { name: 'Revisar y aprobar' }));
    expect(screen.getByLabelText(/Números de parte/)).toHaveValue('12605843, 19210736, 12615418');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(updateDoc).toHaveBeenCalledWith('sugerenciasEquivalencia/computadora_12605843_19210736', { estado: 'aprobada', revisadoAt: 'AHORA' }));
    expect(addDoc.mock.calls[0][1]).toMatchObject({ partes: ['12605843', '19210736', '12615418'], nota: 'Aprobada desde sugerencia automática. Fuente: https://gm.com/x' });
  });

  it('descartar marca la sugerencia; si falló, se borra para poder buscarla otra vez', async () => {
    equivalencias = []; sugerencias = [SUGERENCIA, { ...SUGERENCIA, id: 'bcm_AAA111_BBB222', partes: ['AAA111', 'BBB222'], estado: 'error' }];
    render(<AdminEquivalencias />);
    fireEvent.click(await screen.findByRole('tab', { name: /Sugerencias/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    await waitFor(() => expect(updateDoc).toHaveBeenCalledWith('sugerenciasEquivalencia/computadora_12605843_19210736', { estado: 'descartada', revisadoAt: 'AHORA' }));
    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }));
    await waitFor(() => expect(deleteDoc).toHaveBeenCalledWith('sugerenciasEquivalencia/bcm_AAA111_BBB222'));
  });

  it('pegar tabla: vista previa y guarda solo los nuevos', async () => {
    equivalencias = [{ id: 'E1', tipoPieza: 'computadora', partes: ['12605843', '19210736'] }]; sugerencias = [];
    render(<AdminEquivalencias />);
    fireEvent.click(await screen.findByRole('button', { name: /Pegar tabla/ }));
    fireEvent.change(screen.getByLabelText(/Tipo de pieza \(para toda/), { target: { value: 'computadora' } });
    fireEvent.change(screen.getByLabelText('Tabla'), { target: { value: 'Modelo\tBase\tReemplazo\nSaturn\t12605843\t19210736\nVersa\t23710-3HC0A\t23710-3HC0B' } });
    expect(addDoc).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Ver vista previa' }));
    expect(screen.getByText(/1 por guardar · 1 ya registrados · 0 con problema/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar 1 registros' }));
    await waitFor(() => expect(addDoc).toHaveBeenCalledTimes(1));
    expect(addDoc.mock.calls[0][1]).toEqual({ clase: 'equivalencia', tipoPieza: 'computadora', partes: ['237103HC0A', '237103HC0B'], nota: 'Versa', creadoAt: 'AHORA' });
    expect(await screen.findByText('Listo: se guardaron 1 registros.')).toBeInTheDocument();
    expect(screen.getByText('237103HC0A = 237103HC0B')).toBeInTheDocument();
  });
});
