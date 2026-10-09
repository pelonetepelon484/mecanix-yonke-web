// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

let config = null;
const getDoc = vi.fn(async () => ({ exists: () => config !== null, data: () => config }));
vi.mock('firebase/firestore', () => ({ doc: (...a) => a.join('/'), getDoc: (...a) => getDoc(...a) }));
vi.mock('./lib/firebase', () => ({ db: 'db' }));
vi.mock('./lib/estados', () => ({
  ESTADO_DEFAULT: 'baja-california',
  cargarEstados: vi.fn(async () => [{ id: 'baja-california', nombre: 'Baja California' }, { id: 'sonora', nombre: 'Sonora' }]),
}));
vi.mock('./lib/SelectorMarcaModelo', () => ({
  default: ({ marca, modelo, onMarca, onModelo }) => (
    <>
      <input aria-label="Marca" value={marca} onChange={(e) => onMarca(e.target.value)} />
      <input aria-label="Modelo" value={modelo} onChange={(e) => onModelo(e.target.value)} />
    </>
  ),
}));

// La bandera se cachea por módulo: cada prueba importa de nuevo.
async function cargar() {
  vi.resetModules();
  return {
    AvisarSinAnioExacto: (await import('./AvisarSinAnioExacto.js')).default,
    AvisarYonkes: (await import('./AvisarYonkes.js')).default,
  };
}

const TEXTO = 'No encontramos tu Toyota Tacoma 2015 exacto. ¿Quieres que avisemos a los yonkes?';
// Lo que deja en pantalla cada búsqueda al no hallar el año exacto (los dos usan la misma sección
// de resultados de HomeClient): el buscador con IA guarda la pieza reconocida; la búsqueda
// avanzada, la pieza elegida en la lista o la escrita a mano con "Otra".
const busquedaIA = { tipoBusqueda: 'vehiculo', hayResultados: true, marca: 'Toyota', modelo: 'Tacoma', anio: '2015', pieza: 'Alternador', estado: '' };
const busquedaAvanzada = { ...busquedaIA, pieza: 'Bomba de agua', estado: 'sonora' };

beforeEach(() => { getDoc.mockClear(); });
afterEach(() => { cleanup(); config = null; });

describe('"Avisar a los yonkes" cuando no hay el año exacto', () => {
  it('bandera apagada: no aparece nada en años cercanos ni en cualquier año (todo igual que hoy)', async () => {
    const { AvisarSinAnioExacto } = await cargar();
    for (const tipoResultado of ['cercano', 'cualquierAno']) {
      const { container } = render(<AvisarSinAnioExacto {...busquedaIA} tipoResultado={tipoResultado} />);
      await waitFor(() => expect(getDoc).toHaveBeenCalled());
      expect(container).toBeEmptyDOMElement();
      cleanup();
    }
  });
  it('bandera encendida y año exacto: no aparece (ni lee la bandera)', async () => {
    config = { habilitado: true };
    const { AvisarSinAnioExacto } = await cargar();
    const { container } = render(<AvisarSinAnioExacto {...busquedaIA} tipoResultado="exacto" />);
    expect(container).toBeEmptyDOMElement();
    expect(getDoc).not.toHaveBeenCalled();
  });
  it('bandera encendida, años cercanos o cualquier año: recuadro con el texto y el botón', async () => {
    config = { habilitado: true };
    const { AvisarSinAnioExacto } = await cargar();
    for (const tipoResultado of ['cercano', 'cualquierAno']) {
      render(<AvisarSinAnioExacto {...busquedaIA} tipoResultado={tipoResultado} />);
      expect(await screen.findByText(TEXTO)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Avisar a los yonkes/ })).toBeInTheDocument();
      cleanup();
    }
  });
  it('búsqueda sin año, sin resultados, o de motor/transmisión: no aparece', async () => {
    config = { habilitado: true };
    const { AvisarSinAnioExacto } = await cargar();
    for (const extra of [{ anio: '' }, { hayResultados: false }, { tipoBusqueda: 'motor' }, { tipoBusqueda: 'transmision' }]) {
      const { container } = render(<AvisarSinAnioExacto {...busquedaIA} tipoResultado="cercano" {...extra} />);
      expect(container).toBeEmptyDOMElement();
      cleanup();
    }
  });
  it('desde el buscador con IA: el formulario abre con marca, modelo, año y pieza ya llenos', async () => {
    config = { habilitado: true };
    const { AvisarSinAnioExacto } = await cargar();
    render(<AvisarSinAnioExacto {...busquedaIA} tipoResultado="cercano" />);
    fireEvent.click(await screen.findByRole('button', { name: /Avisar a los yonkes/ }));
    expect(screen.getByLabelText('Marca')).toHaveValue('Toyota');
    expect(screen.getByLabelText('Modelo')).toHaveValue('Tacoma');
    expect(screen.getByLabelText('Año')).toHaveValue(2015);
    expect(screen.getByLabelText('Pieza que buscas')).toHaveValue('Alternador');
    expect(screen.getByLabelText('Tu WhatsApp')).toHaveValue(''); // lo único que captura el cliente
  });
  it('desde la búsqueda avanzada: igual, y además respeta el estado que eligió', async () => {
    config = { habilitado: true };
    const { AvisarSinAnioExacto } = await cargar();
    render(<AvisarSinAnioExacto {...busquedaAvanzada} tipoResultado="cualquierAno" />);
    fireEvent.click(await screen.findByRole('button', { name: /Avisar a los yonkes/ }));
    expect(screen.getByLabelText('Pieza que buscas')).toHaveValue('Bomba de agua');
    await waitFor(() => expect(screen.getByLabelText('¿En qué estado la buscas?')).toHaveValue('sonora'));
  });
  it('si el cliente buscó solo el vehículo (sin pieza), la pieza queda vacía para que la escriba', async () => {
    config = { habilitado: true };
    const { AvisarSinAnioExacto } = await cargar();
    render(<AvisarSinAnioExacto {...busquedaIA} pieza="" tipoResultado="cercano" />);
    fireEvent.click(await screen.findByRole('button', { name: /Avisar a los yonkes/ }));
    expect(screen.getByLabelText('Pieza que buscas')).toHaveValue('');
  });
  it('donde ya se usaba (sin ningún resultado) se ve igual que antes', async () => {
    config = { habilitado: true };
    const { AvisarYonkes } = await cargar();
    render(<AvisarYonkes />);
    expect(await screen.findByText('¿No la encontraste? Avísale a los yonkes de tu estado y te responden con precio.')).toBeInTheDocument();
  });
});
