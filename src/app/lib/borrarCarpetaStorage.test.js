import { describe, expect, it, vi, beforeEach } from 'vitest';

const listAllMock = vi.fn();
const deleteObjectMock = vi.fn();
vi.mock('firebase/storage', () => ({
  ref: (storage, path) => ({ __tipo: 'ref', fullPath: path }),
  listAll: (...args) => listAllMock(...args),
  deleteObject: (...args) => deleteObjectMock(...args),
}));

vi.mock('./firebase', () => ({ storage: {} }));

const { borrarCarpetaStorage } = await import('./borrarCarpetaStorage.js');

function item(path) { return { __tipo: 'ref', fullPath: path }; }

beforeEach(() => {
  listAllMock.mockReset();
  deleteObjectMock.mockReset().mockResolvedValue(undefined);
});

describe('borrarCarpetaStorage', () => {
  it('borra cada archivo de la carpeta (sin subcarpetas)', async () => {
    listAllMock.mockResolvedValue({
      items: [item('yonkes/y1/motores/m1-1.webp'), item('yonkes/y1/motores/m2-1.webp')],
      prefixes: [],
    });
    const n = await borrarCarpetaStorage('yonkes/y1/motores');
    expect(n).toBe(2);
    expect(deleteObjectMock).toHaveBeenCalledTimes(2);
    expect(deleteObjectMock).toHaveBeenCalledWith(item('yonkes/y1/motores/m1-1.webp'));
    expect(deleteObjectMock).toHaveBeenCalledWith(item('yonkes/y1/motores/m2-1.webp'));
  });

  it('baja recursivamente a las subcarpetas (ej. piezas/ de un vehículo)', async () => {
    listAllMock.mockImplementation(async (ref) => {
      if (ref.fullPath === 'yonkes/y1/vehiculos/v1') {
        return {
          items: [item('yonkes/y1/vehiculos/v1/frontal-1.webp')],
          prefixes: [{ __tipo: 'ref', fullPath: 'yonkes/y1/vehiculos/v1/piezas' }],
        };
      }
      if (ref.fullPath === 'yonkes/y1/vehiculos/v1/piezas') {
        return {
          items: [item('yonkes/y1/vehiculos/v1/piezas/p1-1.webp'), item('yonkes/y1/vehiculos/v1/piezas/p2-1.webp')],
          prefixes: [],
        };
      }
      throw new Error(`ruta inesperada en el mock: ${ref.fullPath}`);
    });

    const n = await borrarCarpetaStorage('yonkes/y1/vehiculos/v1');

    expect(n).toBe(3); // 1 foto del vehículo + 2 fotos de piezas
    expect(deleteObjectMock).toHaveBeenCalledTimes(3);
  });

  it('no lanza si el prefijo no existe (storage/object-not-found)', async () => {
    listAllMock.mockRejectedValue({ code: 'storage/object-not-found' });
    await expect(borrarCarpetaStorage('yonkes/inexistente')).resolves.toBe(0);
    expect(deleteObjectMock).not.toHaveBeenCalled();
  });

  it('relanza cualquier otro error de listAll', async () => {
    listAllMock.mockRejectedValue({ code: 'storage/unauthorized' });
    await expect(borrarCarpetaStorage('yonkes/y1')).rejects.toMatchObject({ code: 'storage/unauthorized' });
  });

  it('tolera que un archivo individual ya no exista (storage/object-not-found) sin lanzar', async () => {
    listAllMock.mockResolvedValue({ items: [item('a.webp'), item('b.webp')], prefixes: [] });
    deleteObjectMock
      .mockRejectedValueOnce({ code: 'storage/object-not-found' })
      .mockResolvedValueOnce(undefined);
    const n = await borrarCarpetaStorage('carpeta');
    expect(n).toBe(1); // solo el que sí se borró cuenta
  });

  it('relanza si un archivo individual falla por otra razón', async () => {
    listAllMock.mockResolvedValue({ items: [item('a.webp')], prefixes: [] });
    deleteObjectMock.mockRejectedValue({ code: 'storage/unauthorized' });
    await expect(borrarCarpetaStorage('carpeta')).rejects.toMatchObject({ code: 'storage/unauthorized' });
  });

  it('devuelve 0 cuando la carpeta existe pero está vacía', async () => {
    listAllMock.mockResolvedValue({ items: [], prefixes: [] });
    await expect(borrarCarpetaStorage('yonkes/y1/vacio')).resolves.toBe(0);
  });

  it('borra en lotes de 10 -- nunca más de 10 deleteObject() en vuelo a la vez', async () => {
    const items = Array.from({ length: 25 }, (_, i) => item(`yonkes/y1/vehiculos/v1/p${i}.webp`));
    listAllMock.mockResolvedValue({ items, prefixes: [] });

    let enVuelo = 0;
    let picoMaximo = 0;
    deleteObjectMock.mockImplementation(() => {
      enVuelo += 1;
      picoMaximo = Math.max(picoMaximo, enVuelo);
      return new Promise((resolve) => {
        setTimeout(() => { enVuelo -= 1; resolve(); }, 0);
      });
    });

    const n = await borrarCarpetaStorage('yonkes/y1/vehiculos/v1');

    expect(n).toBe(25);
    expect(deleteObjectMock).toHaveBeenCalledTimes(25);
    expect(picoMaximo).toBeLessThanOrEqual(10);
  });
});
