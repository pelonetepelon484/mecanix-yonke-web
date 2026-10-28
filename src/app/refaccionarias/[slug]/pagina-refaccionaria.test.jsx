// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Página pública /refaccionarias/[slug] (etapa 3): bandera paginaPublica, visibilidad por estado de
// la cuenta, datos del negocio, piezas paginadas leyendo solo el bloque necesario y WhatsApp con contador.
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));
const registrarContacto = vi.fn();
vi.mock('../../lib/registrarContactoRefaccionaria', () => ({ registrarContactoRefaccionaria: (...a) => registrarContacto(...a) }));
let encendida = true;
let refaccionaria = null;
const bloque = vi.fn();
const porSlug = vi.fn(async () => refaccionaria);
vi.mock('../../lib/refaccionariaPublica', () => ({
  paginaPublicaEncendida: vi.fn(async () => encendida),
  refaccionariaPorSlug: (...a) => porSlug(...a),
  bloqueDeInventario: (...a) => bloque(...a),
}));

const { default: Pagina, generateMetadata } = await import('./page.js');

const DIA = 24 * 60 * 60 * 1000;
const piezas = (n) => Array.from({ length: n }, (_, i) => ({ numeroParte: `P-${i}`, descripcion: `Pieza ${i}`, marca: 'Marca Demo', tipo: i % 2 ? 'marca' : 'generica', precio: 100 + i, incluyeIva: i % 2 === 0 }));
const base = {
  id: 'R1', nombre: 'El Pistón', ciudad: 'Tijuana', whatsapp: '6641234567', logoUrl: '',
  horario: { lunes: { abierto: true, apertura: '09:00', cierre: '18:00' } },
  zonaEntrega: { descripcion: 'Centro y Otay', municipios: ['Tijuana'] },
  totalPiezas: 20, inventarioActualizadoMs: new Date('2026-10-20T12:00:00').getTime(),
  activo: true, pruebaHastaMs: Date.now() + 30 * DIA, premiumHastaMs: null,
};
const abrir = async (slug = 'el-piston-abc123', query = {}) =>
  render(await Pagina({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(query) }));

beforeEach(() => { encendida = true; refaccionaria = base; bloque.mockReset(); porSlug.mockClear(); registrarContacto.mockClear(); });
afterEach(() => cleanup());

describe('bandera y visibilidad', () => {
  it('bandera apagada: 404 sin leer la refaccionaria (como hoy)', async () => {
    encendida = false;
    await expect(abrir()).rejects.toThrow('NOT_FOUND');
    expect(porSlug).not.toHaveBeenCalled();
    expect(await generateMetadata({ params: Promise.resolve({ slug: 'x' }) })).toEqual({});
  });
  it('slug que no existe: 404', async () => {
    refaccionaria = null;
    await expect(abrir('no-existe')).rejects.toThrow('NOT_FOUND');
  });
  it('vencida, inactiva o sin activar: "no disponible", sin leer el inventario ni mostrar WhatsApp', async () => {
    for (const r of [{ ...base, pruebaHastaMs: Date.now() - DIA }, { ...base, activo: false }, { ...base, pruebaHastaMs: null }]) {
      refaccionaria = r;
      await abrir();
      expect(screen.getByText(/no está disponible/)).toBeInTheDocument();
      expect(screen.queryByText(/WhatsApp/)).not.toBeInTheDocument();
      cleanup();
    }
    expect(bloque).not.toHaveBeenCalled();
  });
  it('pago vigente con la prueba vencida: se muestra', async () => {
    refaccionaria = { ...base, pruebaHastaMs: Date.now() - 10 * DIA, premiumHastaMs: Date.now() + 10 * DIA };
    bloque.mockResolvedValue({ piezas: piezas(20) });
    await abrir();
    expect(screen.getByRole('heading', { name: 'El Pistón' })).toBeInTheDocument();
  });
  it('metadata: nombre y sin índice en buscadores', async () => {
    expect(await generateMetadata({ params: Promise.resolve({ slug: 'el-piston-abc123' }) })).toEqual({ title: 'El Pistón', robots: { index: false, follow: false } });
  });
});

describe('contenido', () => {
  it('datos del negocio, horario, zona de entrega, aviso provisional y las piezas con su precio', async () => {
    bloque.mockResolvedValue({ piezas: piezas(20) });
    await abrir();
    expect(bloque).toHaveBeenCalledTimes(1);
    expect(bloque).toHaveBeenCalledWith('R1/0');
    expect(screen.getByText('📍 Tijuana')).toBeInTheDocument();
    expect(screen.getByText(/Lun 09:00–18:00/)).toBeInTheDocument();
    expect(screen.getByText(/Entrega local: Centro y Otay \(Tijuana\)/)).toBeInTheDocument();
    expect(screen.getByText(/\[PROVISIONAL\] Precios y existencias sujetos a confirmación/)).toBeInTheDocument();
    expect(screen.getByText(/Precios actualizados el 20 de octubre de 2026/)).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(20);
    expect(within(items[0]).getByText(/No. de parte P-0 · Marca Demo · Genérica/)).toBeInTheDocument();
    expect(within(items[0]).getByText('IVA incluido')).toBeInTheDocument();
    expect(within(items[1]).getByText(/De marca/)).toBeInTheDocument();
    expect(within(items[1]).getByText('Más IVA')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
  it('paginación: 50 por página, lee solo el bloque de esa página y enlaza anterior/siguiente', async () => {
    refaccionaria = { ...base, totalPiezas: 1120 };
    bloque.mockResolvedValue({ piezas: piezas(120) });
    await abrir('el-piston-abc123', { pagina: '22' });
    expect(bloque).toHaveBeenCalledTimes(1);
    expect(bloque).toHaveBeenCalledWith('R1/1');
    expect(screen.getAllByRole('listitem')).toHaveLength(50);
    expect(screen.getByText('Pieza 50')).toBeInTheDocument();
    expect(screen.getByText('Página 22 de 23')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Anterior' })).toHaveAttribute('href', '?pagina=21');
    expect(screen.getByRole('link', { name: 'Siguiente →' })).toHaveAttribute('href', '?pagina=23');
  });
  it('página fuera de rango: 404; sin piezas cargadas: lo dice sin leer bloques', async () => {
    await expect(abrir('el-piston-abc123', { pagina: '5' })).rejects.toThrow('NOT_FOUND');
    refaccionaria = { ...base, totalPiezas: 0 };
    await abrir();
    expect(screen.getByText('Esta refaccionaria todavía no tiene piezas cargadas.')).toBeInTheDocument();
    expect(bloque).not.toHaveBeenCalled();
  });
  it('WhatsApp: enlace a wa.me con 52 y el contador suma al tocarlo', async () => {
    bloque.mockResolvedValue({ piezas: piezas(1) });
    await abrir();
    const enlace = screen.getByRole('link', { name: /Escribir por WhatsApp/ });
    expect(enlace.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/526641234567\?text=/);
    expect(enlace).toHaveAttribute('target', '_blank');
    fireEvent.click(enlace);
    expect(registrarContacto).toHaveBeenCalledWith('R1');
  });
});
