// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

const updateDocMock = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: (...args) => ({ __tipo: 'doc', args }),
  updateDoc: (...args) => updateDocMock(...args),
  deleteField: () => ({ __tipo: 'deleteField' }),
}));

vi.mock('../lib/firebase', () => ({ db: {} }));

const subirFotoVehiculoMock = vi.fn();
const borrarFotoVehiculoMock = vi.fn();
vi.mock('../lib/vehiculoFotosStorage', () => ({
  subirFotoVehiculo: (...args) => subirFotoVehiculoMock(...args),
  borrarFotoVehiculo: (...args) => borrarFotoVehiculoMock(...args),
  validarArchivoFotoVehiculo: (file) => (file.name === 'invalido.jpg' ? 'Formato no permitido.' : null),
  SLOTS_FOTO_VEHICULO: ['frontal', 'trasera', 'derecha', 'izquierda'],
}));

const { default: VehiculoFotosEditor } = await import('./VehiculoFotosEditor.js');

function archivo(nombre = 'foto.jpg', type = 'image/jpeg') {
  return new File(['contenido'], nombre, { type });
}

beforeEach(() => {
  updateDocMock.mockReset().mockResolvedValue(undefined);
  subirFotoVehiculoMock.mockReset();
  borrarFotoVehiculoMock.mockReset().mockResolvedValue(undefined);
  global.URL.createObjectURL = vi.fn(() => 'blob:fake-preview');
  global.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('VehiculoFotosEditor', () => {
  it('muestra los 4 slots fijos', () => {
    render(<VehiculoFotosEditor yonkeId="y1" vehiculoId="v1" fotos={{}} onChange={() => {}} />);
    expect(screen.getByText('Frontal')).toBeInTheDocument();
    expect(screen.getByText('Trasera')).toBeInTheDocument();
    expect(screen.getByText('Lateral derecho')).toBeInTheDocument();
    expect(screen.getByText('Lateral izquierdo')).toBeInTheDocument();
  });

  it('archivo inválido: muestra el error y nunca llama a subirFotoVehiculo', async () => {
    const onChange = vi.fn();
    render(<VehiculoFotosEditor yonkeId="y1" vehiculoId="v1" fotos={{}} onChange={onChange} />);
    const input = screen.getByLabelText('Elegir de galería — Frontal');
    await userEvent.upload(input, archivo('invalido.jpg', 'image/jpeg'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/formato no permitido/i);
    expect(subirFotoVehiculoMock).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('sube una foto nueva: llama a subirFotoVehiculo, guarda en Firestore y notifica onChange', async () => {
    subirFotoVehiculoMock.mockResolvedValue({ url: 'https://ejemplo/frontal.webp', path: 'yonkes/y1/vehiculos/v1/frontal-1.webp' });
    const onChange = vi.fn();
    render(<VehiculoFotosEditor yonkeId="y1" vehiculoId="v1" fotos={{}} onChange={onChange} />);
    const input = screen.getByLabelText('Elegir de galería — Frontal');
    await userEvent.upload(input, archivo());

    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ frontal: { url: 'https://ejemplo/frontal.webp', path: 'yonkes/y1/vehiculos/v1/frontal-1.webp' } }));
    expect(subirFotoVehiculoMock).toHaveBeenCalledWith('y1', 'v1', 'frontal', expect.any(File));
    expect(updateDocMock).toHaveBeenCalled();
    // sin foto anterior en ese slot -> no debe intentar borrar nada
    expect(borrarFotoVehiculoMock).not.toHaveBeenCalled();
  });

  it('reemplazar: borra la foto anterior por su path DESPUÉS de guardar la nueva en Firestore', async () => {
    subirFotoVehiculoMock.mockResolvedValue({ url: 'https://ejemplo/nueva.webp', path: 'yonkes/y1/vehiculos/v1/frontal-2.webp' });
    const fotos = { frontal: { url: 'https://ejemplo/vieja.webp', path: 'yonkes/y1/vehiculos/v1/frontal-1.webp' } };
    const onChange = vi.fn();
    render(<VehiculoFotosEditor yonkeId="y1" vehiculoId="v1" fotos={fotos} onChange={onChange} />);
    const input = screen.getByLabelText('Elegir de galería — Frontal');
    await userEvent.upload(input, archivo());

    await waitFor(() => expect(borrarFotoVehiculoMock).toHaveBeenCalledWith('yonkes/y1/vehiculos/v1/frontal-1.webp'));
    expect(onChange).toHaveBeenCalledWith({ frontal: { url: 'https://ejemplo/nueva.webp', path: 'yonkes/y1/vehiculos/v1/frontal-2.webp' } });
  });

  it('si falla el guardado en Firestore, borra la foto recién subida (huérfano) y no llama onChange', async () => {
    subirFotoVehiculoMock.mockResolvedValue({ url: 'https://ejemplo/nueva.webp', path: 'yonkes/y1/vehiculos/v1/frontal-2.webp' });
    updateDocMock.mockRejectedValue(new Error('permission-denied'));
    const onChange = vi.fn();
    render(<VehiculoFotosEditor yonkeId="y1" vehiculoId="v1" fotos={{}} onChange={onChange} />);
    const input = screen.getByLabelText('Elegir de galería — Frontal');
    await userEvent.upload(input, archivo());

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(borrarFotoVehiculoMock).toHaveBeenCalledWith('yonkes/y1/vehiculos/v1/frontal-2.webp');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('si falla la subida, muestra Reintentar y vuelve a subir el mismo archivo', async () => {
    subirFotoVehiculoMock.mockRejectedValueOnce(new Error('network error'));
    render(<VehiculoFotosEditor yonkeId="y1" vehiculoId="v1" fotos={{}} onChange={() => {}} />);
    const input = screen.getByLabelText('Elegir de galería — Frontal');
    await userEvent.upload(input, archivo());

    const botonReintentar = await screen.findByRole('button', { name: 'Reintentar' });
    subirFotoVehiculoMock.mockResolvedValueOnce({ url: 'https://ejemplo/ok.webp', path: 'yonkes/y1/vehiculos/v1/frontal-3.webp' });
    await userEvent.click(botonReintentar);

    await waitFor(() => expect(subirFotoVehiculoMock).toHaveBeenCalledTimes(2));
  });

  it('eliminar: borra el campo en Firestore y el archivo por path', async () => {
    const fotos = { trasera: { url: 'https://ejemplo/trasera.webp', path: 'yonkes/y1/vehiculos/v1/trasera-1.webp' } };
    const onChange = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<VehiculoFotosEditor yonkeId="y1" vehiculoId="v1" fotos={fotos} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(borrarFotoVehiculoMock).toHaveBeenCalledWith('yonkes/y1/vehiculos/v1/trasera-1.webp'));
    expect(updateDocMock).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith({ trasera: undefined });
  });
});
