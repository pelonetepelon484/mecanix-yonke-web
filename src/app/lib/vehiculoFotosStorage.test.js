import { describe, expect, it, vi, beforeEach } from 'vitest';

const uploadBytesMock = vi.fn();
const getDownloadURLMock = vi.fn();
const deleteObjectMock = vi.fn();
vi.mock('firebase/storage', () => ({
  ref: (storage, path) => ({ __tipo: 'ref', path }),
  uploadBytes: (...args) => uploadBytesMock(...args),
  getDownloadURL: (...args) => getDownloadURLMock(...args),
  deleteObject: (...args) => deleteObjectMock(...args),
}));

vi.mock('./firebase', () => ({ storage: {} }));

const comprimirImagenMock = vi.fn();
vi.mock('./comprimirImagen', () => ({
  comprimirImagen: (...args) => comprimirImagenMock(...args),
}));

const {
  validarArchivoFotoVehiculo, subirFotoVehiculo, borrarFotoVehiculo, SLOTS_FOTO_VEHICULO,
} = await import('./vehiculoFotosStorage.js');

function archivoFake({ type = 'image/jpeg', size = 1024 } = {}) {
  return { type, size };
}

beforeEach(() => {
  uploadBytesMock.mockReset();
  getDownloadURLMock.mockReset();
  deleteObjectMock.mockReset();
  comprimirImagenMock.mockReset();
});

describe('SLOTS_FOTO_VEHICULO', () => {
  it('son exactamente los 4 slots fijos, en este orden', () => {
    expect(SLOTS_FOTO_VEHICULO).toEqual(['frontal', 'trasera', 'derecha', 'izquierda']);
  });
});

describe('validarArchivoFotoVehiculo', () => {
  it('rechaza si no hay archivo', () => {
    expect(validarArchivoFotoVehiculo(null)).toMatch(/elige una imagen/i);
  });

  it('rechaza un tipo no permitido', () => {
    expect(validarArchivoFotoVehiculo(archivoFake({ type: 'application/pdf' }))).toMatch(/formato no permitido/i);
  });

  it('rechaza un archivo de más de 10 MB', () => {
    expect(validarArchivoFotoVehiculo(archivoFake({ size: 11 * 1024 * 1024 }))).toMatch(/10 MB/);
  });

  it('acepta png/jpeg/webp dentro del límite', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
      expect(validarArchivoFotoVehiculo(archivoFake({ type, size: 5 * 1024 * 1024 }))).toBeNull();
    }
  });
});

describe('subirFotoVehiculo', () => {
  it('rechaza un slot que no sea frontal/trasera/derecha/izquierda', async () => {
    await expect(subirFotoVehiculo('y1', 'v1', 'arriba', archivoFake())).rejects.toThrow(/slot de foto inválido/i);
    expect(comprimirImagenMock).not.toHaveBeenCalled();
  });

  it('rechaza un archivo inválido antes de comprimir', async () => {
    await expect(subirFotoVehiculo('y1', 'v1', 'frontal', archivoFake({ type: 'text/plain' })))
      .rejects.toThrow(/formato no permitido/i);
    expect(comprimirImagenMock).not.toHaveBeenCalled();
  });

  it('comprime a 1200px/WebP/250KB y sube con Cache-Control de 1 año', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    comprimirImagenMock.mockResolvedValue({ type: 'image/webp', size: 200 * 1024 });
    uploadBytesMock.mockResolvedValue(undefined);
    getDownloadURLMock.mockResolvedValue('https://firebasestorage.googleapis.com/fake-frontal-url');

    const resultado = await subirFotoVehiculo('y1', 'v1', 'frontal', archivoFake());

    expect(comprimirImagenMock).toHaveBeenCalledWith(expect.anything(), {
      maxAncho: 1200, tipo: 'image/webp', calidad: 0.85, maxBytes: 250 * 1024,
    });
    expect(resultado).toEqual({
      url: 'https://firebasestorage.googleapis.com/fake-frontal-url',
      path: 'yonkes/y1/vehiculos/v1/frontal-1700000000000.webp',
    });
    const [, , metadata] = uploadBytesMock.mock.calls[0];
    expect(metadata).toEqual({ contentType: 'image/webp', cacheControl: 'public, max-age=31536000' });
    vi.restoreAllMocks();
  });

  it('usa extensión .jpg cuando el navegador no soporta WebP (comprimirImagen devuelve jpeg)', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    comprimirImagenMock.mockResolvedValue({ type: 'image/jpeg', size: 200 * 1024 });
    uploadBytesMock.mockResolvedValue(undefined);
    getDownloadURLMock.mockResolvedValue('https://ejemplo/url');

    const resultado = await subirFotoVehiculo('y1', 'v1', 'trasera', archivoFake());

    expect(resultado.path).toBe('yonkes/y1/vehiculos/v1/trasera-1700000000000.jpg');
    vi.restoreAllMocks();
  });

  it('si uploadBytes falla, lanza un error claro de "no se pudo subir" (no el error crudo)', async () => {
    comprimirImagenMock.mockResolvedValue({ type: 'image/webp', size: 1000 });
    uploadBytesMock.mockRejectedValue({ code: 'storage/unauthorized' });

    await expect(subirFotoVehiculo('y1', 'v1', 'derecha', archivoFake()))
      .rejects.toThrow(/no se pudo subir la foto/i);
  });

  it('si uploadBytes falla, no intenta obtener la URL de descarga', async () => {
    comprimirImagenMock.mockResolvedValue({ type: 'image/webp', size: 1000 });
    uploadBytesMock.mockRejectedValue(new Error('network error'));

    await expect(subirFotoVehiculo('y1', 'v1', 'izquierda', archivoFake())).rejects.toThrow();
    expect(getDownloadURLMock).not.toHaveBeenCalled();
  });
});

describe('borrarFotoVehiculo', () => {
  it('no hace nada si el path es null/undefined', async () => {
    await borrarFotoVehiculo(null);
    await borrarFotoVehiculo(undefined);
    expect(deleteObjectMock).not.toHaveBeenCalled();
  });

  it('borra por la ruta exacta', async () => {
    deleteObjectMock.mockResolvedValue(undefined);
    await borrarFotoVehiculo('yonkes/y1/vehiculos/v1/frontal-123.webp');
    expect(deleteObjectMock).toHaveBeenCalledWith({ __tipo: 'ref', path: 'yonkes/y1/vehiculos/v1/frontal-123.webp' });
  });

  it('tolera storage/object-not-found sin lanzar', async () => {
    deleteObjectMock.mockRejectedValue({ code: 'storage/object-not-found' });
    await expect(borrarFotoVehiculo('yonkes/y1/vehiculos/v1/frontal-123.webp')).resolves.toBeUndefined();
  });

  it('relanza cualquier otro error', async () => {
    deleteObjectMock.mockRejectedValue({ code: 'storage/unauthorized' });
    await expect(borrarFotoVehiculo('yonkes/y1/vehiculos/v1/frontal-123.webp')).rejects.toMatchObject({ code: 'storage/unauthorized' });
  });
});
