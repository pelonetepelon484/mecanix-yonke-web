// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const leerSeguimiento = vi.fn();
const activarSeguimiento = vi.fn(async () => 'nuevo');
const desactivarSeguimiento = vi.fn(async () => {});
const guardarNotaSeguimiento = vi.fn(async () => {});
vi.mock('./datos', () => ({
  leerSeguimiento: (...a) => leerSeguimiento(...a),
  activarSeguimiento: (...a) => activarSeguimiento(...a),
  desactivarSeguimiento: (...a) => desactivarSeguimiento(...a),
  guardarNotaSeguimiento: (...a) => guardarNotaSeguimiento(...a),
}));
vi.mock('../../../../lib/avisoOrden', async (original) => ({
  ...(await original()), ordenConSeguimiento: (v) => v === 'aviso-orden-3',
}));

const { default: SeguimientoOrden } = await import('./SeguimientoOrden.js');
const { default: OrdenForm } = await import('./OrdenForm.js');
const { ADVERTENCIA_ENLACE_SEGUIMIENTO, ADVERTENCIA_NOTA_SEGUIMIENTO, AVISO_ENTREGA_SEGUIMIENTO, MENSAJES_SEGUIMIENTO } = await import('../../../../lib/seguimiento');

const DIA = 86400000;
const TOKEN = 'E'.repeat(40) + 'abc';
const PREMIUM = { nombre: 'Taller Peña', whatsapp: '6641234567', activo: true, plan: 'premium', premiumHasta: new Date(Date.now() + 30 * DIA) };
const CONFIG = { habilitado: true, seguimientoHabilitado: true };
const fecha = (ms) => ({ toDate: () => new Date(Date.now() + ms) });
const orden = (extra = {}) => ({
  estado: 'reparacion', avisoVersion: 'aviso-orden-3', vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 },
  cliente: { nombre: 'Juan', telefono: '6641112233' }, expiraAt: fecha(80 * DIA), ...extra,
});
const pintar = (props = {}) => render(
  <SeguimientoOrden tallerId="T1" taller={PREMIUM} folio="O261020-ABCD" orden={orden()} configOrdenes={CONFIG} puedeEditar vencida={false} onCambio={vi.fn()} {...props} />,
);

beforeEach(() => { leerSeguimiento.mockReset(); activarSeguimiento.mockClear(); desactivarSeguimiento.mockClear(); guardarNotaSeguimiento.mockClear(); });
afterEach(cleanup);

describe('bandera y versión del aviso', () => {
  it('bandera apagada o sin el campo, y sin enlace: no aparece nada', () => {
    const { container } = pintar({ configOrdenes: { habilitado: true } });
    expect(container).toBeEmptyDOMElement();
    cleanup();
    expect(pintar({ configOrdenes: null }).container).toBeEmptyDOMElement();
  });
  it('orden anterior al aviso con seguimiento: la nota que lo explica, sin botón', () => {
    pintar({ orden: orden({ avisoVersion: 'aviso-orden-2' }) });
    expect(screen.getByTestId('seguimiento-anterior')).toHaveTextContent(MENSAJES_SEGUIMIENTO.anteriorAlAviso);
    expect(screen.queryByRole('button', { name: /Activar/ })).not.toBeInTheDocument();
  });
});

describe('activar', () => {
  it('Premium vigente y todo en regla: "Activar seguimiento"', async () => {
    pintar();
    fireEvent.click(await screen.findByRole('button', { name: 'Activar seguimiento' }));
    await waitFor(() => expect(activarSeguimiento).toHaveBeenCalledWith({ tallerId: 'T1', folio: 'O261020-ABCD', taller: PREMIUM }));
  });
  it('sin Premium: no se puede activar y se explica', async () => {
    pintar({ taller: { ...PREMIUM, plan: 'freemium' } });
    expect(await screen.findByTestId('seguimiento-sin-activar')).toHaveTextContent(MENSAJES_SEGUIMIENTO.sinPremium);
    expect(screen.queryByRole('button', { name: 'Activar seguimiento' })).not.toBeInTheDocument();
  });
  it('más de 30 días desde la primera entrega: no se puede activar', async () => {
    pintar({ orden: orden({ estado: 'entregado', primeraEntregaAt: fecha(-31 * DIA), expiraAt: fecha(60 * DIA) }) });
    expect(await screen.findByTestId('seguimiento-sin-activar')).toHaveTextContent(MENSAJES_SEGUIMIENTO.vencido);
  });
  it('enlace desactivado o vencido: ofrece uno nuevo', async () => {
    leerSeguimiento.mockResolvedValue(null);
    pintar({ orden: orden({ seguimientoToken: TOKEN }) });
    expect(await screen.findByRole('button', { name: 'Activar un enlace nuevo' })).toBeInTheDocument();
    expect(screen.getByText(/está desactivado o ya venció/)).toBeInTheDocument();
  });
});

describe('enlace activo', () => {
  beforeEach(() => leerSeguimiento.mockResolvedValue({ expiraAt: fecha(20 * DIA) }));
  it('advertencia fija, enlace con www, WhatsApp con el teléfono de la orden, copiar y desactivar', async () => {
    pintar({ orden: orden({ seguimientoToken: TOKEN }) });
    expect(await screen.findByTestId('advertencia-enlace')).toHaveTextContent(ADVERTENCIA_ENLACE_SEGUIMIENTO);
    expect(screen.getByLabelText('Enlace para tu cliente')).toHaveValue(`https://www.mecanixyonkevirtual.com/seguimiento/${TOKEN}`);
    const wa = screen.getByRole('link', { name: 'Compartir por WhatsApp' });
    expect(wa.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/526641112233\?text=/);
    expect(decodeURIComponent(wa.getAttribute('href'))).toContain(`/seguimiento/${TOKEN}`);
    expect(wa).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('button', { name: 'Copiar enlace' })).toBeInTheDocument();
    expect(screen.getByText(ADVERTENCIA_NOTA_SEGUIMIENTO)).toBeInTheDocument();
  });
  it('sin teléfono en la orden: WhatsApp abre para elegir contacto', async () => {
    pintar({ orden: orden({ seguimientoToken: TOKEN, cliente: {} }) });
    expect((await screen.findByRole('link', { name: 'Compartir por WhatsApp' })).getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=/);
  });
  it('nota con teléfono: se rechaza en la app sin guardar', async () => {
    pintar({ orden: orden({ seguimientoToken: TOKEN }) });
    fireEvent.change(await screen.findByLabelText(/Nota para tu cliente/), { target: { value: 'Llámame al 6641234567' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nota' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAJES_SEGUIMIENTO.notaTelefono);
    expect(guardarNotaSeguimiento).not.toHaveBeenCalled();
  });
  it('desactivar funciona aunque el taller no pueda editar (sin Premium / términos viejos) y aunque la bandera esté apagada', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    pintar({ orden: orden({ seguimientoToken: TOKEN }), puedeEditar: false, taller: { ...PREMIUM, plan: 'freemium' }, configOrdenes: { habilitado: true } });
    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar enlace' }));
    await waitFor(() => expect(desactivarSeguimiento).toHaveBeenCalledWith(TOKEN));
    expect(screen.queryByRole('button', { name: 'Guardar nota' })).not.toBeInTheDocument();
  });
});

describe('aviso al marcar Entregado (OrdenForm)', () => {
  it('se muestra al elegir Entregado si se pasa el aviso; si no, no', () => {
    const { unmount } = render(<OrdenForm inicial={orden()} avisoEntrega={AVISO_ENTREGA_SEGUIMIENTO} onGuardar={vi.fn()} onCancelar={vi.fn()} />);
    expect(screen.queryByTestId('aviso-entrega')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'entregado' } });
    expect(screen.getByTestId('aviso-entrega')).toHaveTextContent('El enlace de seguimiento dejará de abrir 30 días después de hoy');
    unmount();
    render(<OrdenForm inicial={orden()} onGuardar={vi.fn()} onCancelar={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'entregado' } });
    expect(screen.queryByTestId('aviso-entrega')).not.toBeInTheDocument();
  });
});
