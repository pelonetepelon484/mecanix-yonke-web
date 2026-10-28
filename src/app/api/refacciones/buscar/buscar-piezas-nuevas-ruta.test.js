import { beforeEach, describe, expect, it, vi } from 'vitest';

// /api/refacciones/buscar: bandera, validación, límite por IP y respuesta. La búsqueda en sí se
// prueba en lib/buscarPiezasNuevas.test.js.
let encendido = false;
let permitido = true;
const buscar = vi.fn(async (args) => ({ resultados: [], total: 0, pagina: args.pagina, hayMas: false }));
const permitirBusqueda = vi.fn(async () => permitido);
vi.mock('../../../lib/refaccionariaPublica', () => ({
  buscadorRefaccionesEncendido: async () => encendido,
  bloqueDeInventario: vi.fn(), indiceDeBusqueda: vi.fn(), refaccionariasActivas: vi.fn(), visibleAhora: vi.fn(),
}));
vi.mock('../../../lib/buscarPiezasNuevas', () => ({ buscarPiezasNuevas: (...a) => buscar(...a) }));
vi.mock('../../../lib/busqueda/rateLimit', () => ({ permitirBusqueda: (...a) => permitirBusqueda(...a), MENSAJE_RATE_LIMIT: 'Espera' }));
const { POST } = await import('./route.js');

const pedir = (cuerpo) => POST(new Request('http://x/api/refacciones/buscar', {
  method: 'POST', headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }, body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
}));

beforeEach(() => { encendido = true; permitido = true; buscar.mockClear(); permitirBusqueda.mockClear(); });

describe('/api/refacciones/buscar', () => {
  it('bandera apagada: 404 sin límite ni búsqueda', async () => {
    encendido = false;
    const res = await pedir({ texto: 'ABC-123' });
    expect(res.status).toBe(404);
    expect(permitirBusqueda).not.toHaveBeenCalled();
    expect(buscar).not.toHaveBeenCalled();
  });
  it('texto vacío, muy largo o cuerpo inválido: 400', async () => {
    for (const c of [{ texto: ' a ' }, { texto: 'x'.repeat(101) }, { texto: 5 }, 'no es json']) {
      expect((await pedir(c)).status).toBe(400);
    }
    expect(buscar).not.toHaveBeenCalled();
  });
  it('busca con la IP, el estado y la página (validados)', async () => {
    const res = await pedir({ texto: ' ABC-123 ', estado: 'sonora', pagina: 2 });
    expect(await res.json()).toEqual({ estado: 'ok', resultados: [], total: 0, pagina: 2, hayMas: false });
    expect(permitirBusqueda).toHaveBeenCalledWith('1.2.3.4');
    expect(buscar).toHaveBeenCalledWith({ texto: 'ABC-123', estado: 'sonora', pagina: 2 }, expect.any(Object));
    await pedir({ texto: 'balatas', estado: 'Mal Estado!', pagina: 99 });
    expect(buscar).toHaveBeenLastCalledWith({ texto: 'balatas', estado: 'todos', pagina: 1 }, expect.any(Object));
  });
  it('límite por IP: 429 con el mensaje; si el chequeo falla, deja pasar', async () => {
    permitido = false;
    const res = await pedir({ texto: 'balatas' });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ estado: 'rate_limited', mensaje: 'Espera' });
    permitirBusqueda.mockRejectedValueOnce(new Error('reglas'));
    expect((await pedir({ texto: 'balatas' })).status).toBe(200);
  });
  it('si la búsqueda falla: 500 con mensaje', async () => {
    buscar.mockRejectedValueOnce(new Error('red'));
    const res = await pedir({ texto: 'balatas' });
    expect(res.status).toBe(500);
    expect((await res.json()).estado).toBe('error');
  });
});
