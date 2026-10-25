// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import OtrosEstadosResultados from './OtrosEstadosResultados';
import { alturaBarrasFijasArriba, desplazarHaciaOtrosEstados } from './lib/scrollOtrosEstados';
import { MARGEN_SCROLL_OTROS_ESTADOS } from '../lib/otrosEstadosPantalla';

const grupos = [{ estado: 'sonora', estadoNombre: 'Sonora', resultados: [{ yonkeId: 'SON', vehiculoId: 'V1' }] }];
const info = (extra = {}) => ({ modo: 'a', grupos, busqueda: null, scroll: true, ...extra });
const tarjeta = (r, key) => <div key={key}>tarjeta</div>;

// Posición del encabezado (h3) en pantalla y alto de la ventana.
let rectEncabezado = { top: 900, bottom: 930, height: 30 };
let reducir = false;
const flush = () => new Promise((r) => { requestAnimationFrame(() => r()); });

beforeEach(() => {
  rectEncabezado = { top: 900, bottom: 930, height: 30 };
  reducir = false;
  window.scrollTo = vi.fn();
  window.innerHeight = 700;
  window.scrollY = 0;
  window.matchMedia = vi.fn(() => ({ matches: reducir }));
  vi.spyOn(HTMLHeadingElement.prototype, 'getBoundingClientRect').mockImplementation(() => rectEncabezado);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); document.body.innerHTML = ''; });

describe('scroll hacia "otros estados" (config/buscador.scrollOtrosEstados)', () => {
  it('una sola vez por búsqueda, suave, dejando el margen arriba del encabezado', async () => {
    const { rerender } = render(<OtrosEstadosResultados info={info()} nombreEstadoCliente="Jalisco" renderTarjeta={tarjeta} numeroBusqueda={1} />);
    await flush();
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 900 - MARGEN_SCROLL_OTROS_ESTADOS, behavior: 'smooth' });
    // Volver a dibujar (misma búsqueda, otros datos) NO repite el scroll.
    rerender(<OtrosEstadosResultados info={info()} nombreEstadoCliente="Jalisco" renderTarjeta={tarjeta} numeroBusqueda={1} />);
    rerender(<OtrosEstadosResultados info={{ ...info(), busqueda: { marca: 'x' } }} nombreEstadoCliente="Jalisco" renderTarjeta={tarjeta} numeroBusqueda={1} />);
    await flush();
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    // Otra búsqueda: otra vez.
    rerender(<OtrosEstadosResultados info={info()} nombreEstadoCliente="Jalisco" renderTarjeta={tarjeta} numeroBusqueda={2} />);
    await flush();
    expect(window.scrollTo).toHaveBeenCalledTimes(2);
  });
  it('si el encabezado ya está a la vista: no desplaza', async () => {
    rectEncabezado = { top: 300, bottom: 330, height: 30 };
    render(<OtrosEstadosResultados info={info()} nombreEstadoCliente="Jalisco" renderTarjeta={tarjeta} numeroBusqueda={1} />);
    await flush();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
  it('con "reducir movimiento": salta sin animación', async () => {
    reducir = true;
    render(<OtrosEstadosResultados info={info()} nombreEstadoCliente="Jalisco" renderTarjeta={tarjeta} numeroBusqueda={1} />);
    await flush();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 900 - MARGEN_SCROLL_OTROS_ESTADOS, behavior: 'auto' });
  });
  it('sin la bandera (scroll false), en el caso b o sin número de búsqueda: nunca', async () => {
    render(<OtrosEstadosResultados info={info({ scroll: false })} nombreEstadoCliente="Jalisco" renderTarjeta={tarjeta} numeroBusqueda={1} />);
    render(<OtrosEstadosResultados info={info({ modo: 'b', scroll: false })} nombreEstadoCliente="Jalisco" renderTarjeta={tarjeta} numeroBusqueda={1} />);
    render(<OtrosEstadosResultados info={info()} nombreEstadoCliente="Jalisco" renderTarjeta={tarjeta} numeroBusqueda={0} />);
    await flush();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
  it('con una barra fija arriba: también descuenta su altura', async () => {
    const barra = document.createElement('header');
    barra.style.position = 'fixed';
    document.body.appendChild(barra);
    vi.spyOn(barra, 'getBoundingClientRect').mockReturnValue({ top: 0, bottom: 56, height: 56 });
    expect(alturaBarrasFijasArriba(document)).toBe(56);
    window.scrollY = 1000;
    const el = { getBoundingClientRect: () => ({ top: 900, bottom: 930, height: 30 }) };
    expect(desplazarHaciaOtrosEstados(el)).toBe(true);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 1000 + 900 - 56 - MARGEN_SCROLL_OTROS_ESTADOS, behavior: 'smooth' });
  });
  it('sin barras fijas (hoy la portada no tiene): 0', () => {
    const normal = document.createElement('header');
    document.body.appendChild(normal);
    expect(alturaBarrasFijasArriba(document)).toBe(0);
  });
});
