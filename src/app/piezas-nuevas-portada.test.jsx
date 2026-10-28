// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Buscador "Piezas nuevas" en la portada (etapa 4): con la bandera apagada la portada es la de
// siempre; encendida, el selector Usadas/Nuevas cambia entre el buscador de yonkes (intacto) y el
// de refaccionarias. Firestore y /api/refacciones/buscar simulados.
vi.mock('./lib/firebase', () => ({ db: 'db' }));
vi.mock('firebase/firestore', () => ({
  doc: (...a) => a.slice(1).join('/'),
  collection: (...a) => a.slice(1).join('/'),
  query: (...a) => a[0], where: () => null, orderBy: () => null, limit: () => null,
  getDoc: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
  getDocs: vi.fn(async () => ({ docs: [], empty: true, size: 0, forEach: () => {} })),
  addDoc: vi.fn(async () => ({ id: 'x' })),
}));
const registrarContacto = vi.fn();
vi.mock('./lib/registrarContactoRefaccionaria', () => ({ registrarContactoRefaccionaria: (...a) => registrarContacto(...a) }));

const { default: HomeClient } = await import('./HomeClient');
const { TEXTOS_PROVISIONALES } = await import('../lib/refaccionarias');

const pieza = (numeroParte, precio, extra = {}) => ({ numeroParte, descripcion: `Bomba ${numeroParte}`, marca: 'Marca Demo A', tipo: 'marca', precio, incluyeIva: true, ...extra });
const resultado = (numeroParte, precio, r = {}) => ({
  refaccionaria: { id: 'R1', nombre: 'El Pistón', ciudad: 'Tijuana', whatsapp: '6641234567', slug: 'el-piston', verificado: true, ...r },
  pieza: pieza(numeroParte, precio), nivel: 0,
});
let respuestas = [];
const fetchMock = vi.fn(async (url) => {
  if (url !== '/api/refacciones/buscar') return { ok: true, json: async () => ({}) };
  return { ok: true, json: async () => respuestas.shift() };
});

beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockClear(); registrarContacto.mockClear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const llamadasBuscador = () => fetchMock.mock.calls.filter(([u]) => u === '/api/refacciones/buscar');

describe('portada con la bandera apagada', () => {
  it('sin selector ni buscador de piezas nuevas: el buscador de yonkes como siempre', () => {
    render(<HomeClient textoSeoEstados="" />);
    expect(screen.queryByRole('group', { name: 'Tipo de pieza' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Piezas nuevas/)).not.toBeInTheDocument();
    expect(screen.getByText('✨ Buscador inteligente')).toBeInTheDocument();
  });
  it('mismo HTML con la bandera en false que sin ella', () => {
    const sin = render(<HomeClient textoSeoEstados="" />).container.innerHTML;
    cleanup();
    expect(render(<HomeClient textoSeoEstados="" buscadorRefacciones={false} />).container.innerHTML).toBe(sin);
  });
});

describe('portada con la bandera encendida', () => {
  it('empieza en usadas (yonkes); "Piezas nuevas" cambia de buscador y "Piezas usadas" regresa', () => {
    render(<HomeClient textoSeoEstados="" buscadorRefacciones />);
    const selector = screen.getByRole('group', { name: 'Tipo de pieza' });
    expect(within(selector).getByRole('button', { name: /Piezas usadas/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('✨ Buscador inteligente')).toBeInTheDocument();

    fireEvent.click(within(selector).getByRole('button', { name: /Piezas nuevas/ }));
    expect(screen.queryByText('✨ Buscador inteligente')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Número de parte o descripción')).toBeInTheDocument();
    expect(screen.getByText(TEXTOS_PROVISIONALES.introPiezasNuevas)).toBeInTheDocument();

    fireEvent.click(within(selector).getByRole('button', { name: /Piezas usadas/ }));
    expect(screen.getByText('✨ Buscador inteligente')).toBeInTheDocument();
    expect(screen.queryByLabelText('Número de parte o descripción')).not.toBeInTheDocument();
  });

  it('busca, muestra resultados con el orden, el aviso, la refaccionaria y WhatsApp; "Ver más" agrega', async () => {
    respuestas = [
      { estado: 'ok', resultados: [resultado('ABC-123', 700), resultado('ABC1234', 900, { verificado: false })], total: 3, pagina: 1, hayMas: true },
      { estado: 'ok', resultados: [resultado('ZZABC123', 50)], total: 3, pagina: 2, hayMas: false },
    ];
    render(<HomeClient textoSeoEstados="" buscadorRefacciones />);
    fireEvent.click(screen.getByRole('button', { name: /Piezas nuevas/ }));
    fireEvent.change(screen.getByLabelText('Número de parte o descripción'), { target: { value: ' abc 123 ' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '🔍 Buscar piezas nuevas' })); });

    expect(JSON.parse(llamadasBuscador()[0][1].body)).toEqual({ texto: 'abc 123', estado: 'todos', pagina: 1 });
    expect(screen.getByText('3 piezas encontradas')).toBeInTheDocument();
    expect(screen.getByText(TEXTOS_PROVISIONALES.ordenResultados)).toBeInTheDocument();
    expect(screen.getByText(TEXTOS_PROVISIONALES.avisoPrecios)).toBeInTheDocument();
    expect(screen.getByText('Bomba ABC-123')).toBeInTheDocument();
    expect(screen.getByText(/No\. de parte ABC-123 · Marca Demo A · De marca/)).toBeInTheDocument();
    expect(screen.getAllByText('✓ Verificado', { exact: false })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: 'El Pistón' })[0]).toHaveAttribute('href', '/refaccionarias/el-piston');

    const whatsapp = screen.getAllByRole('link', { name: /Escribir por WhatsApp/ })[0];
    const texto = decodeURIComponent(whatsapp.getAttribute('href').split('?text=')[1]);
    expect(whatsapp.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/526641234567\?text=/);
    expect(texto).toMatch(/^Hola, vi en Mecanix la pieza Bomba ABC-123 \(No\. de parte ABC-123\) a \$700\.00\. ¿La tienen disponible\?$/);
    fireEvent.click(whatsapp);
    expect(registrarContacto).toHaveBeenCalledWith('R1');

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Ver más' })); });
    expect(JSON.parse(llamadasBuscador()[1][1].body)).toEqual({ texto: 'abc 123', estado: 'todos', pagina: 2 });
    expect(screen.getAllByRole('link', { name: /Escribir por WhatsApp/ })).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument();
  });

  it('sin resultados, límite y errores: lo dice', async () => {
    respuestas = [
      { estado: 'ok', resultados: [], total: 0, pagina: 1, hayMas: false },
      { estado: 'rate_limited', mensaje: 'Estás buscando muy seguido — espera un momento y vuelve a intentar.' },
    ];
    render(<HomeClient textoSeoEstados="" buscadorRefacciones />);
    fireEvent.click(screen.getByRole('button', { name: /Piezas nuevas/ }));
    const campo = screen.getByLabelText('Número de parte o descripción');
    fireEvent.change(campo, { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: '🔍 Buscar piezas nuevas' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe un número de parte o una descripción.');
    expect(llamadasBuscador()).toHaveLength(0);

    fireEvent.change(campo, { target: { value: 'balatas' } });
    await act(async () => { fireEvent.keyDown(campo, { key: 'Enter' }); });
    expect(screen.getByText('No encontramos piezas nuevas con esa búsqueda.')).toBeInTheDocument();
    expect(screen.queryByText(TEXTOS_PROVISIONALES.ordenResultados)).not.toBeInTheDocument();
    await act(async () => { fireEvent.keyDown(campo, { key: 'Enter' }); });
    expect(screen.getByRole('alert')).toHaveTextContent('Estás buscando muy seguido');
  });
});
