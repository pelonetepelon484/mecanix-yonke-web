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

const { validarArchivoFotoPieza, subirFotoPieza, borrarFotoPieza } = await import('./piezaFotoStorage.js');

function archivoFake({ type = 'image/jpeg', size = 1024 } = {}) {
  return { type, size };
}

beforeEach(() => {
  uploadBytesMock.mockReset();
  getDownloadURLMock.mockReset();
  deleteObjectMock.mockReset();
  comprimirImagenMock.mockReset();
});

describe('validarArchivoFotoPieza', () => {
  it('rechaza si no hay archivo', () => {
    expect(validarArchivoFotoPieza(null)).toMatch(/elige una imagen/i);
  });

  it('rechaza un tipo no permitido', () => {
    expect(validarArchivoFotoPieza(archivoFake({ type: 'application/pdf' }))).toMatch(/formato no permitido/i);
  });

  it('rechaza un archivo de más de 10 MB', () => {
    expect(validarArchivoFotoPieza(archivoFake({ size: 11 * 1024 * 1024 }))).toMatch(/10 MB/);
  });

  it('acepta png/jpeg/webp dentro del límite', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
      expect(validarArchivoFotoPieza(archivoFake({ type, size: 5 * 1024 * 1024 }))).toBeNull();
    }
  });
});

describe('subirFotoPieza', () => {
  it('exige carpeta e id', async () => {
    await expect(subirFotoPieza('', 'p1', archivoFake())).rejects.toThrow(/falta la carpeta/i);
    await expect(subirFotoPieza('yonkes/y1/piezasSueltas', '', archivoFake())).rejects.toThrow(/falta la carpeta/i);
    expect(comprimirImagenMock).not.toHaveBeenCalled();
  });

  it('rechaza un archivo inválido antes de comprimir', async () => {
    await expect(subirFotoPieza('yonkes/y1/piezasSueltas', 'p1', archivoFake({ type: 'text/plain' })))
      .rejects.toThrow(/formato no permitido/i);
    expect(comprimirImagenMock).not.toHaveBeenCalled();
  });

  it('comprime a 800px/WebP/100KB y sube con Cache-Control de 1 año', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    comprimirImagenMock.mockResolvedValue({ type: 'image/webp', size: 50 * 1024 });
    uploadBytesMock.mockResolvedValue(undefined);
    getDownloadURLMock.mockResolvedValue('https://ejemplo/url-pieza');

    const resultado = await subirFotoPieza('yonkes/y1/piezasSueltas', 'p1', archivoFake());

    expect(comprimirImagenMock).toHaveBeenCalledWith(expect.anything(), {
      maxAncho: 800, tipo: 'image/webp', calidad: 0.85, maxBytes: 100 * 1024,
    });
    expect(resultado).toEqual({
      url: 'https://ejemplo/url-pieza',
      path: 'yonkes/y1/piezasSueltas/p1-1700000000000.webp',
    });
    const [, , metadata] = uploadBytesMock.mock.calls[0];
    expect(metadata).toEqual({ contentType: 'image/webp', cacheControl: 'public, max-age=31536000' });
    vi.restoreAllMocks();
  });

  it('arma la ruta correcta para los 3 casos de uso (pieza de vehículo, motor, pieza suelta)', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    comprimirImagenMock.mockResolvedValue({ type: 'image/webp', size: 1000 });
    uploadBytesMock.mockResolvedValue(undefined);
    getDownloadURLMock.mockResolvedValue('https://ejemplo/url');

    const casos = [
      ['yonkes/y1/vehiculos/v1/piezas', 'pz1', 'yonkes/y1/vehiculos/v1/piezas/pz1-1700000000000.webp'],
      ['yonkes/y1/motores', 'm1', 'yonkes/y1/motores/m1-1700000000000.webp'],
      ['yonkes/y1/piezasSueltas', 'ps1', 'yonkes/y1/piezasSueltas/ps1-1700000000000.webp'],
    ];
    for (const [carpeta, id, pathEsperado] of casos) {
      const { path } = await subirFotoPieza(carpeta, id, archivoFake());
      expect(path).toBe(pathEsperado);
    }
    vi.restoreAllMocks();
  });

  it('usa extensión .jpg cuando el navegador no soporta WebP (comprimirImagen devuelve jpeg)', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    comprimirImagenMock.mockResolvedValue({ type: 'image/jpeg', size: 1000 });
    uploadBytesMock.mockResolvedValue(undefined);
    getDownloadURLMock.mockResolvedValue('https://ejemplo/url');

    const { path } = await subirFotoPieza('yonkes/y1/motores', 'm1', archivoFake());
    expect(path).toBe('yonkes/y1/motores/m1-1700000000000.jpg');
    vi.restoreAllMocks();
  });

  it('si uploadBytes falla, lanza un error claro de "no se pudo subir" (no el error crudo)', async () => {
    comprimirImagenMock.mockResolvedValue({ type: 'image/webp', size: 1000 });
    uploadBytesMock.mockRejectedValue({ code: 'storage/unauthorized' });

    await expect(subirFotoPieza('yonkes/y1/motores', 'm1', archivoFake()))
      .rejects.toThrow(/no se pudo subir la foto/i);
  });

  it('si uploadBytes falla, no intenta obtener la URL de descarga', async () => {
    comprimirImagenMock.mockResolvedValue({ type: 'image/webp', size: 1000 });
    uploadBytesMock.mockRejectedValue(new Error('network error'));

    await expect(subirFotoPieza('yonkes/y1/motores', 'm1', archivoFake())).rejects.toThrow();
    expect(getDownloadURLMock).not.toHaveBeenCalled();
  });
});

describe('borrarFotoPieza', () => {
  it('no hace nada si el path es null/undefined', async () => {
    await borrarFotoPieza(null);
    await borrarFotoPieza(undefined);
    expect(deleteObjectMock).not.toHaveBeenCalled();
  });

  it('borra por la ruta exacta', async () => {
    deleteObjectMock.mockResolvedValue(undefined);
    await borrarFotoPieza('yonkes/y1/piezasSueltas/ps1-123.webp');
    expect(deleteObjectMock).toHaveBeenCalledWith({ __tipo: 'ref', path: 'yonkes/y1/piezasSueltas/ps1-123.webp' });
  });

  it('tolera storage/object-not-found sin lanzar', async () => {
    deleteObjectMock.mockRejectedValue({ code: 'storage/object-not-found' });
    await expect(borrarFotoPieza('yonkes/y1/piezasSueltas/ps1-123.webp')).resolves.toBeUndefined();
  });

  it('relanza cualquier otro error', async () => {
    deleteObjectMock.mockRejectedValue({ code: 'storage/unauthorized' });
    await expect(borrarFotoPieza('yonkes/y1/piezasSueltas/ps1-123.webp')).rejects.toMatchObject({ code: 'storage/unauthorized' });
  });
});
