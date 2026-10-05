// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

const subirFotoPiezaMock = vi.fn();
const borrarFotoPiezaMock = vi.fn();
vi.mock('../lib/piezaFotoStorage', () => ({
  subirFotoPieza: (...args) => subirFotoPiezaMock(...args),
  borrarFotoPieza: (...args) => borrarFotoPiezaMock(...args),
  validarArchivoFotoPieza: (file) => (file.name === 'invalido.jpg' ? 'Formato no permitido.' : null),
}));

const { default: FotoPiezaEditor } = await import('./FotoPiezaEditor.js');

function archivo(nombre = 'foto.jpg', type = 'image/jpeg') {
  return new File(['contenido'], nombre, { type });
}

beforeEach(() => {
  subirFotoPiezaMock.mockReset();
  borrarFotoPiezaMock.mockReset().mockResolvedValue(undefined);
  global.URL.createObjectURL = vi.fn(() => 'blob:fake-preview');
  global.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('FotoPiezaEditor', () => {
  it('archivo inválido: muestra el error y nunca llama a subirFotoPieza ni onGuardar', async () => {
    const onGuardar = vi.fn();
    render(<FotoPiezaEditor carpeta="yonkes/y1/motores" id="m1" foto={null} onGuardar={onGuardar} />);
    await userEvent.upload(screen.getByLabelText('Elegir de galería'), archivo('invalido.jpg', 'image/jpeg'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/formato no permitido/i);
    expect(subirFotoPiezaMock).not.toHaveBeenCalled();
    expect(onGuardar).not.toHaveBeenCalled();
  });

  it('sube una foto nueva: llama a subirFotoPieza con carpeta/id y luego a onGuardar', async () => {
    subirFotoPiezaMock.mockResolvedValue({ url: 'https://ejemplo/m1.webp', path: 'yonkes/y1/motores/m1-1.webp' });
    const onGuardar = vi.fn().mockResolvedValue(undefined);
    render(<FotoPiezaEditor carpeta="yonkes/y1/motores" id="m1" foto={null} onGuardar={onGuardar} />);
    await userEvent.upload(screen.getByLabelText('Elegir de galería'), archivo());

    await waitFor(() => expect(onGuardar).toHaveBeenCalledWith({ url: 'https://ejemplo/m1.webp', path: 'yonkes/y1/motores/m1-1.webp' }));
    expect(subirFotoPiezaMock).toHaveBeenCalledWith('yonkes/y1/motores', 'm1', expect.any(File));
    expect(borrarFotoPiezaMock).not.toHaveBeenCalled();
  });

  it('reemplazar: borra la foto anterior por su path DESPUÉS de que onGuardar resuelva', async () => {
    subirFotoPiezaMock.mockResolvedValue({ url: 'https://ejemplo/nueva.webp', path: 'yonkes/y1/motores/m1-2.webp' });
    const onGuardar = vi.fn().mockResolvedValue(undefined);
    const fotoAnterior = { url: 'https://ejemplo/vieja.webp', path: 'yonkes/y1/motores/m1-1.webp' };
    render(<FotoPiezaEditor carpeta="yonkes/y1/motores" id="m1" foto={fotoAnterior} onGuardar={onGuardar} />);
    await userEvent.upload(screen.getByLabelText('Elegir de galería'), archivo());

    await waitFor(() => expect(borrarFotoPiezaMock).toHaveBeenCalledWith('yonkes/y1/motores/m1-1.webp'));
  });

  it('si onGuardar falla, borra la foto recién subida (huérfano) y muestra el error', async () => {
    subirFotoPiezaMock.mockResolvedValue({ url: 'https://ejemplo/nueva.webp', path: 'yonkes/y1/motores/m1-2.webp' });
    const onGuardar = vi.fn().mockRejectedValue(new Error('permission-denied'));
    render(<FotoPiezaEditor carpeta="yonkes/y1/motores" id="m1" foto={null} onGuardar={onGuardar} />);
    await userEvent.upload(screen.getByLabelText('Elegir de galería'), archivo());

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(borrarFotoPiezaMock).toHaveBeenCalledWith('yonkes/y1/motores/m1-2.webp');
  });

  it('si falla la subida, Reintentar vuelve a subir el mismo archivo', async () => {
    subirFotoPiezaMock.mockRejectedValueOnce(new Error('network error'));
    const onGuardar = vi.fn().mockResolvedValue(undefined);
    render(<FotoPiezaEditor carpeta="yonkes/y1/piezasSueltas" id="p1" foto={null} onGuardar={onGuardar} />);
    await userEvent.upload(screen.getByLabelText('Elegir de galería'), archivo());

    const botonReintentar = await screen.findByRole('button', { name: 'Reintentar' });
    subirFotoPiezaMock.mockResolvedValueOnce({ url: 'https://ejemplo/ok.webp', path: 'yonkes/y1/piezasSueltas/p1-2.webp' });
    await userEvent.click(botonReintentar);

    await waitFor(() => expect(subirFotoPiezaMock).toHaveBeenCalledTimes(2));
  });

  it('eliminar: llama a onGuardar(null) y borra el archivo por path', async () => {
    const onGuardar = vi.fn().mockResolvedValue(undefined);
    const foto = { url: 'https://ejemplo/p1.webp', path: 'yonkes/y1/piezasSueltas/p1-1.webp' };
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<FotoPiezaEditor carpeta="yonkes/y1/piezasSueltas" id="p1" foto={foto} onGuardar={onGuardar} />);

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar foto' }));

    await waitFor(() => expect(onGuardar).toHaveBeenCalledWith(null));
    expect(borrarFotoPiezaMock).toHaveBeenCalledWith('yonkes/y1/piezasSueltas/p1-1.webp');
  });

  it('respeta "deshabilitado" -- no deja elegir archivo', () => {
    render(<FotoPiezaEditor carpeta="yonkes/y1/motores" id="m1" foto={null} onGuardar={vi.fn()} deshabilitado />);
    expect(screen.getByLabelText('Elegir de galería')).toBeDisabled();
    expect(screen.getByLabelText('Tomar foto')).toBeDisabled();
  });
});
