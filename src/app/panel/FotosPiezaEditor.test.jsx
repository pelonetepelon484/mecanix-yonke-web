// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';

let siguiente = 0;
const subirFotoPieza = vi.fn(async (carpeta, id) => {
  siguiente += 1;
  return { url: `https://img/nueva-${siguiente}.webp`, path: `${carpeta}/${id}-nueva-${siguiente}.webp` };
});
const borrarFotoPieza = vi.fn(async () => {});
vi.mock('../lib/piezaFotoStorage', () => ({
  subirFotoPieza: (...a) => subirFotoPieza(...a),
  borrarFotoPieza: (...a) => borrarFotoPieza(...a),
  validarArchivoFotoPieza: () => null,
}));

const { default: FotosPiezaEditor } = await import('./FotosPiezaEditor.js');
const { default: FotoTarjeta } = await import('../lib/FotoTarjeta.js');
const { default: VisorFotos } = await import('../lib/VisorFotos.js');

const f = (n) => ({ url: `https://img/${n}.webp`, path: `yonkes/Y1/motores/M1-${n}.webp` });
const archivo = () => new File(['x'], 'foto.jpg', { type: 'image/jpeg' });

beforeEach(() => {
  // jsdom no trae vistas previas de archivos (igual que en FotoPiezaEditor.test.jsx).
  global.URL.createObjectURL = vi.fn(() => 'blob:vista-previa');
  global.URL.revokeObjectURL = vi.fn();
});
afterEach(() => { cleanup(); subirFotoPieza.mockClear(); borrarFotoPieza.mockClear(); siguiente = 0; vi.restoreAllMocks(); });

describe('editor de hasta 3 fotos (motores, transmisiones y piezas sueltas)', () => {
  it('pieza vieja con 1 foto: la muestra como primera y deja un espacio para agregar', () => {
    render(<FotosPiezaEditor carpeta="yonkes/Y1/motores" id="M1" item={{ foto: f(1) }} onGuardar={vi.fn()} />);
    expect(screen.getByText('1 de 3 fotos')).toBeInTheDocument();
    expect(document.querySelectorAll('img')).toHaveLength(1);
    expect(screen.getAllByLabelText('Elegir de galería')).toHaveLength(2);
  });
  it('con 3 fotos ya no ofrece agregar otra (límite de 3)', () => {
    render(<FotosPiezaEditor carpeta="c" id="M1" item={{ foto: f(1), fotosExtra: [f(2), f(3)] }} onGuardar={vi.fn()} />);
    expect(screen.getByText('3 de 3 fotos')).toBeInTheDocument();
    expect(document.querySelectorAll('img')).toHaveLength(3);
    expect(screen.getAllByLabelText('Elegir de galería')).toHaveLength(3); // solo las 3 existentes (cambiar)
    expect(screen.getAllByLabelText('Eliminar foto')).toHaveLength(3);
  });
  it('agregar una foto la sube con la misma compresión y guarda la lista completa', async () => {
    const onGuardar = vi.fn(async () => {});
    render(<FotosPiezaEditor carpeta="yonkes/Y1/motores" id="M1" item={{ foto: f(1) }} onGuardar={onGuardar} />);
    const vacio = screen.getAllByLabelText('Elegir de galería')[1];
    await userEvent.upload(vacio, archivo());
    await waitFor(() => expect(onGuardar).toHaveBeenCalledTimes(1));
    expect(subirFotoPieza).toHaveBeenCalledWith('yonkes/Y1/motores', 'M1', expect.any(File));
    expect(onGuardar.mock.calls[0][0]).toEqual([f(1), { url: 'https://img/nueva-1.webp', path: 'yonkes/Y1/motores/M1-nueva-1.webp' }]);
  });
  it('cambiar la segunda foto la reemplaza en su lugar y borra el archivo viejo después de guardar', async () => {
    const onGuardar = vi.fn(async () => {});
    render(<FotosPiezaEditor carpeta="c" id="M1" item={{ foto: f(1), fotosExtra: [f(2), f(3)] }} onGuardar={onGuardar} />);
    await userEvent.upload(screen.getAllByLabelText('Elegir de galería')[1], archivo());
    await waitFor(() => expect(borrarFotoPieza).toHaveBeenCalledWith(f(2).path));
    expect(onGuardar.mock.calls[0][0].map((x) => x.url)).toEqual([f(1).url, 'https://img/nueva-1.webp', f(3).url]);
  });
  it('quitar una foto la saca de la lista y borra su archivo', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onGuardar = vi.fn(async () => {});
    render(<FotosPiezaEditor carpeta="c" id="M1" item={{ foto: f(1), fotosExtra: [f(2)] }} onGuardar={onGuardar} />);
    fireEvent.click(screen.getAllByLabelText('Eliminar foto')[0]);
    await waitFor(() => expect(onGuardar).toHaveBeenCalledWith([f(2)]));
    await waitFor(() => expect(borrarFotoPieza).toHaveBeenCalledWith(f(1).path));
  });
  it('dos cambios casi al mismo tiempo se guardan en fila sin pisarse', async () => {
    let terminarPrimero;
    const onGuardar = vi.fn()
      .mockImplementationOnce(() => new Promise((r) => { terminarPrimero = r; }))
      .mockImplementation(async () => {});
    render(<FotosPiezaEditor carpeta="c" id="M1" item={{ foto: f(1), fotosExtra: [f(2)] }} onGuardar={onGuardar} />);
    await userEvent.upload(screen.getAllByLabelText('Elegir de galería')[0], archivo()); // cambia la 1
    await userEvent.upload(screen.getAllByLabelText('Elegir de galería')[2], archivo()); // agrega la 3
    await waitFor(() => expect(onGuardar).toHaveBeenCalledTimes(1));
    terminarPrimero();
    await waitFor(() => expect(onGuardar).toHaveBeenCalledTimes(2));
    const final = onGuardar.mock.calls[1][0].map((x) => x.url);
    expect(final).toHaveLength(3);
    expect(final[1]).toBe(f(2).url);
    expect(final).not.toContain(f(1).url); // el primer cambio no se perdió
  });
  it('si guardar falla (por ejemplo, ya hay 3), borra el archivo recién subido y avisa', async () => {
    const onGuardar = vi.fn(async () => { throw new Error('Puedes subir hasta 3 fotos.'); });
    render(<FotosPiezaEditor carpeta="c" id="M1" item={{ foto: f(1) }} onGuardar={onGuardar} />);
    await userEvent.upload(screen.getAllByLabelText('Elegir de galería')[1], archivo());
    expect(await screen.findByRole('alert')).toHaveTextContent('Puedes subir hasta 3 fotos.');
    expect(borrarFotoPieza).toHaveBeenCalledWith('c/M1-nueva-1.webp');
  });
});

describe('mostrar las fotos (búsqueda y subdominios)', () => {
  it('la miniatura indica cuántas fotos hay cuando son 2 o más', () => {
    const { rerender } = render(<FotoTarjeta url={f(1).url} alt="Motor" total={3} />);
    expect(screen.getByLabelText('3 fotos')).toBeInTheDocument();
    rerender(<FotoTarjeta url={f(1).url} alt="Motor" total={1} />);
    expect(screen.queryByLabelText('1 fotos')).not.toBeInTheDocument();
  });
  it('el visor recorre las 3 fotos y se cierra con Escape', () => {
    const onClose = vi.fn();
    render(<VisorFotos items={[f(1), f(2), f(3)]} titulo="Motor Nissan Sentra 2010" onClose={onClose} />);
    expect(screen.getByText('Foto 1 de 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Foto siguiente' }));
    expect(screen.getByText('Foto 2 de 3')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', f(2).url);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
  it('con 1 sola foto (pieza vieja) no muestra flechas ni contador', () => {
    render(<VisorFotos items={[f(1)]} titulo="Alternador" onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Foto siguiente' })).not.toBeInTheDocument();
    expect(screen.queryByText(/de 1/)).not.toBeInTheDocument();
  });
});
