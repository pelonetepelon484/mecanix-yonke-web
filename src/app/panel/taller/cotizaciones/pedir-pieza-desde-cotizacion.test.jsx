// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

let configPiezas = null;
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useParams: () => ({ id: 'C261008-AB12' }) }));
vi.mock('../../../lib/SelectorMarcaModelo', () => ({ default: () => null }));
vi.mock('./contexto', () => ({
  useCotizaciones: () => ({ tallerId: 'T1', taller: { activo: true }, puedeEditar: true, datosClienteHabilitados: true, avisoVersion: 'v1', recargar: vi.fn() }),
}));
vi.mock('./pdf', () => ({ descargarPdfCotizacion: vi.fn() }));
vi.mock('../../solicitudesPiezasDatos', () => ({ leerConfigSolicitudesPiezas: vi.fn(async () => configPiezas) }));

// Cotización con TODOS los datos del cliente, para comprobar que ninguno viaja al pedido.
const cotizacion = {
  folio: 'C261008-AB12', estado: 'borrador', archivada: false, vigenciaDias: 15,
  cliente: { nombre: 'Juan Pérez Secreto', telefono: '6649998877' },
  vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2010, placas: 'ABC1234', kilometraje: 150000 },
  observaciones: 'Le urge, vive en Otay',
  renglones: [
    { tipo: 'pieza', descripcion: 'Alternador', cantidad: 1, precioUnitario: 1500 },
    { tipo: 'manoObra', descripcion: 'Instalación', cantidad: 1, precioUnitario: 800 },
    { tipo: 'pieza', descripcion: 'Banda de accesorios', cantidad: 2, precioUnitario: 350.5 },
  ],
  expiraAt: { toDate: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
};
vi.mock('./datos', () => ({
  leerCotizacion: vi.fn(async () => cotizacion),
  borrarCotizacionCompleta: vi.fn(), cambiarArchivada: vi.fn(), duplicarCotizacion: vi.fn(), guardarCotizacion: vi.fn(), quitarDatosCliente: vi.fn(),
}));

const { default: EditarCotizacion } = await import('./[id]/page.js');
const { default: CotizacionForm } = await import('./CotizacionForm.js');
const { leerConfigSolicitudesPiezas } = await import('../../solicitudesPiezasDatos');

afterEach(() => { cleanup(); configPiezas = null; });

async function abrir() {
  render(<EditarCotizacion />);
  await screen.findByText(/Folio C261008-AB12/);
  await waitFor(() => expect(leerConfigSolicitudesPiezas).toHaveBeenCalled());
}

describe('"Pedir a los yonkes" desde una cotización', () => {
  it('bandera apagada (o sin config): no aparece ningún enlace', async () => {
    for (const config of [null, { habilitado: false }, { habilitado: 'true' }]) {
      configPiezas = config;
      await abrir();
      expect(screen.queryByText(/Pedir a los yonkes/)).not.toBeInTheDocument();
      cleanup();
    }
  });
  it('bandera apagada: el formulario de la cotización queda idéntico al de antes', () => {
    const { container: antes } = render(<CotizacionForm inicial={cotizacion} onGuardar={() => {}} onCancelar={() => {}} />);
    const htmlAntes = antes.innerHTML;
    cleanup();
    const { container: ahora } = render(<CotizacionForm inicial={cotizacion} mostrarPedirPieza={false} onGuardar={() => {}} onCancelar={() => {}} />);
    expect(ahora.innerHTML).toBe(htmlAntes);
  });
  it('bandera encendida: un enlace por cada renglón de pieza, ninguno en mano de obra', async () => {
    configPiezas = { habilitado: true };
    await abrir();
    const enlaces = await screen.findAllByRole('link', { name: /Pedir a los yonkes/ });
    expect(enlaces).toHaveLength(2);
    expect(enlaces.map((a) => a.getAttribute('href'))).toEqual([
      '/panel/taller/pedir-pieza/nueva?marca=Nissan&modelo=Sentra&anio=2010&pieza=Alternador',
      '/panel/taller/pedir-pieza/nueva?marca=Nissan&modelo=Sentra&anio=2010&pieza=Banda+de+accesorios',
    ]);
  });
  it('no viaja ningún dato del cliente: ni nombre, teléfono, placas, kilometraje, observaciones ni precios', async () => {
    configPiezas = { habilitado: true };
    await abrir();
    for (const enlace of await screen.findAllByRole('link', { name: /Pedir a los yonkes/ })) {
      const href = enlace.getAttribute('href');
      const claves = [...new URL(href, 'https://x.mx').searchParams.keys()];
      expect(claves.every((c) => ['marca', 'modelo', 'anio', 'pieza'].includes(c))).toBe(true);
      const texto = decodeURIComponent(href.replace(/\+/g, ' '));
      for (const dato of ['Juan', 'Pérez', 'Secreto', '6649998877', 'ABC1234', '150000', 'Otay', 'urge', '1500', '800', '350']) {
        expect(texto).not.toContain(dato);
      }
    }
  });
});
