import { describe, expect, it, vi, beforeEach } from 'vitest';

const updateDocMock = vi.fn();
const deleteDocMock = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: (db, ...segmentos) => ({ __tipo: 'doc', path: segmentos.join('/') }),
  updateDoc: (...args) => updateDocMock(...args),
  deleteDoc: (...args) => deleteDocMock(...args),
  deleteField: () => ({ __tipo: 'deleteField' }),
  serverTimestamp: () => ({ __tipo: 'serverTimestamp' }),
}));

const borrarCarpetaStorageMock = vi.fn();
vi.mock('../app/lib/borrarCarpetaStorage', () => ({
  borrarCarpetaStorage: (...args) => borrarCarpetaStorageMock(...args),
}));

const { eliminarVehiculoPorError, sacarDelInventario, reactivarVehiculo } = await import('./vehiculoEstado.js');

beforeEach(() => {
  updateDocMock.mockReset().mockResolvedValue(undefined);
  deleteDocMock.mockReset().mockResolvedValue(undefined);
  borrarCarpetaStorageMock.mockReset().mockResolvedValue(0);
});

describe('eliminarVehiculoPorError', () => {
  it('borra primero el documento de Firestore y DESPUÉS las fotos en Storage', async () => {
    const orden = [];
    deleteDocMock.mockImplementation(async () => { orden.push('firestore'); });
    borrarCarpetaStorageMock.mockImplementation(async () => { orden.push('storage'); return 3; });

    await eliminarVehiculoPorError({}, 'y1', 'v1');

    expect(borrarCarpetaStorageMock).toHaveBeenCalledWith('yonkes/y1/vehiculos/v1');
    expect(orden).toEqual(['firestore', 'storage']);
  });

  it('si falla la limpieza de Storage, el documento ya se había borrado (no se revierte)', async () => {
    borrarCarpetaStorageMock.mockRejectedValue(new Error('permission-denied'));
    await expect(eliminarVehiculoPorError({}, 'y1', 'v1')).resolves.toBeUndefined();
    expect(deleteDocMock).toHaveBeenCalled();
  });

  it('si falla el borrado del documento, NUNCA intenta limpiar Storage', async () => {
    deleteDocMock.mockRejectedValue(new Error('permission-denied'));
    await expect(eliminarVehiculoPorError({}, 'y1', 'v1')).rejects.toThrow('permission-denied');
    expect(borrarCarpetaStorageMock).not.toHaveBeenCalled();
  });
});

describe('sacarDelInventario / reactivarVehiculo', () => {
  it('sacarDelInventario NO toca Storage -- vender no borra fotos', async () => {
    await sacarDelInventario({}, 'y1', 'v1', 'vendido');
    expect(borrarCarpetaStorageMock).not.toHaveBeenCalled();
    expect(updateDocMock).toHaveBeenCalled();
  });

  it('reactivarVehiculo NO toca Storage', async () => {
    await reactivarVehiculo({}, 'y1', 'v1');
    expect(borrarCarpetaStorageMock).not.toHaveBeenCalled();
  });
});
