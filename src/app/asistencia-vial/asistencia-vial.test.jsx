// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// /asistencia-vial: apagada da 404 y noindex sin leer proveedores; encendida, una sola consulta
// (activo == true), filtros en el navegador, Llamar/WhatsApp con contador y el sello de documentos.
let configPortada = null;
let proveedoresFirestore = [];
const getDocs = vi.fn(async () => ({ docs: proveedoresFirestore.map((p) => ({ id: p.id, data: () => p })) }));
const where = vi.fn(() => 'where');
const setDoc = vi.fn(async () => {});
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));
vi.mock('../lib/firebase-server', () => ({ dbServer: {} }));
vi.mock('../lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (_db, ...p) => p.join('/'), collection: (_db, ...p) => p.join('/'), query: (...a) => a, where: (...a) => where(...a),
  getDoc: vi.fn(async (ruta) => (ruta === 'config/portada' && configPortada ? { exists: () => true, data: () => configPortada } : { exists: () => false, data: () => ({}) })),
  getDocs: (...a) => getDocs(...a), setDoc: (...a) => setDoc(...a), increment: (n) => ({ sumar: n }),
}));

const { default: Pagina, generateMetadata } = await import('./page.js');
const { default: AsistenciaVialClient, textoVacio } = await import('./AsistenciaVialClient.js');

afterEach(() => { cleanup(); getDocs.mockClear(); setDoc.mockClear(); where.mockClear(); });

const AHORA = Date.UTC(2026, 10, 5, 18);
const p = (id, extra = {}) => ({
  id, nombre: id, servicios: ['grua'], tiposGrua: [], ciudades: ['tijuana'], atiende24h: false, horario: 'Lunes a sábado de 8 a 20 h',
  telefono: '6641234567', whatsapp: '6649876543', descripcion: '', logoUrl: '', activo: true, documentosEnRegla: false, fechaRevisionMs: null, ...extra,
});

describe('servidor', () => {
  it('bandera apagada: 404, noindex y no lee proveedores', async () => {
    configPortada = { asistenciaVialProximamente: true };
    await expect(Pagina()).rejects.toThrow('NOT_FOUND');
    expect((await generateMetadata()).robots).toMatchObject({ index: false, follow: false });
    expect(getDocs).not.toHaveBeenCalled();
  });
  it('encendida: una consulta con activo == true; solo pasa campos públicos', async () => {
    configPortada = { asistenciaVialActiva: true };
    proveedoresFirestore = [{ ...p('Grúas'), notasInternas: 'secreto', fechaRevisionDocumentos: null }];
    const elemento = await Pagina();
    expect(where).toHaveBeenCalledWith('activo', '==', true);
    expect(getDocs).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(elemento.props.proveedores)).not.toContain('secreto');
    expect(elemento.props.mapa).toBe(false);
    const meta = await generateMetadata();
    expect(meta.robots).toBeUndefined();
    expect(meta.title).toBe('Grúas y asistencia vial en Baja California');
  });
});

describe('servidor: bandera del mapa', () => {
  it('con asistenciaVialMapa, la página recibe mapa = true', async () => {
    configPortada = { asistenciaVialActiva: true, asistenciaVialMapa: true };
    proveedoresFirestore = [];
    expect((await Pagina()).props.mapa).toBe(true);
  });
});

describe('página', () => {
  const lista = [
    p('Grúas Noche', { atiende24h: true, documentosEnRegla: true, fechaRevisionMs: Date.UTC(2026, 9, 10, 12) }),
    p('Llantera Centro', { servicios: ['llantera'], whatsapp: '' }),
    p('Grúas Rosarito', { ciudades: ['rosarito'] }),
    p('Grúas Vencidas', { documentosEnRegla: true, fechaRevisionMs: Date.UTC(2025, 5, 1, 12) }),
  ];

  it('aviso visible y tarjetas con Llamar y WhatsApp (mensaje ya escrito)', () => {
    render(<AsistenciaVialClient proveedores={lista} ahoraMs={AHORA} />);
    expect(screen.getByRole('note')).toHaveTextContent('Red Mecanix solo te pone en contacto con el proveedor. El servicio lo presta y lo cobra directamente cada proveedor. Acuerda el precio antes de que salga la grúa o el servicio.');
    const tarjeta = screen.getByText('Grúas Noche').closest('li');
    expect(within(tarjeta).getByRole('link', { name: '📞 Llamar' })).toHaveAttribute('href', 'tel:+526641234567');
    expect(within(tarjeta).getByRole('link', { name: '💬 WhatsApp' })).toHaveAttribute('href', expect.stringContaining('https://wa.me/526649876543?text=Hola%2C%20vi%20tu%20servicio%20en%20Red%20Mecanix'));
    expect(within(tarjeta).getByText('🕒 24 horas')).toBeInTheDocument();
    // Sin WhatsApp: solo Llamar.
    const llantera = screen.getByText('Llantera Centro').closest('li');
    expect(within(llantera).queryByRole('link', { name: '💬 WhatsApp' })).not.toBeInTheDocument();
  });

  it('sello solo si está vigente, y nunca dice "Verificado"', () => {
    render(<AsistenciaVialClient proveedores={lista} ahoraMs={AHORA} />);
    expect(within(screen.getByText('Grúas Noche').closest('li')).getByText('📄 Documentos en regla · revisado en octubre 2026')).toBeInTheDocument();
    expect(within(screen.getByText('Grúas Vencidas').closest('li')).queryByText(/Documentos en regla/)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/verificad/i);
  });

  it('toques: suma 1 a llamadas o a whatsapp del mes, sin datos de quien toca', () => {
    render(<AsistenciaVialClient proveedores={lista} ahoraMs={AHORA} />);
    const tarjeta = screen.getByText('Grúas Noche').closest('li');
    fireEvent.click(within(tarjeta).getByRole('link', { name: '📞 Llamar' }));
    fireEvent.click(within(tarjeta).getByRole('link', { name: '💬 WhatsApp' }));
    expect(setDoc.mock.calls[0][0]).toMatch(/^asistenciaVial\/Grúas Noche\/contactos\/\d{4}-\d{2}$/);
    expect(setDoc.mock.calls[0][1]).toEqual({ llamadas: { sumar: 1 } });
    expect(setDoc.mock.calls[1][1]).toEqual({ whatsapp: { sumar: 1 } });
  });

  it('filtro por ciudad: los de esa ciudad primero (24 horas + documentos arriba) y aparte los cercanos', () => {
    render(<AsistenciaVialClient proveedores={lista} ahoraMs={AHORA} />);
    fireEvent.change(screen.getByLabelText('Ciudad'), { target: { value: 'tijuana' } });
    const enTijuana = screen.getByRole('heading', { name: 'En Tijuana' }).closest('section');
    expect(within(enTijuana).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Grúas Noche', 'Grúas Vencidas', 'Llantera Centro']);
    const cerca = screen.getByRole('heading', { name: 'Cerca de Tijuana' }).closest('section');
    expect(within(cerca).getByText('Grúas Rosarito')).toBeInTheDocument();
  });

  it('filtros por servicio y 24 horas; estado vacío amable', () => {
    render(<AsistenciaVialClient proveedores={lista} ahoraMs={AHORA} />);
    fireEvent.change(screen.getByLabelText('Servicio'), { target: { value: 'llantera' } });
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Llantera Centro']);
    fireEvent.click(screen.getByLabelText('Atiende 24 horas'));
    fireEvent.change(screen.getByLabelText('Ciudad'), { target: { value: 'mexicali' } });
    expect(screen.getByRole('status')).toHaveTextContent(textoVacio('mexicali'));
    expect(textoVacio('mexicali')).toBe('Aún no hay proveedores colaboradores de la red Mecanix en Mexicali con esos filtros.');
  });
});

describe('botón Regístrate en /asistencia-vial', () => {
  it('la página pasa la bandera y el botón sale solo con ella', async () => {
    configPortada = { asistenciaVialActiva: true, asistenciaVialRegistro: true };
    proveedoresFirestore = [];
    expect((await Pagina()).props.registro).toBe(true);
    const { rerender } = render(<AsistenciaVialClient proveedores={[]} ahoraMs={AHORA} />);
    expect(screen.queryByRole('button', { name: /Regístrate/ })).not.toBeInTheDocument();
    rerender(<AsistenciaVialClient proveedores={[]} ahoraMs={AHORA} registro />);
    expect(screen.getByRole('button', { name: /Regístrate/ })).toBeInTheDocument();
  });
});
