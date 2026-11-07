import { afterEach, describe, expect, it, vi } from 'vitest';

// crearCita / guardarCita: lo que se guarda (fecha de borrado = fecha + 30 días) y errores en español.
const escritos = [];
vi.mock('../../../lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  Timestamp: { fromDate: (d) => d },
  collection: (_db, ...p) => p.join('/'),
  doc: (_db, ...p) => p.join('/'),
  addDoc: vi.fn(async (ref, datos) => { escritos.push({ ref, datos }); return { id: 'NUEVA' }; }),
  updateDoc: vi.fn(async (ref, datos) => { escritos.push({ ref, datos }); }),
  serverTimestamp: () => 'AHORA',
  getDoc: vi.fn(), getDocs: vi.fn(), deleteDoc: vi.fn(), query: vi.fn(), where: vi.fn(), orderBy: vi.fn(), limit: vi.fn(),
}));

const fs = await import('firebase/firestore');
const { crearCita, guardarCita } = await import('./datos.js');
const fecha = new Date(2026, 10, 10, 9, 30);
const datos = { fecha, nombre: 'Juan', telefono: '', vehiculo: '', placas: '', motivo: '', estado: 'pendiente' };

afterEach(() => { escritos.length = 0; });

describe('citas: datos', () => {
  it('crear guarda la cita con creadoAt y borrado a los 30 días', async () => {
    expect(await crearCita({ tallerId: 'T1', datos })).toBe('NUEVA');
    expect(escritos[0].ref).toBe('talleres/T1/citas');
    expect(escritos[0].datos).toMatchObject({ fecha, nombre: 'Juan', estado: 'pendiente', creadoAt: 'AHORA', actualizadoAt: 'AHORA' });
    expect(escritos[0].datos.expiraAt.getTime() - fecha.getTime()).toBe(30 * 86400000);
  });
  it('editar no toca creadoAt', async () => {
    await guardarCita({ tallerId: 'T1', id: 'C1', datos });
    expect(escritos[0].ref).toBe('talleres/T1/citas/C1');
    expect(escritos[0].datos).not.toHaveProperty('creadoAt');
  });
  it('si falla, error en español', async () => {
    fs.addDoc.mockRejectedValueOnce(new Error('permission-denied'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(crearCita({ tallerId: 'T1', datos })).rejects.toThrow('No pudimos guardar la cita');
  });
});
