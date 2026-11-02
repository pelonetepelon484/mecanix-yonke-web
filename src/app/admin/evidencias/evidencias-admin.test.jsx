// @vitest-environment jsdom
// /admin/evidencias: lista la autorización del yonke, conserva por reclamación y borra solo las conservadas.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
const fecha = { toDate: () => new Date('2026-11-01T18:00:00Z') };
const base = {
  id: 'E1', yonkeNombre: 'El Güero', yonkeWhatsapp: '6641111111', busqueda: 'Faro · Ford Focus 2012', medio: 'whatsapp',
  mensaje: 'Sí la tengo y autorizo.', recibidoAt: fecha, creadoAt: fecha, adminEmail: 'admin@prueba.mx',
};
let lista;
const datos = {
  listarEvidencias: vi.fn(async () => lista),
  conservarEvidencia: vi.fn(async () => {}),
  borrarEvidenciaConservada: vi.fn(async () => {}),
};
vi.mock('../pedidos/datos', () => datos);
const { default: Pagina } = await import('./page.js');

beforeEach(() => { window.confirm = vi.fn(() => true); });
afterEach(() => { cleanup(); Object.values(datos).forEach((f) => f.mockClear()); });

describe('/admin/evidencias', () => {
  it('muestra los datos de la autorización', async () => {
    lista = [{ ...base, expiraAt: fecha }];
    render(<Pagina />);
    expect(await screen.findByText('Sí la tengo y autorizo.')).toBeInTheDocument();
    expect(screen.getByText(/El Güero · 6641111111/)).toBeInTheDocument();
    expect(screen.getByText('WhatsApp', { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/admin@prueba.mx/)).toBeInTheDocument();
  });

  it('vigente: conservar pide motivo y no ofrece borrar', async () => {
    lista = [{ ...base, expiraAt: fecha }];
    render(<Pagina />);
    const boton = await screen.findByRole('button', { name: 'Conservar por reclamación' });
    expect(boton).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Borrar/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Motivo de la reclamación'), { target: { value: ' Reclamó el yonke ' } });
    fireEvent.click(boton);
    await waitFor(() => expect(datos.conservarEvidencia).toHaveBeenCalledWith('E1', 'Reclamó el yonke'));
    await waitFor(() => expect(datos.listarEvidencias).toHaveBeenCalledTimes(2));
  });

  it('conservada: se borra solo tras confirmar', async () => {
    lista = [{ ...base, conservadaAt: fecha, motivoConservacion: 'Reclamó el yonke' }];
    render(<Pagina />);
    fireEvent.click(await screen.findByRole('button', { name: 'Borrar: reclamación atendida' }));
    await waitFor(() => expect(datos.borrarEvidenciaConservada).toHaveBeenCalledWith('E1'));
  });

  it('sin evidencias lo dice', async () => {
    lista = [];
    render(<Pagina />);
    expect(await screen.findByText('No hay evidencias guardadas.')).toBeInTheDocument();
  });
});
